import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { FormattingStyle } from "@/lib/sessionStore";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface StyleOption {
  key: FormattingStyle;
  label: string;
  subtitle: string;
  icon: any;
}

export const STYLE_OPTIONS: StyleOption[] = [
  {
    key: "clean_voice",
    label: "Clean Voice",
    subtitle: "Wispr default: removes fillers & polishes grammar",
    icon: "sparkles",
  },
  {
    key: "raw_verbatim",
    label: "Raw Verbatim",
    subtitle: "Exact spoken words with zero changes",
    icon: "waveform",
  },
  {
    key: "executive_summary",
    label: "Executive Summary",
    subtitle: "BLUF, key takeaways & concise highlights",
    icon: "sparkles",
  },
  {
    key: "bullet_points",
    label: "Bullet Points",
    subtitle: "Categorized, high-density bullet list",
    icon: "slider.horizontal.3",
  },
  {
    key: "email_draft",
    label: "Email Draft",
    subtitle: "Subject line, greeting, polished body & sign-off",
    icon: "paperplane.fill",
  },
  {
    key: "meeting_minutes",
    label: "Meeting Minutes",
    subtitle: "Objectives, discussion points & action items",
    icon: "book.fill",
  },
];

interface StyleSelectorProps {
  selectedStyle: FormattingStyle;
  onSelectStyle: (style: FormattingStyle) => void;
  compact?: boolean;
}

export function StyleSelector({
  selectedStyle,
  onSelectStyle,
  compact = false,
}: StyleSelectorProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {STYLE_OPTIONS.map((opt) => {
          const isSelected = selectedStyle === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => onSelectStyle(opt.key)}
              style={[
                styles.chip,
                isSelected ? styles.chipSelected : styles.chipUnselected,
                compact && styles.chipCompact,
              ]}
              activeOpacity={0.7}
            >
              <IconSymbol
                name={opt.icon}
                size={14}
                color={isSelected ? "#FFFFFF" : "#818CF8"}
              />
              <Text
                style={[
                  styles.chipText,
                  isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSelected: {
    backgroundColor: "#6366F1",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  chipUnselected: {
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  chipTextUnselected: {
    color: "#94A3B8",
  },
});
