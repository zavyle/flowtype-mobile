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

const MAX_IMPORT_BYTES = 35 * 1024 * 1024;

export interface ImportedAudioFile {
  name: string;
  uri: string;
  mimeType: string;
  size?: number;
  base64: string;
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

export async function pickAudioRecording(): Promise<ImportedAudioFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["audio/*", "application/octet-stream"],
    copyToCacheDirectory: true,
    multiple: false,
    base64: true,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) throw new Error("No audio file was selected.");

  if (asset.size && asset.size > MAX_IMPORT_BYTES) {
    throw new Error(
      "This recording is larger than 35 MB. Export a shorter clip or a compressed M4A/MP3 file for this first import flow.",
    );
  }

  const mimeType = inferMimeType(asset.name, asset.mimeType, asset.uri);
  if (!mimeType) {
    throw new Error(
      `Unsupported audio format. FlowType supports: ${SUPPORTED_FORMATS}.`,
    );
  }

  let base64 = asset.base64;

  if (!base64 && Platform.OS === "web" && asset.file) {
    base64 = await readWebFileAsBase64(asset.file);
  }

  if (!base64) {
    base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  if (!base64) throw new Error("FlowType could not read the selected audio file.");

  return {
    name: sanitizeFilename(asset.name, asset.uri) || "Imported recording",
    uri: asset.uri,
    mimeType,
    size: asset.size,
    base64,
  };
}

export { inferMimeType, sanitizeFilename, extractExtension };
export { SUPPORTED_FORMATS, EXTENSION_TO_MIME, MIME_ALIASES };
