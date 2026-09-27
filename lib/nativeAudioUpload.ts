import * as FileSystem from "expo-file-system/legacy";

import { getApiBaseUrl } from "@/constants/oauth";
import type { FormattingStyle } from "./sessionStore";
import {
  createResumableUploadCheckpoint,
  getChunkRange,
  getNextMissingChunk,
  markResumableUploadFailed,
  recordUploadedChunk,
  shouldUseResumableUpload,
  toOrderedChunkKeys,
  type ResumableUploadCheckpoint,
} from "./resumableUpload";
import {
  parseNativeTranscriptionResponse,
  type NativeTranscriptionResponse,
} from "./transcriptionResponse";

export interface NativeTranscriptionRequest {
  fileUri: string;
  mimeType: string;
  language: string;
  style: FormattingStyle;
  customVocabulary: string[];
  resumableCheckpoint?: ResumableUploadCheckpoint;
  onUploadCheckpoint?: (checkpoint: ResumableUploadCheckpoint) => Promise<void> | void;
}

export { type NativeTranscriptionResponse, parseNativeTranscriptionResponse };

const CHUNK_CACHE_DIRECTORY = `${FileSystem.cacheDirectory ?? ""}flowtype-upload-chunks/`;

function buildEndpoint(path: string): URL {
  return new URL(`${getApiBaseUrl()}${path}`);
}

function withTranscriptionOptions(endpoint: URL, request: NativeTranscriptionRequest): URL {
  endpoint.searchParams.set("language", request.language);
  endpoint.searchParams.set("style", request.style);
  endpoint.searchParams.set("vocabulary", JSON.stringify(request.customVocabulary));
  return endpoint;
}

async function parseChunkResponse(status: number, body: string): Promise<{ key: string }> {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`FlowType could not save an upload chunk (HTTP ${status}). Your recording remains safely in the Recovery Vault.`);
  }
  const record = payload as { key?: unknown; error?: { message?: unknown } };
  if (status < 200 || status >= 300 || typeof record.key !== "string") {
    const reason = typeof record.error?.message === "string" ? record.error.message : `HTTP ${status}`;
    throw new Error(`FlowType could not save an upload chunk: ${reason}. Your recording remains safely in the Recovery Vault.`);
  }
  return { key: record.key };
}

async function uploadSingleNativeAudio(request: NativeTranscriptionRequest): Promise<NativeTranscriptionResponse> {
  const endpoint = withTranscriptionOptions(buildEndpoint("/api/voice/transcribe-upload"), request);
  const response = await FileSystem.uploadAsync(endpoint.toString(), request.fileUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": request.mimeType },
  });
  return parseNativeTranscriptionResponse(response.status, response.body);
}

async function writeTemporaryChunk(fileUri: string, position: number, length: number, uploadId: string, index: number): Promise<string> {
  if (!CHUNK_CACHE_DIRECTORY) throw new Error("FlowType could not create a temporary upload chunk.");
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  if (!base64) throw new Error(`FlowType could not read audio chunk ${index + 1}.`);

  await FileSystem.makeDirectoryAsync(CHUNK_CACHE_DIRECTORY, { intermediates: true });
  const chunkUri = `${CHUNK_CACHE_DIRECTORY}${uploadId}_${index}.part`;
  await FileSystem.writeAsStringAsync(chunkUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return chunkUri;
}

async function uploadResumableNativeAudio(request: NativeTranscriptionRequest, fileSize: number): Promise<NativeTranscriptionResponse> {
  let checkpoint = createResumableUploadCheckpoint(fileSize, request.resumableCheckpoint);
  await request.onUploadCheckpoint?.(checkpoint);

  try {
    for (let index = getNextMissingChunk(checkpoint); index !== null; index = getNextMissingChunk(checkpoint)) {
      const range = getChunkRange(checkpoint, index);
      const chunkUri = await writeTemporaryChunk(request.fileUri, range.position, range.length, checkpoint.uploadId, index);
      try {
        const endpoint = buildEndpoint(`/api/voice/resumable-uploads/${encodeURIComponent(checkpoint.uploadId)}/chunks/${index}`);
        const response = await FileSystem.uploadAsync(endpoint.toString(), chunkUri, {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            "Content-Type": request.mimeType,
            "X-FlowType-Chunk-Size": String(range.length),
            "X-FlowType-Total-Chunks": String(checkpoint.totalChunks),
          },
        });
        const { key } = await parseChunkResponse(response.status, response.body);
        checkpoint = recordUploadedChunk(checkpoint, index, key);
        await request.onUploadCheckpoint?.(checkpoint);
      } finally {
        await FileSystem.deleteAsync(chunkUri, { idempotent: true }).catch(() => undefined);
      }
    }

    checkpoint = { ...checkpoint, status: "assembling", updatedAt: Date.now(), lastError: undefined };
    await request.onUploadCheckpoint?.(checkpoint);
    const completeEndpoint = withTranscriptionOptions(
      buildEndpoint(`/api/voice/resumable-uploads/${encodeURIComponent(checkpoint.uploadId)}/complete`),
      request,
    );
    const response = await fetch(completeEndpoint.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mimeType: request.mimeType,
        totalBytes: checkpoint.totalBytes,
        chunkKeys: toOrderedChunkKeys(checkpoint),
      }),
    });
    return parseNativeTranscriptionResponse(response.status, await response.text());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resumable upload failed.";
    checkpoint = markResumableUploadFailed(checkpoint, message);
    await request.onUploadCheckpoint?.(checkpoint);
    throw error;
  }
}

/**
 * Upload a local native audio file. Short recordings preserve the established
 * one-request path. Larger files are split into 6 MB chunks and checkpointed
 * after every successful chunk, allowing retry after a weak connection or app restart.
 */
export async function uploadNativeAudioForTranscription(
  request: NativeTranscriptionRequest,
): Promise<NativeTranscriptionResponse> {
  const info = await FileSystem.getInfoAsync(request.fileUri);
  if (!info.exists) throw new Error("The protected audio file is no longer available on this device.");
  const fileSize = info.size ?? 0;
  if (fileSize <= 0) throw new Error("The protected audio file is empty and cannot be transcribed.");

  if (!shouldUseResumableUpload(fileSize)) {
    return uploadSingleNativeAudio(request);
  }
  return uploadResumableNativeAudio(request, fileSize);
}
