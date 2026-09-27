import { describe, expect, it } from "vitest";
import {
  RESUMABLE_UPLOAD_CHUNK_BYTES,
  createResumableUploadCheckpoint,
  getChunkRange,
  getNextMissingChunk,
  getTotalChunks,
  getUploadProgress,
  recordUploadedChunk,
  shouldUseResumableUpload,
  toOrderedChunkKeys,
} from "../lib/resumableUpload";

describe("FlowType resumable audio upload checkpoints", () => {
  it("splits a 90-minute-size recording into bounded upload chunks", () => {
    const size = RESUMABLE_UPLOAD_CHUNK_BYTES * 3 + 123;
    const checkpoint = createResumableUploadCheckpoint(size);

    expect(shouldUseResumableUpload(size)).toBe(true);
    expect(getTotalChunks(size)).toBe(4);
    expect(checkpoint.totalChunks).toBe(4);
    expect(getChunkRange(checkpoint, 3)).toEqual({
      position: RESUMABLE_UPLOAD_CHUNK_BYTES * 3,
      length: 123,
    });
  });

  it("resumes from the first missing remote chunk without losing progress", () => {
    const checkpoint = createResumableUploadCheckpoint(RESUMABLE_UPLOAD_CHUNK_BYTES * 3);
    const afterFirst = recordUploadedChunk(checkpoint, 0, "voice/resumable/upload_demo/chunk-000_a.part");
    const afterThird = recordUploadedChunk(afterFirst, 2, "voice/resumable/upload_demo/chunk-002_c.part");

    expect(getNextMissingChunk(afterThird)).toBe(1);
    expect(getUploadProgress(afterThird)).toBeCloseTo(2 / 3);

    const resumed = recordUploadedChunk(afterThird, 1, "voice/resumable/upload_demo/chunk-001_b.part");
    expect(getNextMissingChunk(resumed)).toBeNull();
    expect(toOrderedChunkKeys(resumed)).toEqual([
      "voice/resumable/upload_demo/chunk-000_a.part",
      "voice/resumable/upload_demo/chunk-001_b.part",
      "voice/resumable/upload_demo/chunk-002_c.part",
    ]);
  });

  it("keeps short recordings on the proven direct upload path", () => {
    expect(shouldUseResumableUpload(1024 * 1024)).toBe(false);
  });
});
