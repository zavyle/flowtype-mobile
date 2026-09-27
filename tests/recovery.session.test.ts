import { describe, expect, it } from "vitest";
import { createTranscriptionSession } from "../lib/transcriptionSession";

describe("Recovery Vault transcription completion", () => {
  it("creates a normal History session after a recovered long recording succeeds", () => {
    const session = createTranscriptionSession({
      response: {
        rawText: "a recovered hour long meeting recording",
        formattedText: "A recovered hour-long meeting recording.",
        language: "en",
        duration: 3665,
        audioUrl: "/manus-storage/recovered.m4a",
        segments: [],
      },
      duration: 3665,
      style: "meeting_minutes",
      language: "en",
      name: "Board meeting",
      source: "live",
    });

    expect(session.isLongSession).toBe(true);
    expect(session.duration).toBe(3665);
    expect(session.chunks).toHaveLength(1);
    expect(session.formattedText).toContain("hour-long");
  });

  it("uses the original protected file name when speech text is unavailable", () => {
    const session = createTranscriptionSession({
      response: { rawText: "", formattedText: "", language: "en", duration: 10, audioUrl: "", segments: [] },
      duration: 10,
      style: "raw_verbatim",
      language: "en",
      name: "AIREC_lecture.wav",
      source: "import",
    });
    expect(session.title).toBe("AIREC_lecture.wav");
  });
});
