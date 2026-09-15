import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Share,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { StyleSelector } from "@/components/style-selector";
import {
  TranscriptionSession,
  getSessionById,
  saveSession,
  FormattingStyle,
} from "@/lib/sessionStore";
import { formatTimeClock } from "@/hooks/use-audio-engine";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

export default function SessionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [session, setSession] = useState<TranscriptionSession | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [isReformatting, setIsReformatting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"formatted" | "raw" | "chunks">("formatted");

  const reformatMutation = trpc.voice.reformatTranscript.useMutation();

  useEffect(() => {
    (async () => {
      if (id) {
        const item = await getSessionById(id);
        if (item) {
          setSession(item);
          setEditedText(item.formattedText);
        }
      }
    })();
  }, [id]);

  const handleReformat = async (newStyle: FormattingStyle) => {
    if (!session || !session.rawText) return;
    setIsReformatting(true);
    try {
      const res = await reformatMutation.mutateAsync({
        text: session.rawText,
        style: newStyle,
        language: session.language,
      });
      const updated: TranscriptionSession = {
        ...session,
        formattedText: res.formattedText,
        style: newStyle,
        updatedAt: Date.now(),
      };
      await saveSession(updated);
      setSession(updated);
      setEditedText(res.formattedText);
    } catch (e) {
      console.error("Reformat error:", e);
    } finally {
      setIsReformatting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!session) return;
    const updated: TranscriptionSession = {
      ...session,
      formattedText: editedText,
      wordCount: editedText.split(/\s+/).filter(Boolean).length,
      updatedAt: Date.now(),
    };
    await saveSession(updated);
    setSession(updated);
    setIsEditing(false);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCopy = async () => {
    if (!session) return;
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(session.formattedText);
      } catch {}
    }
    setCopied(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!session) return;
    try {
      await Share.share({
        message: session.formattedText,
        title: session.title,
      });
    } catch {}
  };

  if (!session) {
    return (
      <ScreenContainer className="p-4 items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={{ color: "#94A3B8", marginTop: 12 }}>Loading transcript...</Text>
      </ScreenContainer>
    );
  }

  const isLong = session.isLongSession || session.duration >= 1800;

  return (
    <ScreenContainer className="p-4">
      {/* Navigation Header */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.right" size={18} color="#818CF8" style={{ transform: [{ rotate: "180deg" }] }} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.topNavActions}>
          <TouchableOpacity style={styles.iconAction} onPress={handleCopy}>
            <IconSymbol
              name={copied ? "checkmark" : "doc.on.doc"}
              size={18}
              color={copied ? "#10B981" : "#818CF8"}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconAction} onPress={handleShare}>
            <IconSymbol name="square.and.arrow.up" size={18} color="#818CF8" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Session Meta */}
        <View style={styles.metaCard}>
          <View style={styles.badgeRow}>
            {isLong && (
              <View style={styles.longBadge}>
                <IconSymbol name="clock.fill" size={11} color="#C084FC" />
                <Text style={styles.longBadgeText}>30m+ EXTENDED</Text>
              </View>
            )}
            <View style={styles.styleBadge}>
              <Text style={styles.styleBadgeText}>
                {session.style.replace("_", " ").toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.sessionTitle}>{session.title}</Text>
          <Text style={styles.sessionStats}>
            {formatTimeClock(session.duration)} duration • {session.wordCount} words •{" "}
            {new Date(session.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* AI Style Switcher */}
        <View style={styles.styleSection}>
          <Text style={styles.sectionLabel}>RE-FORMAT WITH AI</Text>
          <StyleSelector
            selectedStyle={session.style}
            onSelectStyle={handleReformat}
            compact
          />
        </View>

        {isReformatting && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.loadingBannerText}>FlowType AI is re-synthesizing...</Text>
          </View>
        )}

        {/* Tab Selector: Formatted vs. Raw Verbatim vs. Chunks */}
        <View style={styles.viewTabs}>
          <TouchableOpacity
            style={[styles.viewTab, activeTab === "formatted" && styles.viewTabActive]}
            onPress={() => setActiveTab("formatted")}
          >
            <Text
              style={[
                styles.viewTabText,
                activeTab === "formatted" && styles.viewTabTextActive,
              ]}
            >
              Formatted ({session.style.replace("_", " ")})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewTab, activeTab === "raw" && styles.viewTabActive]}
            onPress={() => setActiveTab("raw")}
          >
            <Text
              style={[styles.viewTabText, activeTab === "raw" && styles.viewTabTextActive]}
            >
              Raw Verbatim
            </Text>
          </TouchableOpacity>

          {session.chunks && session.chunks.length > 0 && (
            <TouchableOpacity
              style={[styles.viewTab, activeTab === "chunks" && styles.viewTabActive]}
              onPress={() => setActiveTab("chunks")}
            >
              <Text
                style={[
                  styles.viewTabText,
                  activeTab === "chunks" && styles.viewTabTextActive,
                ]}
              >
                Chunks ({session.chunks.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content View */}
        {activeTab === "formatted" && (
          <View style={styles.contentCard}>
            <View style={styles.contentHeader}>
              <Text style={styles.contentHeaderTitle}>Transcribed Prose</Text>
              <TouchableOpacity
                style={styles.editToggleBtn}
                onPress={() => {
                  if (isEditing) handleSaveEdit();
                  else setIsEditing(true);
                }}
              >
                <Text style={styles.editToggleText}>
                  {isEditing ? "Save Changes" : "Edit Text"}
                </Text>
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <TextInput
                style={styles.editableInput}
                multiline
                value={editedText}
                onChangeText={setEditedText}
              />
            ) : (
              <Text style={styles.mainTranscriptText} selectable>
                {session.formattedText}
              </Text>
            )}
          </View>
        )}

        {activeTab === "raw" && (
          <View style={styles.contentCard}>
            <Text style={styles.rawDisclaimer}>
              Unedited, word-for-word transcript directly from Whisper STT:
            </Text>
            <Text style={styles.mainTranscriptText} selectable>
              {session.rawText}
            </Text>
          </View>
        )}

        {activeTab === "chunks" && session.chunks && (
          <View style={styles.chunksList}>
            {session.chunks.map((chunk, idx) => (
              <View key={chunk.id || idx} style={styles.chunkItem}>
                <View style={styles.chunkHeader}>
                  <Text style={styles.chunkTitle}>
                    Chunk {chunk.chunkIndex + 1}
                  </Text>
                  <Text style={styles.chunkTime}>
                    {formatTimeClock(chunk.startTime)} - {formatTimeClock(chunk.endTime)}
                  </Text>
                </View>
                <Text style={styles.chunkText}>{chunk.rawText}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backBtnText: {
    color: "#818CF8",
    fontSize: 15,
    fontWeight: "600",
  },
  topNavActions: {
    flexDirection: "row",
    gap: 10,
  },
  iconAction: {
    padding: 8,
    backgroundColor: "#181B26",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#242938",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  metaCard: {
    backgroundColor: "#181B26",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#242938",
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  longBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168, 85, 247, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  longBadgeText: {
    color: "#C084FC",
    fontSize: 10,
    fontWeight: "700",
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
  sessionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F8FAFC",
    marginBottom: 6,
  },
  sessionStats: {
    fontSize: 12,
    color: "#64748B",
  },
  styleSection: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  loadingBannerText: {
    color: "#818CF8",
    fontSize: 12,
    fontWeight: "600",
  },
  viewTabs: {
    flexDirection: "row",
    backgroundColor: "#181B26",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#242938",
  },
  viewTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  viewTabActive: {
    backgroundColor: "#6366F1",
  },
  viewTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  viewTabTextActive: {
    color: "#FFFFFF",
  },
  contentCard: {
    backgroundColor: "#181B26",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#242938",
  },
  contentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  contentHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94A3B8",
  },
  editToggleBtn: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editToggleText: {
    color: "#818CF8",
    fontSize: 12,
    fontWeight: "600",
  },
  mainTranscriptText: {
    color: "#F1F5F9",
    fontSize: 15,
    lineHeight: 24,
  },
  editableInput: {
    color: "#F1F5F9",
    fontSize: 15,
    lineHeight: 24,
    backgroundColor: "#0F1117",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    minHeight: 180,
    textAlignVertical: "top",
  },
  rawDisclaimer: {
    color: "#64748B",
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 10,
  },
  chunksList: {
    gap: 10,
  },
  chunkItem: {
    backgroundColor: "#181B26",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#242938",
  },
  chunkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  chunkTitle: {
    color: "#C084FC",
    fontSize: 13,
    fontWeight: "700",
  },
  chunkTime: {
    color: "#64748B",
    fontSize: 11,
  },
  chunkText: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 19,
  },
});
