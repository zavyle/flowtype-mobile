import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import type { FormattingStyle } from "./sessionStore";

const PENDING_RECORDING_KEY = "@flowtype_pending_recording_v1";
const RECOVERY_DIRECTORY = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ""}flowtype-recovery/`;

export interface PendingRecording {
  id: string;
  fileUri: string;
  mimeType: string;
  duration: number;
  createdAt: number;
  source: "live" | "import";
  name: string;
  language: string;
  style: FormattingStyle;
  customVocabulary: string[];
  attempts: number;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("webm")) return "webm";
  return "m4a";
}

export async function getPendingRecording(): Promise<PendingRecording | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_RECORDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRecording;
    if (!parsed?.fileUri || !parsed?.id) return null;

    const info = await FileSystem.getInfoAsync(parsed.fileUri);
    if (!info.exists) {
      await AsyncStorage.removeItem(PENDING_RECORDING_KEY);
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("Failed to load recoverable recording:", error);
    return null;
  }
}

export async function persistPendingRecording(input: Omit<PendingRecording, "id" | "fileUri" | "createdAt" | "attempts"> & { sourceUri: string }): Promise<PendingRecording> {
  if (!input.sourceUri) throw new Error("FlowType could not find the completed recording file.");
  if (!RECOVERY_DIRECTORY) throw new Error("FlowType could not create a safe local recording folder.");

  const id = `recovery_${Date.now()}`;
  const extension = extensionForMimeType(input.mimeType);
  const destination = `${RECOVERY_DIRECTORY}${id}.${extension}`;
  await FileSystem.makeDirectoryAsync(RECOVERY_DIRECTORY, { intermediates: true });
  await FileSystem.copyAsync({ from: input.sourceUri, to: destination });

  const info = await FileSystem.getInfoAsync(destination);
  if (!info.exists) throw new Error("FlowType could not save a local recovery copy of this recording.");

  const pending: PendingRecording = {
    id,
    fileUri: destination,
    mimeType: input.mimeType,
    duration: input.duration,
    createdAt: Date.now(),
    source: input.source,
    name: input.name,
    language: input.language,
    style: input.style,
    customVocabulary: input.customVocabulary,
    attempts: 0,
  };
  await AsyncStorage.setItem(PENDING_RECORDING_KEY, JSON.stringify(pending));
  return pending;
}

export async function markPendingRecordingAttempt(id: string): Promise<PendingRecording | null> {
  const pending = await getPendingRecording();
  if (!pending || pending.id !== id) return pending;
  const updated = { ...pending, attempts: pending.attempts + 1 };
  await AsyncStorage.setItem(PENDING_RECORDING_KEY, JSON.stringify(updated));
  return updated;
}

export async function clearPendingRecording(id?: string): Promise<void> {
  const pending = await getPendingRecording();
  if (!pending || (id && pending.id !== id)) return;

  await AsyncStorage.removeItem(PENDING_RECORDING_KEY);
  await FileSystem.deleteAsync(pending.fileUri, { idempotent: true }).catch(() => undefined);
}
