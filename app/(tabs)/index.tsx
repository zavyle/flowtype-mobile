import React, { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Share,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { WaveformVisualizer } from "@/components/waveform-visualizer";
import { StyleSelector } from "@/components/style-selector";
import { useAudioEngine, formatTimeClock } from "@/hooks/use-audio-engine";
import { trpc } from "@/lib/trpc";
import {
  FormattingStyle,
  saveSession,
  getVocabulary,
  getSettings,
  TranscriptionSession,
} from "@/lib/sessionStore";
import { pickAudioRecording } from "@/lib/audioImport";
import * as Haptics from "expo-haptics";
import { activateKeepAwake, deactivateKeepAwake } from "expo-keep-awake";

export default function DictationHomeScreen() {
  const [selectedStyle, setSelectedStyle] = useState<FormattingStyle>("clean_voice");
  const [isLongSessionMode, setIsLongSessionMode] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("auto");
  const [keepScreenAwake, setKeepScreenAwake] = useState(true);
  const [currentSession, setCurrentSession] = useState<TranscriptionSession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [customVocabTerms, setCustomVocabTerms] = useState<string[]>([]);

  // Load vocabulary & settings on mount
  useEffect(() => {
    (async () => {
      const vocab = await getVocabulary();
      setCustomVocabTerms(vocab.map((v) => v.term));
      const settings = await getSettings();
      setSelectedStyle(settings.defaultStyle);
      setTargetLanguage(settings.defaultLanguage);
      setKeepScreenAwake(settings.keepScreenAwake);
    })();
  }, []);

  const {
    isRecording,
    isPaused,
    durationSeconds,
    audioLevel,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    error: recordingError,
    isStarting,
    permissionStatus,
  } = useAudioEngine({
    chunkIntervalMinutes: 10,
  });

  useEffect(() => {
    if (Platform.OS === "web" || !isRecording || !keepScreenAwake) return;
    void activateKeepAwake("flowtype-recording").catch(() => undefined);
    return () => {
      void deactivateKeepAwake("flowtype-recording").catch(() => undefined);
    };
  }, [isRecording, keepScreenAwake]);

  // tRPC Mutations
  const transcribeMutation = trpc.voice.transcribeAudioChunk.useMutation();
  const reformatMutation = trpc.voice.reformatTranscript.useMutation();

  const handleToggleRecord = async () => {
    if (isRecording) {
      // Stop recording and process
      setIsProcessing(true);
      setStatusMessage("Finalizing audio & transcribing with Whisper...");
      try {
        const recorded = await stopRecording();
        if (!recorded.base64) {
          throw new Error("No audio was captured. Check microphone access and try again.");
        }

        let resultText = "";
        let rawText = "";
        let returnedAudioUrl: string | undefined = undefined;

        if (recorded.base64) {
          setStatusMessage("Analyzing speech & applying AI formatting...");
          const res = await transcribeMutation.mutateAsync({
            audioBase64: recorded.base64,
            mimeType: recorded.mimeType,
            language: targetLanguage,
            style: selectedStyle,
            customVocabulary: customVocabTerms,
          });

          rawText = res.rawText;
          resultText = res.formattedText;
          returnedAudioUrl = res.audioUrl;
        }

        if (!rawText.trim() || !resultText.trim()) {
          throw new Error("No speech was detected. Speak closer to the microphone and try again.");
        }

        const sessionDuration = Math.max(1, recorded.duration || durationSeconds || 0);
        const sessionId = `session_${Date.now()}`;
        const newSession: TranscriptionSession = {
          id: sessionId,
          title:
            rawText.slice(0, 48).trim() + (rawText.length > 48 ? "..." : "") ||
            `Voice Dictation ${new Date().toLocaleTimeString()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          duration: sessionDuration,
          isLongSession: isLongSessionMode || sessionDuration > 1800,
          chunks: [
            {
              id: `${sessionId}_chunk_0`,
              chunkIndex: 0,
              startTime: 0,
              endTime: sessionDuration,
              duration: sessionDuration,
              rawText,
              audioUrl: returnedAudioUrl,
              status: "completed",
            },
          ],
          rawText,
          formattedText: resultText,
          style: selectedStyle,
          language: targetLanguage,
          audioUrl: returnedAudioUrl,
          wordCount: resultText.split(/\s+/).filter(Boolean).length,
        };

        await saveSession(newSession);
        setCurrentSession(newSession);
        setLastError(null);
      } catch (err: any) {
        console.error("Transcription failed:", err);
        setLastError(err?.message || "Recording or transcription failed. No session was saved.");
      } finally {
        setIsProcessing(false);
        setStatusMessage(null);
      }
    } else {
      setCurrentSession(null);
      setLastError(null);
      const started = await startRecording();
      if (!started.ok) setLastError(started.error);
    }
  };

  const handleImportRecording = async () => {
    if (isRecording || isProcessing || isImporting) return;
    setLastError(null);
    setCurrentSession(null);
    setIsImporting(true);
    setIsProcessing(true);
    try {
      const imported = await pickAudioRecording();
      if (!imported) return;

      setStatusMessage(`Importing ${imported.name}...`);
      const res = await transcribeMutation.mutateAsync({
        audioBase64: imported.base64,
        mimeType: imported.mimeType,
        language: targetLanguage,
        style: selectedStyle,
        customVocabulary: customVocabTerms,
      });

      if (!res.rawText.trim() || !res.formattedText.trim()) {
        throw new Error("No speech was detected in this recording. Try a clearer export from the recorder.");
      }

      const sessionDuration = Math.max(1, res.duration || 0);
      const sessionId = `import_${Date.now()}`;
      const importedSession: TranscriptionSession = {
        id: sessionId,
        title:
          res.rawText.slice(0, 48).trim() + (res.rawText.length > 48 ? "..." : "") || imported.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        duration: sessionDuration,
        isLongSession: sessionDuration >= 1800,
        chunks: [
          {
            id: `${sessionId}_chunk_0`,
            chunkIndex: 0,
            startTime: 0,
            endTime: sessionDuration,
            duration: sessionDuration,
            rawText: res.rawText,
            audioUrl: res.audioUrl,
            status: "completed",
          },
        ],
        rawText: res.rawText,
        formattedText: res.formattedText,
        style: selectedStyle,
        language: targetLanguage,
        audioUrl: res.audioUrl,
        wordCount: res.formattedText.split(/\s+/).filter(Boolean).length,
      };

      await saveSession(importedSession);
      setCurrentSession(importedSession);
      setStatusMessage(`Imported ${imported.name} successfully.`);
    } catch (err) {
      console.error("Audio import failed:", err);
      setLastError(err instanceof Error ? err.message : "Could not import this recording.");
    } finally {
      setIsImporting(false);
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 2200);
    }
  };

  const handleChangeStyle = async (newStyle: FormattingStyle) => {
    setSelectedStyle(newStyle);
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }

    if (currentSession && currentSession.rawText) {
      setIsProcessing(true);
      setStatusMessage(`Re-formatting into ${newStyle.replace("_", " ")}...`);
      try {
        const res = await reformatMutation.mutateAsync({
          text: currentSession.rawText,
          style: newStyle,
          customVocabulary: customVocabTerms,
          language: targetLanguage,
        });

        const updated: TranscriptionSession = {
          ...currentSession,
          formattedText: res.formattedText,
          style: newStyle,
          updatedAt: Date.now(),
        };
        await saveSession(updated);
        setCurrentSession(updated);
      } catch (err) {
        console.error("Reformat error:", err);
      } finally {
        setIsProcessing(false);
        setStatusMessage(null);
      }
    }
  };

  const handleCopyText = async () => {
    if (!currentSession) return;
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(currentSession.formattedText);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = currentSession.formattedText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
    }
    setCopiedFeedback(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setCopiedFeedback(false), 2000);
  };

  const handleShare = async () => {
    if (!currentSession) return;
    try {
      await Share.share({
        message: currentSession.formattedText,
        title: currentSession.title,
      });
    } catch (err) {
      console.log("Share cancelled or failed:", err);
    }
  };

  return (
    <ScreenContainer className="px-4 pb-2" style={{ paddingTop: 18 }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top App Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brandTitle}>FlowType</Text>
            <Text style={styles.brandSubtitle}>Wispr Flow Dictation • Extended 30m+</Text>
          </View>

          {/* Mode Pill Toggle: Quick vs. 30m+ Session */}
          <TouchableOpacity
            style={[styles.modePill, isLongSessionMode && styles.modePillActive]}
            onPress={() => setIsLongSessionMode(!isLongSessionMode)}
            activeOpacity={0.8}
          >
            <IconSymbol
              name={isLongSessionMode ? "clock.fill" : "mic.fill"}
              size={13}
              color={isLongSessionMode ? "#FFFFFF" : "#6366F1"}
            />
            <Text
              style={[styles.modePillText, isLongSessionMode && styles.modePillTextActive]}
            >
              {isLongSessionMode ? "30m+ Session" : "Quick Dictate"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.importRow}>
          <TouchableOpacity
            style={styles.importPill}
            onPress={handleImportRecording}
            disabled={isProcessing || isRecording || isStarting}
            activeOpacity={0.8}
          >
            {isImporting ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <IconSymbol name="doc.on.doc" size={14} color="#6366F1" />
            )}
            <Text style={styles.importPillText}>
              {isImporting ? "Importing Recording..." : "Import Recorder Audio"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.importHint}>
            AIREC: transfer the WAV file to your phone, then import it here. Direct share-in is not enabled yet.
          </Text>
        </View>

        {/* Style Selector Carousel */}
        <View style={styles.styleSection}>
          <Text style={styles.sectionLabel}>AI FORMATTING STYLE</Text>
          <StyleSelector
            selectedStyle={selectedStyle}
            onSelectStyle={handleChangeStyle}
          />
        </View>

        {!isRecording && !isProcessing && !isStarting && permissionStatus !== "granted" && (
          <View style={[styles.permissionHint, permissionStatus === "denied" && styles.permissionHintDenied]}>
            <IconSymbol
              name={permissionStatus === "denied" ? "exclamationmark.triangle.fill" : "mic.fill"}
              size={15}
              color={permissionStatus === "denied" ? "#F59E0B" : "#818CF8"}
            />
            <Text style={styles.permissionHintText}>
              {permissionStatus === "denied"
                ? "Microphone access is blocked. Tap to Dictate after enabling microphone access in your device or browser settings."
                : "Microphone access will be requested when you tap to Dictate. Your audio is captured only during an active recording."}
            </Text>
          </View>
        )}

        {/* Live Audio / Recording Dashboard Card */}
        <View style={[styles.dashboardCard, isRecording && styles.dashboardCardRecording]}>
          <View style={styles.dashHeader}>
            <View style={styles.statusIndicator}>
              <View
                style={[
                  styles.statusDot,
                  isStarting
                    ? styles.statusDotStarting
                    : isRecording
                    ? styles.statusDotHot
                    : styles.statusDotIdle,
                ]}
              />
              <Text style={styles.statusText}>
                {isStarting
                  ? "REQUESTING MICROPHONE"
                  : isRecording
                  ? isPaused
                    ? "RECORDING PAUSED"
                    : isLongSessionMode
                    ? "LONG SESSION (30M+ ROLLING)"
                    : "LISTENING..."
                  : isProcessing
                  ? "PROCESSING AI TRANSCRIPT"
                  : "READY TO DICTATE"}
              </Text>
            </View>

            {/* Live Clock */}
            <Text style={styles.timerClock}>
              {formatTimeClock(durationSeconds)}
            </Text>
          </View>

          {/* Waveform Visualizer */}
          <View style={styles.waveformWrapper}>
            <WaveformVisualizer
              isRecording={isRecording}
              isPaused={isPaused}
              decibelLevel={audioLevel}
              accentColor={isLongSessionMode ? "#8B5CF6" : "#6366F1"}
            />
          </View>

          {/* 30m+ Long Session Hint / Info */}
          {isLongSessionMode && (
            <View style={styles.longSessionBanner}>
              <IconSymbol name="info.circle" size={14} color="#A78BFA" />
              <Text style={styles.longSessionText}>
                Extended recording mode • Saves the complete session when you stop • Keep-Awake active when enabled
              </Text>
            </View>
          )}

          {/* Pause / Resume Controls if Recording */}
          {isRecording && (
            <View style={styles.recordingSubControls}>
              <TouchableOpacity
                style={styles.pauseBtn}
                onPress={isPaused ? resumeRecording : pauseRecording}
                activeOpacity={0.8}
              >
                <IconSymbol
                  name={isPaused ? "play.fill" : "pause.fill"}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.pauseBtnText}>
                  {isPaused ? "Resume" : "Pause"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Processing Indicator */}
        {isProcessing && (
          <View style={styles.processingBar}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.processingText}>
              {statusMessage || "Processing speech..."}
            </Text>
          </View>
        )}

        {(lastError || recordingError) && !isProcessing && !isRecording && (
          <View style={styles.errorCard}>
            <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#F87171" />
            <View style={styles.errorCardContent}>
              <Text style={styles.errorCardText}>{lastError || recordingError}</Text>
              <TouchableOpacity
                style={styles.errorRetry}
                onPress={() => {
                  setLastError(null);
                  void handleToggleRecord();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.errorRetryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Result Transcript Card */}
        {currentSession ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.resultMeta}>
                <Text style={styles.resultTitle}>{currentSession.title}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.styleBadge}>
                    <Text style={styles.styleBadgeText}>
                      {currentSession.style.toUpperCase().replace("_", " ")}
                    </Text>
                  </View>
                  <Text style={styles.metaSub}>
                    {formatTimeClock(currentSession.duration)} • {currentSession.wordCount} words
                  </Text>
                </View>
              </View>
            </View>

            {/* Formatted Transcript Text */}
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptText} selectable>
                {currentSession.formattedText}
              </Text>
            </View>

            {/* Actions Bar: Copy, Share, Reformat */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, copiedFeedback && styles.actionBtnActive]}
                onPress={handleCopyText}
                activeOpacity={0.8}
              >
                <IconSymbol
                  name={copiedFeedback ? "checkmark" : "doc.on.doc"}
                  size={16}
                  color={copiedFeedback ? "#10B981" : "#818CF8"}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    copiedFeedback && { color: "#10B981" },
                  ]}
                >
                  {copiedFeedback ? "Copied!" : "Copy"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <IconSymbol name="square.and.arrow.up" size={16} color="#818CF8" />
                <Text style={styles.actionBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Friendly Quick Start Prompt */
          <View style={styles.emptyState}>
            <Text style={styles.emptyPromptTitle}>Speak naturally at 3x typing speed</Text>
            <Text style={styles.emptyPromptSub}>
              Tap the microphone below to dictate. FlowType automatically strips &quot;ums&quot;, fixes syntax, and re-formats into your chosen style. For lectures or meetings beyond 30 mins, toggle 30m+ Session.
            </Text>

            <View style={styles.suggestionsGrid}>
              <View style={styles.suggestItem}>
                <Text style={styles.suggestEmoji}>⚡</Text>
                <Text style={styles.suggestTitle}>Zero Friction</Text>
                <Text style={styles.suggestDesc}>Instant speech to clean prose</Text>
              </View>
              <View style={styles.suggestItem}>
                <Text style={styles.suggestEmoji}>⏳</Text>
                <Text style={styles.suggestTitle}>30m+ Extended</Text>
                <Text style={styles.suggestDesc}>Multi-chunk buffer safeguards</Text>
              </View>
              <View style={styles.suggestItem}>
                <Text style={styles.suggestEmoji}>🎯</Text>
                <Text style={styles.suggestTitle}>Custom Vocab</Text>
                <Text style={styles.suggestDesc}>Spells acronyms flawlessly</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Tactile Floating Primary Dictate Button */}
      <View style={styles.primaryButtonContainer}>
        <TouchableOpacity
          style={[
            styles.primaryDictateBtn,
            isRecording && styles.primaryDictateBtnHot,
            (isProcessing || isStarting) && styles.primaryDictateBtnProcessing,
          ]}
          onPress={handleToggleRecord}
          disabled={isProcessing || isStarting}
          activeOpacity={0.85}
        >
          {isProcessing || isStarting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <IconSymbol
              name={isRecording ? "stop.fill" : "mic.fill"}
              size={28}
              color="#FFFFFF"
            />
          )}
          <Text style={styles.primaryDictateText}>
            {isStarting
              ? "Requesting Microphone..."
              : isRecording
              ? "Tap to Complete Dictation"
              : isProcessing
              ? "Processing Voice..."
              : "Tap to Dictate"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  modePillActive: {
    backgroundColor: "#6366F1",
    borderColor: "#818CF8",
  },
  modePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#818CF8",
  },
  modePillTextActive: {
    color: "#FFFFFF",
  },
  importRow: {
    marginBottom: 14,
    gap: 7,
  },
  importPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  importPillText: {
    color: "#818CF8",
    fontSize: 12,
    fontWeight: "700",
  },
  importHint: {
    color: "#64748B",
    fontSize: 11,
    lineHeight: 15,
  },
  styleSection: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 1.2,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  dashboardCard: {
    backgroundColor: "#181B26",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#242938",
    padding: 16,
    marginBottom: 16,
  },
  dashboardCardRecording: {
    borderColor: "rgba(99, 102, 241, 0.6)",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  dashHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotIdle: {
    backgroundColor: "#10B981",
  },
  statusDotHot: {
    backgroundColor: "#EF4444",
  },
  statusDotStarting: {
    backgroundColor: "#F59E0B",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
  },
  timerClock: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  waveformWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  longSessionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    marginTop: 8,
  },
  longSessionText: {
    fontSize: 11,
    color: "#C4B5FD",
    flex: 1,
    lineHeight: 15,
  },
  recordingSubControls: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
  },
  pauseBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E364B",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  pauseBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  permissionHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.18)",
    borderRadius: 12,
    padding: 11,
    marginBottom: 12,
  },
  permissionHintDenied: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.22)",
  },
  permissionHintText: {
    flex: 1,
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 17,
  },
  processingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  processingText: {
    color: "#818CF8",
    fontSize: 13,
    fontWeight: "600",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorCardContent: {
    flex: 1,
    gap: 8,
  },
  errorCardText: {
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 18,
  },
  errorRetry: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  errorRetryText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "700",
  },
  resultCard: {
    backgroundColor: "#181B26",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#242938",
    padding: 16,
    marginBottom: 16,
  },
  resultHeader: {
    marginBottom: 12,
  },
  resultMeta: {
    gap: 4,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  styleBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  styleBadgeText: {
    color: "#818CF8",
    fontSize: 10,
    fontWeight: "700",
  },
  metaSub: {
    fontSize: 12,
    color: "#64748B",
  },
  transcriptBox: {
    backgroundColor: "#0F1117",
    borderRadius: 14,
    padding: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#242938",
  },
  transcriptText: {
    color: "#F1F5F9",
    fontSize: 15,
    lineHeight: 23,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#202534",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F1F5F9",
  },
  emptyState: {
    backgroundColor: "#181B26",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#242938",
    padding: 20,
    marginTop: 4,
  },
  emptyPromptTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyPromptSub: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  suggestionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  suggestItem: {
    flex: 1,
    backgroundColor: "#0F1117",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#242938",
  },
  suggestEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  suggestTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 2,
    textAlign: "center",
  },
  suggestDesc: {
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
  },
  primaryButtonContainer: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
  },
  primaryDictateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366F1",
    paddingVertical: 18,
    borderRadius: 30,
    gap: 12,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryDictateBtnHot: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
  },
  primaryDictateBtnProcessing: {
    backgroundColor: "#4F46E5",
    opacity: 0.8,
  },
  primaryDictateText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
