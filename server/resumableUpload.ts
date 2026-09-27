export const MAX_RESUMABLE_CHUNK_BYTES = 7 * 1024 * 1024;
export const MAX_RESUMABLE_RECORDING_BYTES = 180 * 1024 * 1024;

export function assertValidUploadId(uploadId: string): void {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(uploadId)) {
    throw new Error("Invalid resumable upload identifier.");
  }
}

export function validateChunkKeys(uploadId: string, chunkKeys: unknown, expectedTotalBytes: unknown): string[] {
  if (!Array.isArray(chunkKeys) || chunkKeys.length === 0 || chunkKeys.some((key) => typeof key !== "string" || !key)) {
    throw new Error("No complete set of audio upload chunks was provided.");
  }
  if (chunkKeys.length > 64) throw new Error("This recording has too many upload chunks.");
  const prefix = `voice/resumable/${uploadId}/`;
  if (chunkKeys.some((key) => !(key as string).startsWith(prefix))) {
    throw new Error("An upload chunk does not belong to this recording.");
  }
  if (typeof expectedTotalBytes !== "number" || !Number.isFinite(expectedTotalBytes) || expectedTotalBytes <= 0) {
    throw new Error("Invalid recording size.");
  }
  if (expectedTotalBytes > MAX_RESUMABLE_RECORDING_BYTES) {
    throw new Error("This recording exceeds FlowType's current 180 MB resumable-upload safety limit.");
  }
  return chunkKeys;
}

export function assembleAudioChunks(chunks: Buffer[], expectedTotalBytes: number): Buffer {
  const total = chunks.reduce((size, chunk) => size + chunk.length, 0);
  if (total !== expectedTotalBytes) {
    throw new Error(`The recovered upload is incomplete (${total} of ${expectedTotalBytes} bytes). Retry to resend only the missing chunks.`);
  }
  return Buffer.concat(chunks, total);
}
