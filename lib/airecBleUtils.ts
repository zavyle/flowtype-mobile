export interface AirecDeviceSummary {
  id: string;
  name: string | null;
  localName: string | null;
  rssi: number | null;
  serviceUUIDs: string[] | null;
}

export interface AirecGattCharacteristicSummary {
  uuid: string;
  readable: boolean;
  writable: boolean;
  writableWithoutResponse: boolean;
  notifiable: boolean;
}

export interface AirecGattServiceSummary {
  uuid: string;
  characteristics: AirecGattCharacteristicSummary[];
}

export interface AirecConnectionProfile {
  deviceId: string;
  deviceName: string;
  rssi: number | null;
  services: AirecGattServiceSummary[];
}

const RECORDER_NAME_PATTERN = /(airec|jnn|recorder|voice\s*rec|ai\s*rec)/i;

export function getAirecDeviceLabel(device: AirecDeviceSummary): string {
  const preferredName = device.name?.trim() || device.localName?.trim();
  return preferredName || `Nearby recorder (${device.id.slice(-5).toUpperCase()})`;
}

export function isLikelyAirecRecorder(device: AirecDeviceSummary): boolean {
  return RECORDER_NAME_PATTERN.test(`${device.name ?? ""} ${device.localName ?? ""}`);
}

export function formatRssi(rssi: number | null): string {
  if (rssi === null || !Number.isFinite(rssi)) return "Signal unavailable";
  if (rssi >= -55) return "Strong signal";
  if (rssi >= -70) return "Good signal";
  if (rssi >= -85) return "Weak signal";
  return "Very weak signal";
}

export function getWritableCharacteristicCount(profile: AirecConnectionProfile): number {
  return profile.services.reduce(
    (total, service) =>
      total + service.characteristics.filter(
        (characteristic) => characteristic.writable || characteristic.writableWithoutResponse,
      ).length,
    0,
  );
}

export function getProfileSummary(profile: AirecConnectionProfile): string {
  const characteristicCount = profile.services.reduce(
    (total, service) => total + service.characteristics.length,
    0,
  );
  const writableCount = getWritableCharacteristicCount(profile);
  return `${profile.services.length} services • ${characteristicCount} characteristics • ${writableCount} writable`;
}
