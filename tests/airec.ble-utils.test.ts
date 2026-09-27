import { describe, expect, it } from "vitest";

import {
  formatRssi,
  getAirecDeviceLabel,
  getProfileSummary,
  isLikelyAirecRecorder,
  type AirecConnectionProfile,
} from "../lib/airecBleUtils";

describe("AIREC Bluetooth device helpers", () => {
  it("identifies common recorder advertisement names", () => {
    expect(isLikelyAirecRecorder({ id: "A1", name: "AIREC-9C2B", localName: null, rssi: -61, serviceUUIDs: null })).toBe(true);
    expect(isLikelyAirecRecorder({ id: "B2", name: null, localName: "JNN Voice Recorder", rssi: -61, serviceUUIDs: null })).toBe(true);
    expect(isLikelyAirecRecorder({ id: "C3", name: "Living Room TV", localName: null, rssi: -61, serviceUUIDs: null })).toBe(false);
  });

  it("uses a privacy-safe fallback label for unnamed devices", () => {
    expect(getAirecDeviceLabel({ id: "AA:BB:CC:DD:EE", name: null, localName: null, rssi: null, serviceUUIDs: null })).toBe("Nearby recorder (DD:EE)");
  });

  it("formats signal strength without exposing unreliable raw values", () => {
    expect(formatRssi(-48)).toBe("Strong signal");
    expect(formatRssi(-67)).toBe("Good signal");
    expect(formatRssi(-82)).toBe("Weak signal");
    expect(formatRssi(null)).toBe("Signal unavailable");
  });

  it("summarizes a discovered profile before any protocol write", () => {
    const profile: AirecConnectionProfile = {
      deviceId: "A1",
      deviceName: "AIREC-9C2B",
      rssi: -56,
      services: [
        { uuid: "180f", characteristics: [{ uuid: "2a19", readable: true, writable: false, writableWithoutResponse: false, notifiable: true }] },
        { uuid: "1234", characteristics: [{ uuid: "5678", readable: false, writable: true, writableWithoutResponse: false, notifiable: false }] },
      ],
    };

    expect(getProfileSummary(profile)).toBe("2 services • 2 characteristics • 1 writable");
  });
});
