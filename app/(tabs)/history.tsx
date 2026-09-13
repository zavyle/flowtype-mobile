import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Share,
  Alert,
  Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  TranscriptionSession,
  getSessions,
  deleteSession,
} from "@/lib/sessionStore";
import { formatTimeClock } from "@/hooks/use-audio-engine";
import * as Haptics from "expo-haptics";

export default function HistoryScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<TranscriptionSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "long" | "quick">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const list = await getSessions();
    setSessions(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions]),
  );

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.formattedText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rawText.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === "long") return s.isLongSession || s.duration >= 1800;
    if (filterMode === "quick") return !s.isLongSession && s.duration < 1800;
    return true;
  });

  const handleCopy = async (session: TranscriptionSession) => {
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(session.formattedText);
      } catch {}
    }
    setCopiedId(session.id);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (session: TranscriptionSession) => {
    try {
      await Share.share({
        message: session.formattedText,
        title: session.title,
      });
    } catch {}
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Recording", "Are you sure you want to delete this transcript?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteSession(id);
          await loadSessions();
        },
      },
    ]);
  };

  return (
    <ScreenContainer className="px-4 pb-2" style={{ paddingTop: 18 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transcription History</Text>
        <Text style={styles.headerSubtitle}>
          {sessions.length} total sessions •{" "}
          {sessions.filter((s) => s.isLongSession || s.duration >= 1800).length} extended 30m+
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <IconSymbol name="magnifyingglass" size={16} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transcripts, topics, keywords..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Text style={styles.clearSearch}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filterMode === "all" && styles.filterChipActive]}
          onPress={() => setFilterMode("all")}
        >
          <Text
            style={[
              styles.filterText,
              filterMode === "all" && styles.filterTextActive,
            ]}
          >
            All Sessions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterMode === "long" && styles.filterChipActive]}
          onPress={() => setFilterMode("long")}
        >
          <Text
            style={[
              styles.filterText,
              filterMode === "long" && styles.filterTextActive,
            ]}
          >
            Extended 30m+
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterMode === "quick" && styles.filterChipActive]}
          onPress={() => setFilterMode("quick")}
        >
          <Text
            style={[
              styles.filterText,
              filterMode === "quick" && styles.filterTextActive,
            ]}
          >
            Quick Dictations
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sessions List */}
      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSymbol name="clock" size={40} color="#334155" />
            <Text style={styles.emptyTitle}>No transcripts found</Text>
            <Text style={styles.emptySub}>
              Dictate on the main screen to create transcripts and recordings.
            </Text>
            <TouchableOpacity
              style={styles.emptyAction}
              onPress={() => router.replace("/")}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyActionText}>Start a Dictation</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const isLong = item.isLongSession || item.duration >= 1800;
          const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: "/session/[id]" as any, params: { id: item.id } })}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  {isLong ? (
                    <View style={styles.longBadge}>
                      <IconSymbol name="clock.fill" size={11} color="#C084FC" />
                      <Text style={styles.longBadgeText}>30m+ SESSION</Text>
                    </View>
                  ) : (
                    <View style={styles.quickBadge}>
                      <Text style={styles.quickBadgeText}>QUICK DICTATION</Text>
                    </View>
                  )}
                  <View style={styles.styleBadge}>
                    <Text style={styles.styleBadgeText}>
                      {item.style.replace("_", " ").toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardDate}>{formattedDate}</Text>
              </View>

              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>

              <Text style={styles.cardSnippet} numberOfLines={3}>
                {item.formattedText}
              </Text>

              <View style={styles.cardFooter}>
                <Text style={styles.cardStats}>
                  {formatTimeClock(item.duration)} • {item.wordCount} words
                  {item.chunks && item.chunks.length > 0 && ` • ${item.chunks.length} chunks`}
                </Text>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleCopy(item);
                    }}
                  >
                    <IconSymbol
                      name={copiedId === item.id ? "checkmark" : "doc.on.doc"}
                      size={15}
                      color={copiedId === item.id ? "#10B981" : "#818CF8"}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleShare(item);
                    }}
                  >
                    <IconSymbol name="square.and.arrow.up" size={15} color="#818CF8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                  >
                    <IconSymbol name="trash" size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#181B26",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#242938",
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 14,
    padding: 0,
  },
  clearSearch: {
    color: "#818CF8",
    fontSize: 12,
    fontWeight: "600",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
  },
  filterChipActive: {
    backgroundColor: "#6366F1",
    borderColor: "#818CF8",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: "#181B26",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#242938",
    padding: 16,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  quickBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quickBadgeText: {
    color: "#818CF8",
    fontSize: 10,
    fontWeight: "700",
  },
  styleBadge: {
    backgroundColor: "#202534",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  styleBadgeText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "600",
  },
  cardDate: {
    color: "#64748B",
    fontSize: 11,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 6,
  },
  cardSnippet: {
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 19,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 10,
  },
  cardStats: {
    fontSize: 12,
    color: "#64748B",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  cardActionBtn: {
    padding: 6,
    backgroundColor: "#202534",
    borderRadius: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    color: "#94A3B8",
    fontSize: 16,
    fontWeight: "700",
  },
  emptySub: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: 8,
    backgroundColor: "#6366F1",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
