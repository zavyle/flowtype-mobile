import { describe, expect, it } from "vitest";
import { clampPlaybackRatio, formatPlaybackTime } from "../lib/playbackUtils";

describe("session audio player timing", () => {
  it("formats elapsed and total playback times consistently", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(65.9)).toBe("1:05");
    expect(formatPlaybackTime(-3)).toBe("0:00");
  });

  it("keeps playback progress within the visual track", () => {
    expect(clampPlaybackRatio(15, 60)).toBe(0.25);
    expect(clampPlaybackRatio(75, 60)).toBe(1);
    expect(clampPlaybackRatio(2, 0)).toBe(0);
  });
});
