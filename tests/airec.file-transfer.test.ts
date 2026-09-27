import { describe, expect, it } from "vitest";

import {
  AIREC_COMMAND_RX_UUID,
  AIREC_COMMAND_TX_UUID,
  addAirecFile,
  createAirecGetFilesRequest,
  extractAirecFrames,
  findAirecFileListChannels,
  parseAirecFileListEntry,
} from "../lib/airecFileTransfer";
import type { AirecConnectionProfile } from "../lib/airecBleUtils";

const verifiedProfile: AirecConnectionProfile = {
  deviceId: "AIREC-test",
  deviceName: "AIREC(BLE)",
  rssi: -48,
  services: [
    {
      uuid: "00112000-2233-4455-6677-8899dfdedddc",
      characteristics: [
        {
          uuid: AIREC_COMMAND_TX_UUID,
          readable: false,
          writable: true,
          writableWithoutResponse: true,
          notifiable: false,
        },
        {
          uuid: AIREC_COMMAND_RX_UUID,
          readable: false,
          writable: false,
          writableWithoutResponse: false,
          notifiable: true,
        },
      ],
    },
  ],
};

function getFilesFrame(payload: Uint8Array): Uint8Array {
  return Uint8Array.from([0x55, 0xaa, payload.length + 1, 0x05, ...payload]);
}

describe("AIREC recorder file-list protocol", () => {
  it("uses only the recovered no-payload getFiles request", () => {
    expect([...createAirecGetFilesRequest()]).toEqual([0x55, 0xaa, 0x01, 0x05]);
  });

  it("requires the exact verified writable TX and notifiable RX pair", () => {
    const channels = findAirecFileListChannels(verifiedProfile);
    expect(channels?.protocol).toBe("primary");
    expect(channels?.command.characteristicUuid.toLowerCase()).toBe(AIREC_COMMAND_TX_UUID);
    expect(channels?.response.characteristicUuid.toLowerCase()).toBe(AIREC_COMMAND_RX_UUID);

    const unknown = structuredClone(verifiedProfile);
    unknown.services[0].characteristics[0].uuid = "00001234-0000-1000-8000-00805f9b34fb";
    expect(findAirecFileListChannels(unknown)).toBeNull();
  });

  it("buffers a fragmented response and decodes the vendor filename plus big-endian size", () => {
    const name = new TextEncoder().encode("AIREC_20260928_0615.m4a");
    const payload = Uint8Array.from([...name, 0x00, 0x01, 0xe2, 0x40]);
    const frame = getFilesFrame(payload);

    const partial = extractAirecFrames(frame.slice(0, 8));
    expect(partial.frames).toHaveLength(0);
    expect([...partial.remaining]).toEqual([...frame.slice(0, 8)]);

    const complete = extractAirecFrames(Uint8Array.from([...partial.remaining, ...frame.slice(8)]));
    expect(complete.frames).toHaveLength(1);
    const file = parseAirecFileListEntry(complete.frames[0].payload);
    expect(file).toEqual({ name: "AIREC_20260928_0615.m4a", sizeBytes: 123456 });
  });

  it("keeps file-list entries unique and never adds more than the safe cap", () => {
    const first = { name: "note.m4a", sizeBytes: 42 };
    expect(addAirecFile([], first)).toEqual([first]);
    expect(addAirecFile([first], first)).toEqual([first]);
  });
});
