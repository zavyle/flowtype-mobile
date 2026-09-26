export function formatPlaybackTime(value: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function clampPlaybackRatio(currentTime: number, duration: number): number {
  if (!duration || duration <= 0) return 0;
  return Math.max(0, Math.min(1, currentTime / duration));
}
