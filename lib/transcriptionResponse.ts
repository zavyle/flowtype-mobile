export interface NativeTranscriptionResponse {
  rawText: string;
  formattedText: string;
  language: string;
  duration: number;
  audioUrl: string;
  segments: Array<{ start: number; end: number; text: string }>;
}

export function parseNativeTranscriptionResponse(status: number, body: string): NativeTranscriptionResponse {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    const preview = body.replace(/\s+/g, " ").slice(0, 80);
    throw new Error(
      `FlowType could not reach its transcription service (HTTP ${status}). Your audio is saved safely; tap Retry transcription after checking your connection.${preview ? ` Server reply: ${preview}` : ""}`,
    );
  }

  const record = payload as { error?: { message?: string }; rawText?: unknown; formattedText?: unknown };
  if (status < 200 || status >= 300 || record.error) {
    throw new Error(record.error?.message || `Transcription failed (HTTP ${status}). Your audio is saved safely; try again.`);
  }
  if (typeof record.rawText !== "string" || typeof record.formattedText !== "string") {
    throw new Error("Transcription service returned an incomplete response. Your audio is saved safely; please retry.");
  }
  return payload as NativeTranscriptionResponse;
}
