import { describe, expect, it } from "vitest";

import { extractAirecTransferHint } from "../lib/airecBleUtils";

describe("AIREC transfer hint extraction", () => {
  it("extracts an explicitly advertised hotspot name and WPA security", () => {
    expect(
      extractAirecTransferHint(
        "quick_transfer_ssid=AIREC_9C2B; security=WPA2",
        "abcd",
      ),
    ).toEqual({
      advertisedSsid: "AIREC_9C2B",
      security: "WPA2",
      sourceCharacteristic: "abcd",
    });
  });

  it("does not infer a hotspot from unrelated readable text", () => {
    expect(extractAirecTransferHint("battery=92; firmware=2.6.8", "abcd")).toBeNull();
  });

  it("keeps a security-only device indication without exposing any credential", () => {
    expect(extractAirecTransferHint("security: WPA3", "abcd")).toEqual({
      advertisedSsid: null,
      security: "WPA3",
      sourceCharacteristic: "abcd",
    });
  });
});
