import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

const MAX_IMPORT_BYTES = 35 * 1024 * 1024;

const EXTENSION_TO_MIME: Record<string, string> = {
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  mp4: "audio/mp4",
  mpeg: "audio/mpeg",
  mpga: "audio/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
};

const MIME_ALIASES: Record<string, string> = {
  "application/ogg": "audio/ogg",
  "audio/x-flac": "audio/flac",
  "audio/x-m4a": "audio/mp4",
  "audio/x-mp3": "audio/mpeg",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-wave": "audio/wav",
  "video/mp4": "audio/mp4",
};

const SUPPORTED_FORMATS = "FLAC, M4A, MP3, MP4, MPEG, MPGA, OGA, OGG, WAV, WEBM";

export interface ImportedAudioFile {
  name: string;
  uri: string;
  mimeType: string;
  size?: number;
  base64: string;
}

function inferMimeType(name: string, mimeType?: string | null): string | null {
  const normalizedMime = mimeType?.split(";", 1)[0]?.trim().toLowerCase();
  if (normalizedMime && normalizedMime !== "application/octet-stream") {
    return EXTENSION_TO_MIME[normalizedMime.replace(/^audio\//, "")] ?? MIME_ALIASES[normalizedMime] ?? null;
  }

  const extension = name.split(".").pop()?.toLowerCase();
  return extension ? EXTENSION_TO_MIME[extension] ?? null : null;
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

  const mimeType = inferMimeType(asset.name, asset.mimeType);
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
    name: asset.name,
    uri: asset.uri,
    mimeType,
    size: asset.size,
    base64,
  };
}

export { inferMimeType };
