import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import {
  inferMimeType,
  sanitizeFilename,
  extractExtension,
  SUPPORTED_FORMATS,
  EXTENSION_TO_MIME,
  MIME_ALIASES,
} from "./audioFormat";

// Native imports travel through the resumable binary uploader, so they no
// longer need to be expanded into memory as base64. Keep a bounded but useful
// cap for several-hour speech recordings at the 32 kbps capture profile.
const MAX_IMPORT_BYTES = 180 * 1024 * 1024;

export interface ImportedAudioFile {
  name: string;
  uri: string;
  mimeType: string;
  size?: number;
  base64?: string;
}

export interface AudioImportSource {
  name?: string | null;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
  base64?: string | null;
}

async function readWebFileAsBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

/**
 * Validates and reads an audio file acquired through either the document picker
 * or Android's inbound share sheet. Expo Share Intent gives FlowType a cached
 * file URI, so the same safe import pipeline is used for both entry points.
 */
export async function importAudioFromUri(source: AudioImportSource): Promise<ImportedAudioFile> {
  if (!source.uri) throw new Error("FlowType did not receive an audio file URI.");

  if (source.size && source.size > MAX_IMPORT_BYTES) {
    throw new Error(
      "This recording is larger than FlowType's current 180 MB safe import limit. Export a shorter clip or a compressed M4A/MP3 file.",
    );
  }

  const name = sanitizeFilename(source.name, source.uri) || "Imported recording";
  const mimeType = inferMimeType(name, source.mimeType ?? undefined, source.uri);
  if (!mimeType) {
    throw new Error(
      `Unsupported audio format. FlowType supports: ${SUPPORTED_FORMATS}.`,
    );
  }

  const base64 = source.base64 || (Platform.OS === "web"
    ? await FileSystem.readAsStringAsync(source.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
    : undefined);

  if (Platform.OS === "web" && !base64) {
    throw new Error("FlowType could not read the selected audio file.");
  }

  return {
    name,
    uri: source.uri,
    mimeType,
    size: source.size ?? undefined,
    base64,
  };
}

export async function pickAudioRecording(): Promise<ImportedAudioFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["audio/*", "application/octet-stream"],
    copyToCacheDirectory: true,
    multiple: false,
    base64: Platform.OS === "web",
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) throw new Error("No audio file was selected.");

  let base64 = asset.base64;
  if (!base64 && Platform.OS === "web" && asset.file) {
    base64 = await readWebFileAsBase64(asset.file);
  }

  return importAudioFromUri({
    name: asset.name,
    uri: asset.uri,
    mimeType: asset.mimeType,
    size: asset.size,
    base64,
  });
}

export { inferMimeType, sanitizeFilename, extractExtension };
export { SUPPORTED_FORMATS, EXTENSION_TO_MIME, MIME_ALIASES };
