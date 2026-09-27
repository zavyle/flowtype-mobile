import type { TranscriptionSession, FormattingStyle } from "./sessionStore";
import type { NativeTranscriptionResponse } from "./transcriptionResponse";

export function createTranscriptionSession(input: {
  response: NativeTranscriptionResponse;
  duration: number;
  style: FormattingStyle;
  language: string;
  name: string;
  source?: "live" | "import";
  isLongSession?: boolean;
}): TranscriptionSession {
  const sessionId = `${input.source === "import" ? "import" : "session"}_${Date.now()}`;
  const rawText = input.response.rawText.trim();
  const formattedText = input.response.formattedText.trim();
  const duration = Math.max(1, input.duration || input.response.duration || 0);

  return {
    id: sessionId,
    title: rawText.slice(0, 48).trim() + (rawText.length > 48 ? "..." : "") || input.name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    duration,
    isLongSession: Boolean(input.isLongSession || duration > 1800),
    chunks: [
      {
        id: `${sessionId}_chunk_0`,
        chunkIndex: 0,
        startTime: 0,
        endTime: duration,
        duration,
        rawText,
        audioUrl: input.response.audioUrl,
        status: "completed",
      },
    ],
    rawText,
    formattedText,
    style: input.style,
    language: input.language,
    audioUrl: input.response.audioUrl,
    wordCount: formattedText.split(/\s+/).filter(Boolean).length,
  };
}
