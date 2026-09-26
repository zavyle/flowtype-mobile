import { describe, expect, it } from "vitest";
import { getIncomingShareSignature, selectIncomingAudioFile } from "../lib/incomingShare";

describe("incoming Android audio shares", () => {
  it("selects the first compatible audio payload and ignores unrelated files", () => {
    const audio = {
      path: "file:///cache/meeting.wav",
      fileName: "meeting.wav",
      mimeType: "application/octet-stream",
      size: 1024,
    };

    expect(selectIncomingAudioFile([
      { path: "file:///cache/photo.jpg", fileName: "photo.jpg", mimeType: "image/jpeg" },
      audio,
    ])).toEqual(audio);
  });

  it("rejects missing paths and unsupported file types", () => {
    expect(selectIncomingAudioFile([{ fileName: "voice.mp3", mimeType: "audio/mpeg" }])).toBeNull();
    expect(selectIncomingAudioFile([{ path: "file:///cache/notes.pdf", fileName: "notes.pdf", mimeType: "application/pdf" }])).toBeNull();
  });

  it("creates a stable signature so the same shared file is not imported twice", () => {
    const shared = {
      path: "file:///cache/voice.m4a",
      fileName: "voice.m4a",
      mimeType: "audio/mp4",
      size: 4000,
    };
    expect(getIncomingShareSignature(shared)).toBe("file:///cache/voice.m4a|voice.m4a|4000|audio/mp4");
  });
});
