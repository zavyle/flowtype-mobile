import * as FileSystem from "expo-file-system/legacy";

import { getApiBaseUrl } from "@/constants/oauth";
import type { FormattingStyle } from "./sessionStore";
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
}

export { type NativeTranscriptionResponse, parseNativeTranscriptionResponse };

/** Upload a local native audio file directly as bytes—never as a huge JSON/base64 payload. */
export async function uploadNativeAudioForTranscription(
  request: NativeTranscriptionRequest,
): Promise<NativeTranscriptionResponse> {
  const endpoint = new URL(`${getApiBaseUrl()}/api/voice/transcribe-upload`);
  endpoint.searchParams.set("language", request.language);
  endpoint.searchParams.set("style", request.style);
  endpoint.searchParams.set("vocabulary", JSON.stringify(request.customVocabulary));

  const response = await FileSystem.uploadAsync(endpoint.toString(), request.fileUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": request.mimeType },
  });

  return parseNativeTranscriptionResponse(response.status, response.body);
}
