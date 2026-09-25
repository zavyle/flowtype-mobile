import { describe, expect, it } from "vitest";
import { inferMimeType, extractExtension, sanitizeFilename } from "../lib/audioFormat";

describe("Audio import format resolution", () => {
  it("infers WAV correctly for Android content URIs and vendor MIME types", () => {
    expect(inferMimeType("recording_001.WAV", "audio/vnd.wave")).toBe("audio/wav");
    expect(inferMimeType("recording_001.wav", "application/octet-stream")).toBe("audio/wav");
    expect(inferMimeType("REC001.WAV?token=123", "audio/x-wav")).toBe("audio/wav");
    expect(
      inferMimeType("", "application/octet-stream", "content://media/external/audio/media/1000.wav")
    ).toBe("audio/wav");
  });

  it("infers MP3, M4A, and FLAC for aliased and raw recorder outputs", () => {
    expect(inferMimeType("voice_note.mp3", "audio/mp3")).toBe("audio/mpeg");
    expect(inferMimeType("voice_note.m4a", "audio/x-m4a")).toBe("audio/mp4");
    expect(inferMimeType("lecture.flac", "audio/x-flac")).toBe("audio/flac");
  });

  it("sanitizes filenames and extracts clean extensions", () => {
    expect(sanitizeFilename("meeting%20notes.wav?t=1")).toBe("meeting notes.wav");
    expect(extractExtension("meeting%20notes.WAV?t=1")).toBe("wav");
  });
});
