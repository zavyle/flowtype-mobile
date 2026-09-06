import AsyncStorage from "@react-native-async-storage/async-storage";

export type FormattingStyle =
  | "clean_voice"
  | "raw_verbatim"
  | "executive_summary"
  | "bullet_points"
  | "email_draft"
  | "meeting_minutes";

export interface AudioChunk {
  id: string;
  chunkIndex: number;
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  rawText: string;
  audioUrl?: string;
  status: "recording" | "transcribing" | "completed" | "error";
}

export interface TranscriptionSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  duration: number; // in seconds
  isLongSession: boolean; // true if >30m or configured as multi-chunk
  chunks: AudioChunk[];
  rawText: string;
  formattedText: string;
  style: FormattingStyle;
  language: string;
  audioUrl?: string;
  wordCount: number;
  tags?: string[];
}

export interface UserSettings {
  defaultStyle: FormattingStyle;
  defaultLanguage: string;
  removeFillerWords: boolean;
  autoPunctuation: boolean;
  autoCopy: boolean;
  keepScreenAwake: boolean;
  longSessionChunkMinutes: number; // 5, 10, or 15 mins per chunk
  soundHaptics: boolean;
}

export interface CustomVocabularyItem {
  id: string;
  term: string;
  category: "tech" | "business" | "medical" | "names" | "custom";
  notes?: string;
}

const SESSIONS_KEY = "@flowtype_sessions_v1";
const SETTINGS_KEY = "@flowtype_settings_v1";
const VOCABULARY_KEY = "@flowtype_vocabulary_v1";

export const DEFAULT_SETTINGS: UserSettings = {
  defaultStyle: "clean_voice",
  defaultLanguage: "auto",
  removeFillerWords: true,
  autoPunctuation: true,
  autoCopy: false,
  keepScreenAwake: true,
  longSessionChunkMinutes: 10,
  soundHaptics: true,
};

export const DEFAULT_VOCABULARY: CustomVocabularyItem[] = [
  { id: "1", term: "Wispr Flow", category: "tech", notes: "Voice dictation model" },
  { id: "2", term: "tRPC", category: "tech", notes: "End-to-end typesafe APIs" },
  { id: "3", term: "Expo SDK 54", category: "tech", notes: "Mobile framework" },
  { id: "4", term: "NativeWind", category: "tech", notes: "Tailwind for React Native" },
  { id: "5", term: "SaaS ARR", category: "business", notes: "Annual recurring revenue" },
  { id: "6", term: "PostgreSQL", category: "tech", notes: "Relational database" },
  { id: "7", term: "Drizzle ORM", category: "tech", notes: "TypeScript ORM" },
  { id: "8", term: "Whisper STT", category: "tech", notes: "OpenAI speech model" },
];

const DEMO_TRANSCRIPT_MARKERS = [
  "Welcome to FlowType. This is an extended dictation session",
  "seamless voice capture exceeding 30 minutes with instant AI formatting",
];

function isDemoSession(session: TranscriptionSession): boolean {
  const searchableText = `${session.title} ${session.rawText} ${session.formattedText}`;
  return DEMO_TRANSCRIPT_MARKERS.some((marker) => searchableText.includes(marker));
}

export async function getSessions(): Promise<TranscriptionSession[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const realSessions = parsed.filter(
      (session): session is TranscriptionSession => session && typeof session === "object" && !isDemoSession(session),
    );

    if (realSessions.length !== parsed.length) {
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(realSessions));
    }
    return realSessions;
  } catch (error) {
    console.error("Failed to read sessions:", error);
    return [];
  }
}

export async function saveSession(session: TranscriptionSession): Promise<void> {
  try {
    const current = await getSessions();
    const index = current.findIndex((s) => s.id === session.id);
    let updated: TranscriptionSession[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = session;
    } else {
      updated = [session, ...current];
    }
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save session:", error);
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const current = await getSessions();
    const updated = current.filter((s) => s.id !== id);
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to delete session:", error);
  }
}

export async function getSessionById(id: string): Promise<TranscriptionSession | null> {
  const sessions = await getSessions();
  return sessions.find((s) => s.id === id) || null;
}

export async function getSettings(): Promise<UserSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

export async function getVocabulary(): Promise<CustomVocabularyItem[]> {
  try {
    const raw = await AsyncStorage.getItem(VOCABULARY_KEY);
    if (!raw) return DEFAULT_VOCABULARY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_VOCABULARY;
  } catch {
    return DEFAULT_VOCABULARY;
  }
}

export async function saveVocabulary(items: CustomVocabularyItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(VOCABULARY_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Failed to save vocabulary:", error);
  }
}

function getSampleSessions(): TranscriptionSession[] {
  return [
    {
      id: "session_long_sample_1",
      title: "Quarterly Strategy & Product Architecture Review",
      createdAt: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
      updatedAt: Date.now() - 1000 * 60 * 60 * 24,
      duration: 2740, // 45 minutes 40 seconds (exceeding 30m)
      isLongSession: true,
      chunks: [
        {
          id: "chk_1",
          chunkIndex: 0,
          startTime: 0,
          endTime: 900,
          duration: 900,
          rawText: "Welcome everyone to our Q3 strategy discussion. We need to evaluate our real-time voice pipeline.",
          status: "completed",
        },
        {
          id: "chk_2",
          chunkIndex: 1,
          startTime: 900,
          endTime: 1800,
          duration: 900,
          rawText: "Moving on to infrastructure, long audio recordings exceeding 30 minutes require rolling buffers and memory safeguards.",
          status: "completed",
        },
        {
          id: "chk_3",
          chunkIndex: 2,
          startTime: 1800,
          endTime: 2740,
          duration: 940,
          rawText: "Action items: verify low-latency Whisper STT with custom vocabulary and deploy our mobile release.",
          status: "completed",
        },
      ],
      rawText:
        "Welcome everyone to our Q3 strategy discussion. We need to evaluate our real-time voice pipeline. Moving on to infrastructure, long audio recordings exceeding 30 minutes require rolling buffers and memory safeguards. Action items: verify low-latency Whisper STT with custom vocabulary and deploy our mobile release.",
      formattedText:
        "### Executive Summary\nThe team convened to finalize the Q3 product roadmap with a primary focus on audio pipeline scaling and hands-free voice dictation.\n\n### Key Discussion Points\n1. **Long-Session Audio Pipeline**: Extended recording sessions beyond 30 minutes necessitate chunked memory architecture and resilient local recovery.\n2. **Whisper Transcription Accuracy**: Injected custom vocabulary items prevent mistranscription of technical acronyms.\n3. **Client Architecture**: Native mobile UX follows Apple HIG with instant haptics and keep-awake capabilities.\n\n### Action Items\n- [ ] Finalize chunk buffer thresholds for low-latency streaming\n- [ ] Deploy client build to Expo verification environment",
      style: "meeting_minutes",
      language: "en",
      wordCount: 84,
      tags: ["Strategy", "Long Session", "Engineering"],
    },
    {
      id: "session_quick_sample_2",
      title: "Product Launch Memo for Founders",
      createdAt: Date.now() - 1000 * 60 * 60 * 4, // 4 hours ago
      updatedAt: Date.now() - 1000 * 60 * 60 * 4,
      duration: 184, // 3 minutes 4 seconds
      isLongSession: false,
      chunks: [],
      rawText:
        "Hey team I just reviewed the latest build of FlowType and it feels as instantaneous as Wispr Flow. Make sure the clean voice style removes all filler words and properly auto-punctuates sentences before the beta testers get their hands on it.",
      formattedText:
        "Hey team,\n\nI just reviewed the latest build of FlowType, and it feels as instantaneous as Wispr Flow. Let's make sure the Clean Voice style removes all filler words and properly auto-punctuates sentences before the beta testers get their hands on it.\n\nBest,\nProduct Lead",
      style: "email_draft",
      language: "en",
      wordCount: 46,
      tags: ["Quick Dictation", "Product"],
    },
  ];
}
