import { describe, expect, it } from "vitest";
import { parseNativeTranscriptionResponse } from "../lib/transcriptionResponse";

describe("native transcription response validation", () => {
  it("turns an HTML gateway response into a retry-safe error", () => {
    expect(() => parseNativeTranscriptionResponse(502, "<html><body>Bad Gateway</body></html>")).toThrow(
      /saved safely.*Retry transcription/i,
    );
  });

  it("preserves a server transcription error message", () => {
    expect(() => parseNativeTranscriptionResponse(502, JSON.stringify({
      error: { code: "TRANSCRIPTION_FAILED", message: "Whisper is temporarily unavailable." },
    }))).toThrow("Whisper is temporarily unavailable.");
  });

  it("accepts a complete successful transcription", () => {
    const response = parseNativeTranscriptionResponse(200, JSON.stringify({
      rawText: "testing",
      formattedText: "Testing.",
      language: "en",
      duration: 1,
      audioUrl: "/manus-storage/voice.m4a",
      segments: [],
    }));
    expect(response.formattedText).toBe("Testing.");
  });
});
