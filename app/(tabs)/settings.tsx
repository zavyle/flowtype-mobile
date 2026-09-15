import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  UserSettings,
  getSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  FormattingStyle,
} from "@/lib/sessionStore";
import { STYLE_OPTIONS } from "@/components/style-selector";

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      const loaded = await getSettings();
      setSettings(loaded);
    })();
  }, []);

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await saveSettings(updated);
  };

  return (
    <ScreenContainer className="px-4 pb-2" style={{ paddingTop: 18 }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings & Preferences</Text>
          <Text style={styles.headerSubtitle}>
            Tune FlowType dictation, 30m+ session safeguards, and defaults
          </Text>
        </View>

        {/* Extended 30m+ Long Session Architecture */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="clock.fill" size={16} color="#A855F7" />
            <Text style={styles.sectionTitle}>30M+ EXTENDED RECORDING ENGINE</Text>
          </View>

          <View style={styles.card}>
            {/* Rolling Chunk Duration */}
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>Rolling Chunk Interval</Text>
                <Text style={styles.rowSub}>
                  Segments audio in the background so recordings never crash or run out of memory
                </Text>
              </View>
            </View>
            <View style={styles.chunkPillsRow}>
              {[5, 10, 15, 20].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.chunkPill,
                    settings.longSessionChunkMinutes === mins && styles.chunkPillActive,
                  ]}
                  onPress={() => updateSetting("longSessionChunkMinutes", mins)}
                >
                  <Text
                    style={[
                      styles.chunkPillText,
                      settings.longSessionChunkMinutes === mins && styles.chunkPillTextActive,
                    ]}
                  >
                    {mins} mins
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Prevent Screen Sleep */}
            <View style={[styles.row, styles.divider]}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>Keep Screen Awake (WakeLock)</Text>
                <Text style={styles.rowSub}>
                  Prevents device from sleeping during multi-hour lectures and meetings
                </Text>
              </View>
              <Switch
                value={settings.keepScreenAwake}
                onValueChange={(val) => updateSetting("keepScreenAwake", val)}
                trackColor={{ false: "#242938", true: "#6366F1" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Wispr Flow Formatting Engine */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="sparkles" size={16} color="#818CF8" />
            <Text style={styles.sectionTitle}>DEFAULT AI FORMATTING STYLE</Text>
          </View>

          <View style={styles.card}>
            {STYLE_OPTIONS.map((opt, idx) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.styleRow, idx > 0 && styles.divider]}
                onPress={() => updateSetting("defaultStyle", opt.key as FormattingStyle)}
              >
                <View style={styles.styleRowInfo}>
                  <Text style={styles.rowLabel}>{opt.label}</Text>
                  <Text style={styles.rowSub}>{opt.subtitle}</Text>
                </View>
                {settings.defaultStyle === opt.key && (
                  <IconSymbol name="checkmark" size={18} color="#6366F1" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Smart Audio & Dictation Rules */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="slider.horizontal.3" size={16} color="#34D399" />
            <Text style={styles.sectionTitle}>DICTATION BEHAVIOR</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>Remove Filler Words</Text>
                <Text style={styles.rowSub}>
                  Filters out &quot;um&quot;, &quot;uh&quot;, &quot;like&quot;, &quot;you know&quot;, and stuttered syllables
                </Text>
              </View>
              <Switch
                value={settings.removeFillerWords}
                onValueChange={(val) => updateSetting("removeFillerWords", val)}
                trackColor={{ false: "#242938", true: "#10B981" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.row, styles.divider]}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>Intelligent Punctuation</Text>
                <Text style={styles.rowSub}>
                  Auto-formats question marks, commas, and natural sentence boundaries
                </Text>
              </View>
              <Switch
                value={settings.autoPunctuation}
                onValueChange={(val) => updateSetting("autoPunctuation", val)}
                trackColor={{ false: "#242938", true: "#10B981" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.row, styles.divider]}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>Auto-Copy to Clipboard</Text>
                <Text style={styles.rowSub}>
                  Copies polished text automatically right after recording finishes
                </Text>
              </View>
              <Switch
                value={settings.autoCopy}
                onValueChange={(val) => updateSetting("autoCopy", val)}
                trackColor={{ false: "#242938", true: "#10B981" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* System & Architecture Info */}
        <View style={styles.systemInfoCard}>
          <Text style={styles.systemInfoTitle}>About FlowType Architecture</Text>
          <Text style={styles.systemInfoText}>
            Built with Expo SDK 54, React Native 0.81, OpenAI Whisper Speech Recognition, and built-in LLM rewriting pipelines. Engineered to overcome the 30-minute ceiling of traditional dictation apps through rolling memory buffers and local persistence.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
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
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1.1,
  },
  card: {
    backgroundColor: "#181B26",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#242938",
    padding: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowInfo: {
    flex: 1,
    paddingRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    marginTop: 14,
    paddingTop: 14,
  },
  chunkPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  chunkPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
  },
  chunkPillActive: {
    backgroundColor: "#6366F1",
    borderColor: "#818CF8",
  },
  chunkPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
  },
  chunkPillTextActive: {
    color: "#FFFFFF",
  },
  styleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  styleRowInfo: {
    flex: 1,
  },
  systemInfoCard: {
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
  },
  systemInfoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#818CF8",
    marginBottom: 4,
  },
  systemInfoText: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 18,
  },
});
