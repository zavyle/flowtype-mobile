import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatTimeClock } from "@/hooks/use-audio-engine";
import {
  clearAllPendingRecordings,
  clearPendingRecording,
  getPendingRecordings,
  getRecoveryVaultSummary,
  markPendingRecordingAttempt,
  updatePendingRecording,
  type PendingRecording,
  type RecoveryVaultSummary,
} from "@/lib/pendingRecording";
import { uploadNativeAudioForTranscription } from "@/lib/nativeAudioUpload";
import { getUploadProgress } from "@/lib/resumableUpload";
import { createTranscriptionSession } from "@/lib/transcriptionSession";
import { saveSession } from "@/lib/sessionStore";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

function statusFor(item: PendingRecording): string {
  if (item.upload?.status === "assembling") return "Audio uploaded — transcribing";
  if (item.upload) {
    const uploaded = Object.keys(item.upload.uploadedChunks).length;
    return `Upload saved: ${uploaded}/${item.upload.totalChunks} chunks`;
  }
  if (item.lastError) return "Ready to retry";
  return "Protected on this device";
}

export default function RecoveryVaultScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PendingRecording[]>([]);
  const [summary, setSummary] = useState<RecoveryVaultSummary>({ count: 0, totalBytes: 0, failedCount: 0 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activity, setActivity] = useState<Record<string, string>>({});

  const loadVault = useCallback(async () => {
    const [nextItems, nextSummary] = await Promise.all([getPendingRecordings(), getRecoveryVaultSummary()]);
    setItems(nextItems);
    setSummary(nextSummary);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadVault();
    }, [loadVault]),
  );

  const protectedLabel = useMemo(
    () => `${summary.count} protected ${summary.count === 1 ? "recording" : "recordings"} • ${formatBytes(summary.totalBytes)}`,
    [summary],
  );

  const retryRecording = useCallback(async (item: PendingRecording) => {
    setActiveId(item.id);
    setActivity((previous) => ({ ...previous, [item.id]: "Preparing protected recording..." }));
    try {
      const attempted = await markPendingRecordingAttempt(item.id);
      if (!attempted) throw new Error("This Recovery Vault item is no longer available.");

      const response = await uploadNativeAudioForTranscription({
        fileUri: attempted.fileUri,
        mimeType: attempted.mimeType,
        language: attempted.language,
        style: attempted.style,
        customVocabulary: attempted.customVocabulary,
        resumableCheckpoint: attempted.upload,
        onUploadCheckpoint: async (upload) => {
          await updatePendingRecording(attempted.id, { upload, lastError: undefined });
          const percent = Math.round(getUploadProgress(upload) * 100);
          setActivity((previous) => ({
            ...previous,
            [attempted.id]: upload.status === "assembling" ? "Verifying uploaded audio..." : `Resuming upload • ${percent}% complete`,
          }));
          await loadVault();
        },
      });

      if (!response.rawText.trim() || !response.formattedText.trim()) {
        throw new Error("No speech was detected in this saved recording.");
      }

      const session = createTranscriptionSession({
        response,
        duration: Math.max(1, attempted.duration || response.duration || 0),
        style: attempted.style,
        language: attempted.language,
        name: attempted.name,
        source: attempted.source,
      });
      await saveSession(session);
      await clearPendingRecording(attempted.id);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.push({ pathname: "/session/[id]", params: { id: session.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Recovery upload failed.";
      await updatePendingRecording(item.id, { lastError: message });
      setActivity((previous) => ({ ...previous, [item.id]: "Paused safely — retry when ready" }));
      Alert.alert("Recording Still Protected", `${message}\n\nThe original audio remains safely in Recovery Vault.`);
    } finally {
      setActiveId(null);
      await loadVault();
    }
  }, [loadVault, router]);

  const confirmDiscard = useCallback((item: PendingRecording) => {
    Alert.alert(
      "Delete Protected Recording?",
      `This permanently deletes “${item.name}” and its local audio file. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Recording",
          style: "destructive",
          onPress: async () => {
            await clearPendingRecording(item.id);
            await loadVault();
          },
        },
      ],
    );
  }, [loadVault]);

  const confirmClearAll = useCallback(() => {
    Alert.alert(
      "Clear Recovery Vault?",
      "This permanently deletes every protected audio recording from this device. Completed transcripts in History are not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Vault",
          style: "destructive",
          onPress: async () => {
            await clearAllPendingRecordings();
            await loadVault();
          },
        },
      ],
    );
  }, [loadVault]);

  return (
    <ScreenContainer className="px-4 pb-2" style={{ paddingTop: 18 }}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <IconSymbol name="archivebox.fill" size={22} color="#A5B4FC" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Recovery Vault</Text>
          <Text style={styles.subtitle}>{protectedLabel}</Text>
        </View>
        {items.length > 0 && (
          <TouchableOpacity style={styles.clearAllButton} onPress={confirmClearAll} activeOpacity={0.75}>
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.explainer}>
        <IconSymbol name="lock.fill" size={15} color="#A5B4FC" />
        <Text style={styles.explainerText}>
          Completed recordings are copied here before transcription. Long uploads resume from the last protected chunk after a weak connection or app restart.
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSymbol name="archivebox.fill" size={44} color="#334155" />
            <Text style={styles.emptyTitle}>Your Recovery Vault is empty</Text>
            <Text style={styles.emptyText}>
              Completed recordings will appear here only while FlowType is protecting, uploading, or retrying them.
            </Text>
            <TouchableOpacity style={styles.dictateButton} onPress={() => router.replace("/")} activeOpacity={0.8}>
              <Text style={styles.dictateButtonText}>Start a Dictation</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const active = activeId === item.id;
          const resumablePercent = item.upload ? Math.round(getUploadProgress(item.upload) * 100) : 0;
          const created = new Date(item.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.sourceBadge}>
                  <Text style={styles.sourceBadgeText}>{item.source === "import" ? "IMPORTED AUDIO" : "VOICE DICTATION"}</Text>
                </View>
                <Text style={styles.date}>{created}</Text>
              </View>
              <Text style={styles.recordingName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.duration > 0 ? `${formatTimeClock(item.duration)} • ` : ""}{formatBytes(item.fileSize)} • Attempt {item.attempts + 1}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, item.lastError && styles.statusDotWarning]} />
                <Text style={styles.statusText}>{activity[item.id] || statusFor(item)}</Text>
                {item.upload && <Text style={styles.progressText}>{resumablePercent}%</Text>}
              </View>
              {item.lastError && <Text style={styles.errorText} numberOfLines={2}>{item.lastError}</Text>}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.retryButton, active && styles.retryButtonDisabled]}
                  onPress={() => void retryRecording(item)}
                  disabled={active}
                  activeOpacity={0.8}
                >
                  {active ? <ActivityIndicator size="small" color="#FFFFFF" /> : <IconSymbol name="arrow.clockwise" size={15} color="#FFFFFF" />}
                  <Text style={styles.retryText}>{active ? "Recovering..." : item.upload ? "Resume Upload" : "Retry Transcription"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDiscard(item)} disabled={active} activeOpacity={0.8}>
                  <IconSymbol name="trash" size={16} color="#FCA5A5" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99, 102, 241, 0.14)", borderWidth: 1, borderColor: "rgba(129, 140, 248, 0.25)" },
  headerCopy: { flex: 1 },
  title: { color: "#F8FAFC", fontWeight: "800", fontSize: 23 },
  subtitle: { color: "#94A3B8", marginTop: 2, fontSize: 12 },
  clearAllButton: { paddingVertical: 7, paddingHorizontal: 10, backgroundColor: "rgba(239, 68, 68, 0.10)", borderRadius: 9 },
  clearAllText: { color: "#FCA5A5", fontSize: 11, fontWeight: "700" },
  explainer: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, backgroundColor: "rgba(99, 102, 241, 0.10)", borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.22)", borderRadius: 14, marginBottom: 14 },
  explainerText: { flex: 1, color: "#C7D2FE", fontSize: 12, lineHeight: 18 },
  list: { paddingBottom: 24, gap: 12 },
  card: { backgroundColor: "#181B26", borderColor: "#242938", borderWidth: 1, borderRadius: 16, padding: 15 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  sourceBadge: { backgroundColor: "rgba(129, 140, 248, 0.14)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  sourceBadgeText: { color: "#A5B4FC", fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  date: { color: "#64748B", fontSize: 11 },
  recordingName: { color: "#F8FAFC", fontSize: 15, fontWeight: "700", marginBottom: 5 },
  meta: { color: "#94A3B8", fontSize: 12 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#818CF8" },
  statusDotWarning: { backgroundColor: "#F59E0B" },
  statusText: { flex: 1, color: "#C7D2FE", fontSize: 12, fontWeight: "600" },
  progressText: { color: "#A5B4FC", fontSize: 11, fontWeight: "800" },
  errorText: { color: "#FCA5A5", fontSize: 11, lineHeight: 16, marginTop: 8 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  retryButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#4F46E5", borderRadius: 10, paddingVertical: 10 },
  retryButtonDisabled: { opacity: 0.65 },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  deleteButton: { padding: 10, borderRadius: 10, backgroundColor: "rgba(239, 68, 68, 0.12)" },
  emptyState: { alignItems: "center", paddingHorizontal: 28, paddingTop: 72, gap: 10 },
  emptyTitle: { color: "#CBD5E1", fontSize: 17, fontWeight: "800", marginTop: 3 },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 13, lineHeight: 19 },
  dictateButton: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 17, borderRadius: 20, backgroundColor: "#6366F1" },
  dictateButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
});
