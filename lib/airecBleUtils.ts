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

export type AirecWifiSecurity = "WPA2" | "WPA3" | "Open" | "Unknown";

/**
 * A non-sensitive, read-only discovery result. Passwords are intentionally
 * never retained, rendered, copied, or returned to JavaScript UI state.
 */
export interface AirecTransferHint {
  readableCharacteristicCount: number;
  readableValueCount: number;
  advertisedSsid: string | null;
  security: AirecWifiSecurity | null;
  sourceCharacteristic: string | null;
}

const RECORDER_NAME_PATTERN = /(airec|jnn|recorder|voice\s*rec|ai\s*rec)/i;
const SSID_PATTERN = /(?:ssid|hotspot(?:\s*name)?)\s*[:=]\s*([A-Za-z0-9][A-Za-z0-9 ._\-]{1,31})/i;
const SECURITY_PATTERN = /(?:security|encryption|auth)\s*[:=]\s*(wpa\s*3|wpa\s*2|open|none)/i;

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

function securityFromText(value: string): AirecWifiSecurity | null {
  const match = value.match(SECURITY_PATTERN)?.[1]?.replace(/\s/g, "").toUpperCase();
  if (match === "WPA2") return "WPA2";
  if (match === "WPA3") return "WPA3";
  if (match === "OPEN" || match === "NONE") return "Open";
  return null;
}

/**
 * Parses only the network identifier and security label from a printable GATT
 * value. Deliberately does not parse or expose passphrases.
 */
export function extractAirecTransferHint(
  readableValue: string,
  characteristicUuid: string,
): Pick<AirecTransferHint, "advertisedSsid" | "security" | "sourceCharacteristic"> | null {
  const normalized = readableValue.replace(/\0/g, " ").trim();
  const ssid = normalized.match(SSID_PATTERN)?.[1]?.trim() ?? null;
  const security = securityFromText(normalized);

  if (!ssid && !security) return null;
  return {
    advertisedSsid: ssid,
    security,
    sourceCharacteristic: characteristicUuid,
  };
}
