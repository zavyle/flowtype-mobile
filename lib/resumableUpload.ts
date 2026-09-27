/**
 * Client-side metadata for FlowType's resumable binary upload protocol.
 * Audio chunks are uploaded independently, so an interrupted transfer can start
 * from the first missing chunk rather than retransmitting a long recording.
 */
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 18 * 1024 * 1024;
export const RESUMABLE_UPLOAD_CHUNK_BYTES = 6 * 1024 * 1024;

export type ResumableUploadStatus =
  | "pending"
  | "uploading"
  | "assembling"
  | "failed";

export interface ResumableUploadCheckpoint {
  uploadId: string;
  totalBytes: number;
  chunkSizeBytes: number;
  totalChunks: number;
  uploadedChunks: Record<string, string>;
  status: ResumableUploadStatus;
  lastError?: string;
  updatedAt: number;
}

export function getTotalChunks(totalBytes: number, chunkSizeBytes = RESUMABLE_UPLOAD_CHUNK_BYTES): number {
  return Math.max(1, Math.ceil(Math.max(0, totalBytes) / chunkSizeBytes));
}

export function shouldUseResumableUpload(fileSize: number): boolean {
  return fileSize >= RESUMABLE_UPLOAD_THRESHOLD_BYTES;
}

export function createResumableUploadCheckpoint(
  totalBytes: number,
  existing?: Partial<ResumableUploadCheckpoint> | null,
): ResumableUploadCheckpoint {
  const chunkSizeBytes = existing?.chunkSizeBytes || RESUMABLE_UPLOAD_CHUNK_BYTES;
  const totalChunks = getTotalChunks(totalBytes, chunkSizeBytes);
  const isCompatible =
    existing &&
    existing.totalBytes === totalBytes &&
    existing.chunkSizeBytes === chunkSizeBytes &&
    existing.totalChunks === totalChunks;

  return {
    uploadId: isCompatible && existing?.uploadId ? existing.uploadId : `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    totalBytes,
    chunkSizeBytes,
    totalChunks,
    uploadedChunks: isCompatible ? { ...(existing?.uploadedChunks ?? {}) } : {},
    status: "pending",
    updatedAt: Date.now(),
  };
}

export function getChunkRange(checkpoint: ResumableUploadCheckpoint, index: number): { position: number; length: number } {
  if (!Number.isInteger(index) || index < 0 || index >= checkpoint.totalChunks) {
    throw new Error(`Invalid upload chunk index: ${index}`);
  }
  const position = index * checkpoint.chunkSizeBytes;
  return {
    position,
    length: Math.min(checkpoint.chunkSizeBytes, checkpoint.totalBytes - position),
  };
}

export function getNextMissingChunk(checkpoint: ResumableUploadCheckpoint): number | null {
  for (let index = 0; index < checkpoint.totalChunks; index += 1) {
    if (!checkpoint.uploadedChunks[String(index)]) return index;
  }
  return null;
}

export function recordUploadedChunk(
  checkpoint: ResumableUploadCheckpoint,
  index: number,
  remoteKey: string,
): ResumableUploadCheckpoint {
  if (!remoteKey) throw new Error("FlowType did not receive a remote key for this audio chunk.");
  return {
    ...checkpoint,
    uploadedChunks: { ...checkpoint.uploadedChunks, [String(index)]: remoteKey },
    status: "uploading",
    lastError: undefined,
    updatedAt: Date.now(),
  };
}

export function markResumableUploadFailed(
  checkpoint: ResumableUploadCheckpoint,
  error: string,
): ResumableUploadCheckpoint {
  return { ...checkpoint, status: "failed", lastError: error, updatedAt: Date.now() };
}

export function toOrderedChunkKeys(checkpoint: ResumableUploadCheckpoint): string[] {
  const keys = Array.from({ length: checkpoint.totalChunks }, (_, index) => checkpoint.uploadedChunks[String(index)]);
  if (keys.some((key) => !key)) {
    throw new Error("FlowType cannot complete the upload because one or more audio chunks are still missing.");
  }
  return keys;
}

export function getUploadProgress(checkpoint: ResumableUploadCheckpoint): number {
  if (checkpoint.totalChunks <= 0) return 0;
  return Object.keys(checkpoint.uploadedChunks).length / checkpoint.totalChunks;
}
