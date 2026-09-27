import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import type { FormattingStyle } from "./sessionStore";
import type { ResumableUploadCheckpoint } from "./resumableUpload";

const LEGACY_PENDING_RECORDING_KEY = "@flowtype_pending_recording_v1";
const RECOVERY_VAULT_KEY = "@flowtype_recovery_vault_v2";
const RECOVERY_DIRECTORY = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ""}flowtype-recovery/`;
const MAX_VAULT_ITEMS = 20;

export interface PendingRecording {
  id: string;
  fileUri: string;
  fileSize: number;
  mimeType: string;
  duration: number;
  createdAt: number;
  updatedAt: number;
  source: "live" | "import";
  name: string;
  language: string;
  style: FormattingStyle;
  customVocabulary: string[];
  attempts: number;
  lastError?: string;
  upload?: ResumableUploadCheckpoint;
}

export interface RecoveryVaultSummary {
  count: number;
  totalBytes: number;
  failedCount: number;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("webm")) return "webm";
  return "m4a";
}

function sortNewestFirst(items: PendingRecording[]): PendingRecording[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function writeVault(items: PendingRecording[]): Promise<void> {
  await AsyncStorage.setItem(RECOVERY_VAULT_KEY, JSON.stringify(sortNewestFirst(items)));
}

async function migrateLegacyPendingRecording(): Promise<void> {
  const alreadyMigrated = await AsyncStorage.getItem(RECOVERY_VAULT_KEY);
  if (alreadyMigrated) return;

  const legacyRaw = await AsyncStorage.getItem(LEGACY_PENDING_RECORDING_KEY);
  if (!legacyRaw) {
    await writeVault([]);
    return;
  }

  try {
    const legacy = JSON.parse(legacyRaw) as Partial<PendingRecording>;
    if (!legacy.id || !legacy.fileUri) {
      await writeVault([]);
      return;
    }
    const fileInfo = await FileSystem.getInfoAsync(legacy.fileUri);
    if (!fileInfo.exists) {
      await writeVault([]);
      return;
    }
    const migrated: PendingRecording = {
      id: legacy.id,
      fileUri: legacy.fileUri,
      fileSize: fileInfo.size ?? 0,
      mimeType: legacy.mimeType || "audio/m4a",
      duration: legacy.duration || 0,
      createdAt: legacy.createdAt || Date.now(),
      updatedAt: Date.now(),
      source: legacy.source === "import" ? "import" : "live",
      name: legacy.name || "Recovered recording",
      language: legacy.language || "auto",
      style: legacy.style || "clean_voice",
      customVocabulary: Array.isArray(legacy.customVocabulary) ? legacy.customVocabulary : [],
      attempts: legacy.attempts || 0,
    };
    await writeVault([migrated]);
  } finally {
    await AsyncStorage.removeItem(LEGACY_PENDING_RECORDING_KEY);
  }
}

async function readVault(): Promise<PendingRecording[]> {
  await migrateLegacyPendingRecording();
  try {
    const raw = await AsyncStorage.getItem(RECOVERY_VAULT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingRecording[]) : [];
  } catch (error) {
    console.error("Failed to read Recovery Vault:", error);
    return [];
  }
}

async function removeMissingFiles(items: PendingRecording[]): Promise<PendingRecording[]> {
  const checks = await Promise.all(
    items.map(async (item) => ({ item, info: await FileSystem.getInfoAsync(item.fileUri).catch(() => ({ exists: false as const })) })),
  );
  const valid = checks.filter(({ info }) => info.exists).map(({ item, info }) => ({
    ...item,
    fileSize: item.fileSize || (info.exists ? info.size : 0) || 0,
  }));
  if (valid.length !== items.length) await writeVault(valid);
  return sortNewestFirst(valid);
}

export async function getPendingRecordings(): Promise<PendingRecording[]> {
  return removeMissingFiles(await readVault());
}

/** Backwards-compatible primary recovery item for existing Dictate retry UI. */
export async function getPendingRecording(id?: string): Promise<PendingRecording | null> {
  const items = await getPendingRecordings();
  if (id) return items.find((item) => item.id === id) ?? null;
  return items[0] ?? null;
}

export async function getRecoveryVaultSummary(): Promise<RecoveryVaultSummary> {
  const items = await getPendingRecordings();
  return {
    count: items.length,
    totalBytes: items.reduce((total, item) => total + Math.max(0, item.fileSize || 0), 0),
    failedCount: items.filter((item) => item.lastError || item.upload?.status === "failed").length,
  };
}

export async function persistPendingRecording(
  input: Omit<PendingRecording, "id" | "fileUri" | "fileSize" | "createdAt" | "updatedAt" | "attempts"> & { sourceUri: string },
): Promise<PendingRecording> {
  if (!input.sourceUri) throw new Error("FlowType could not find the completed recording file.");
  if (!RECOVERY_DIRECTORY) throw new Error("FlowType could not create a safe local recording folder.");

  const id = `recovery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const extension = extensionForMimeType(input.mimeType);
  const destination = `${RECOVERY_DIRECTORY}${id}.${extension}`;
  await FileSystem.makeDirectoryAsync(RECOVERY_DIRECTORY, { intermediates: true });
  await FileSystem.copyAsync({ from: input.sourceUri, to: destination });

  const info = await FileSystem.getInfoAsync(destination);
  if (!info.exists) throw new Error("FlowType could not save a local Recovery Vault copy of this recording.");

  const now = Date.now();
  const pending: PendingRecording = {
    id,
    fileUri: destination,
    fileSize: info.size ?? 0,
    mimeType: input.mimeType,
    duration: input.duration,
    createdAt: now,
    updatedAt: now,
    source: input.source,
    name: input.name,
    language: input.language,
    style: input.style,
    customVocabulary: input.customVocabulary,
    attempts: 0,
    lastError: undefined,
    upload: input.upload,
  };

  const existing = await getPendingRecordings();
  const overflow = existing.slice(MAX_VAULT_ITEMS - 1);
  await Promise.all(overflow.map((item) => FileSystem.deleteAsync(item.fileUri, { idempotent: true }).catch(() => undefined)));
  await writeVault([pending, ...existing.slice(0, MAX_VAULT_ITEMS - 1)]);
  return pending;
}

export async function updatePendingRecording(
  id: string,
  update: Partial<Pick<PendingRecording, "attempts" | "lastError" | "upload" | "name" | "language" | "style" | "customVocabulary">>,
): Promise<PendingRecording | null> {
  const items = await getPendingRecordings();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const updated: PendingRecording = { ...items[index], ...update, updatedAt: Date.now() };
  items[index] = updated;
  await writeVault(items);
  return updated;
}

export async function markPendingRecordingAttempt(id: string): Promise<PendingRecording | null> {
  const pending = await getPendingRecording(id);
  if (!pending) return null;
  return updatePendingRecording(id, { attempts: pending.attempts + 1, lastError: undefined });
}

export async function clearPendingRecording(id?: string): Promise<void> {
  const items = await getPendingRecordings();
  const target = id ? items.find((item) => item.id === id) : items[0];
  if (!target) return;

  await FileSystem.deleteAsync(target.fileUri, { idempotent: true }).catch(() => undefined);
  await writeVault(items.filter((item) => item.id !== target.id));
}

export async function clearAllPendingRecordings(): Promise<void> {
  const items = await getPendingRecordings();
  await Promise.all(items.map((item) => FileSystem.deleteAsync(item.fileUri, { idempotent: true }).catch(() => undefined)));
  await writeVault([]);
}
