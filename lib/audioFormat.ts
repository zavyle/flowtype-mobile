export const EXTENSION_TO_MIME: Record<string, string> = {
  aac: "audio/aac",
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

export const MIME_ALIASES: Record<string, string> = {
  "application/ogg": "audio/ogg",
  "application/x-ogg": "audio/ogg",
  "audio/aac": "audio/aac",
  "audio/x-flac": "audio/flac",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/mp3": "audio/mpeg",
  "audio/x-mp3": "audio/mpeg",
  "audio/mpeg3": "audio/mpeg",
  "audio/x-mpeg-3": "audio/mpeg",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-wave": "audio/wav",
  "audio/x-pn-wav": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "video/mp4": "audio/mp4",
};

export const SUPPORTED_FORMATS = "FLAC, M4A, MP3, MP4, MPEG, MPGA, OGA, OGG, WAV, WEBM";

export function sanitizeFilename(name?: string | null, uri?: string | null): string {
  let candidate = (name || "").trim();
  if (!candidate && uri) {
    try {
      const parsed = new URL(uri);
      candidate = parsed.pathname.split("/").pop() || "";
    } catch {
      candidate = uri.split("/").pop() || "";
    }
  }
  candidate = candidate.split("?")[0].split("#")[0];
  try {
    candidate = decodeURIComponent(candidate);
  } catch {}
  return candidate;
}

export function extractExtension(name?: string | null, uri?: string | null): string | null {
  const filename = sanitizeFilename(name, uri);
  const parts = filename.split(".");
  if (parts.length > 1) {
    const ext = parts.pop()?.toLowerCase().trim();
    if (ext && /^[a-z0-9]+$/.test(ext)) {
      return ext;
    }
  }
  return null;
}

export function inferMimeType(
  name: string,
  mimeType?: string | null,
  uri?: string | null,
): string | null {
  const extension = extractExtension(name, uri);
  if (extension && EXTENSION_TO_MIME[extension]) {
    return EXTENSION_TO_MIME[extension];
  }

  const normalizedMime = mimeType?.split(";", 1)[0]?.trim().toLowerCase();
  if (normalizedMime && normalizedMime !== "application/octet-stream") {
    const direct = EXTENSION_TO_MIME[normalizedMime.replace(/^audio\//, "")];
    if (direct) return direct;
    const alias = MIME_ALIASES[normalizedMime];
    if (alias) return alias;
  }

  return null;
}
