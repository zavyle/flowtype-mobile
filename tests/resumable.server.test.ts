import { describe, expect, it } from "vitest";
import {
  assembleAudioChunks,
  assertValidUploadId,
  validateChunkKeys,
} from "../server/resumableUpload";

describe("FlowType resumable upload server guards", () => {
  it("assembles chunks byte-for-byte in their client order", () => {
    const audio = assembleAudioChunks([
      Buffer.from([1, 2, 3]),
      Buffer.from([4, 5]),
      Buffer.from([6]),
    ], 6);
    expect([...audio]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("rejects incomplete reconstructed recordings instead of transcribing corruption", () => {
    expect(() => assembleAudioChunks([Buffer.from([1, 2])], 3)).toThrow(/incomplete/i);
  });

  it("only accepts the current recording's stored chunk keys", () => {
    const uploadId = "upload_abc12345";
    const keys = [
      "voice/resumable/upload_abc12345/chunk-000_x.part",
      "voice/resumable/upload_abc12345/chunk-001_y.part",
    ];
    expect(validateChunkKeys(uploadId, keys, 10)).toEqual(keys);
    expect(() => validateChunkKeys(uploadId, ["voice/resumable/another/chunk.part"], 10)).toThrow(/does not belong/i);
    expect(() => assertValidUploadId("../../bad")).toThrow(/Invalid/i);
  });
});
