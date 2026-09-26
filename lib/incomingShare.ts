import { inferMimeType } from "./audioFormat";

export interface IncomingSharedFile {
  path?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
}

export function selectIncomingAudioFile(
  files: IncomingSharedFile[] | null | undefined,
): IncomingSharedFile | null {
  if (!files?.length) return null;

  return files.find((file) => {
    const path = file.path;
    if (!path) return false;
    return Boolean(inferMimeType(file.fileName ?? "", file.mimeType ?? undefined, path));
  }) ?? null;
}

export function getIncomingShareSignature(file: IncomingSharedFile): string {
  return [file.path ?? "", file.fileName ?? "", file.size ?? "", file.mimeType ?? ""].join("|");
}
