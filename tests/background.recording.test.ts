import { describe, expect, it } from "vitest";
import {
  createRecordingAudioMode,
  shouldHandleBackgroundStop,
} from "../lib/backgroundRecording";

describe("background recording policy", () => {
  it("enables native background recording only for Android and iOS", () => {
    expect(createRecordingAudioMode("android")).toEqual({
      allowsRecording: true,
      playsInSilentMode: true,
      allowsBackgroundRecording: true,
    });
    expect(createRecordingAudioMode("ios").allowsBackgroundRecording).toBe(true);
    expect(createRecordingAudioMode("web").allowsBackgroundRecording).toBe(false);
  });

  it("handles an Android notification Stop action exactly once", () => {
    const input = {
      appThinksRecording: true,
      appThinksPaused: false,
      nativeRecorderIsRecording: false,
      nativeRecorderUrl: "file:///cache/recording.m4a",
      recordingWasStarted: true,
      stoppingFromInAppButton: false,
      completionAlreadyHandled: false,
    };

    expect(shouldHandleBackgroundStop(input)).toBe(true);
    expect(
      shouldHandleBackgroundStop({ ...input, stoppingFromInAppButton: true }),
    ).toBe(false);
    expect(
      shouldHandleBackgroundStop({ ...input, completionAlreadyHandled: true }),
    ).toBe(false);
  });

  it("still accepts Stop after a pause, but not an incomplete recording", () => {
    const input = {
      appThinksRecording: true,
      appThinksPaused: true,
      nativeRecorderIsRecording: false,
      nativeRecorderUrl: "file:///cache/recording.m4a",
      recordingWasStarted: true,
      stoppingFromInAppButton: false,
      completionAlreadyHandled: false,
    };

    expect(shouldHandleBackgroundStop(input)).toBe(true);
    expect(
      shouldHandleBackgroundStop({ ...input, nativeRecorderUrl: null, appThinksPaused: false }),
    ).toBe(false);
  });
});
