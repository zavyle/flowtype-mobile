import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  CustomVocabularyItem,
  getVocabulary,
  saveVocabulary,
} from "@/lib/sessionStore";
import * as Haptics from "expo-haptics";

export default function VocabularyScreen() {
  const [vocabulary, setVocabulary] = useState<CustomVocabularyItem[]>([]);
  const [newTerm, setNewTerm] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newCategory, setNewCategory] = useState<
    "tech" | "business" | "medical" | "names" | "custom"
  >("tech");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await getVocabulary();
      setVocabulary(list);
    })();
  }, []);

  const handleAddTerm = async () => {
    if (!newTerm.trim()) {
      Alert.alert("Missing Term", "Please enter a word, acronym, or name.");
      return;
    }

    const newItem: CustomVocabularyItem = {
      id: `vocab_${Date.now()}`,
      term: newTerm.trim(),
      category: newCategory,
      notes: newNotes.trim() || undefined,
    };

    const updated = [newItem, ...vocabulary];
    await saveVocabulary(updated);
    setVocabulary(updated);
    setNewTerm("");
    setNewNotes("");
    setIsAdding(false);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleDelete = async (id: string) => {
    const updated = vocabulary.filter((v) => v.id !== id);
    await saveVocabulary(updated);
    setVocabulary(updated);
  };

  return (
    <ScreenContainer className="px-4 pb-2" style={{ paddingTop: 18 }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Custom Vocabulary</Text>
          <Text style={styles.subtitle}>
            Injected directly into Whisper & AI prompts for 100% spelling precision
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addBtn, isAdding && styles.addBtnActive]}
          onPress={() => setIsAdding(!isAdding)}
          activeOpacity={0.8}
        >
          <IconSymbol
            name={isAdding ? "checkmark" : "plus"}
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.addBtnText}>{isAdding ? "Done" : "Add Term"}</Text>
        </TouchableOpacity>
      </View>

      {/* Add New Term Card */}
      {isAdding && (
        <View style={styles.addCard}>
          <Text style={styles.addCardTitle}>New Dictionary Entry</Text>

          <TextInput
            style={styles.input}
            placeholder="Term, Acronym, or Name (e.g. Wispr, tRPC, Alex Chen)"
            placeholderTextColor="#64748B"
            value={newTerm}
            onChangeText={setNewTerm}
            autoFocus
          />

          <TextInput
            style={styles.input}
            placeholder="Optional context / pronunciation hint"
            placeholderTextColor="#64748B"
            value={newNotes}
            onChangeText={setNewNotes}
          />

          <View style={styles.categoryRow}>
            {(["tech", "business", "medical", "names", "custom"] as const).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  newCategory === cat && styles.categoryPillActive,
                ]}
                onPress={() => setNewCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    newCategory === cat && styles.categoryPillTextActive,
                  ]}
                >
                  {cat.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleAddTerm}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>Save to FlowType Dictionary</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Vocabulary List */}
      <FlatList
        data={vocabulary}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <View style={styles.termHeader}>
                <Text style={styles.termText}>{item.term}</Text>
                <View style={styles.catBadge}>
                  <Text style={styles.catBadgeText}>{item.category.toUpperCase()}</Text>
                </View>
              </View>
              {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}
            </View>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item.id)}
            >
              <IconSymbol name="trash" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  subtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
    maxWidth: 240,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6366F1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  addBtnActive: {
    backgroundColor: "#10B981",
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  addCard: {
    backgroundColor: "#181B26",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#242938",
    marginBottom: 16,
  },
  addCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#818CF8",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#0F1117",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F8FAFC",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#242938",
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
  },
  categoryPillActive: {
    backgroundColor: "#6366F1",
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
  },
  categoryPillTextActive: {
    color: "#FFFFFF",
  },
  saveBtn: {
    backgroundColor: "#6366F1",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#181B26",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#242938",
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  termHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  termText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  catBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#818CF8",
  },
  notesText: {
    fontSize: 12,
    color: "#64748B",
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    marginLeft: 10,
  },
});
