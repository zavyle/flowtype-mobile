import type { AirecConnectionProfile, AirecGattCharacteristicSummary } from "./airecBleUtils";

/**
 * AIREC GATT identifiers recovered from the official companion app. The file
 * listing flow only proceeds when this known TX/RX pair is actually exposed by
 * the connected recorder. No arbitrary writable characteristic is selected.
 */
export const AIREC_COMMAND_TX_UUID = "0011202a-2233-4455-6677-8899dfdedddc";
export const AIREC_COMMAND_RX_UUID = "0011203a-2233-4455-6677-8899dfdedddc";
export const AIREC_LEGACY_COMMAND_TX_UUID = "0000ae03-0000-1000-8000-00805f9b34fb";
export const AIREC_LEGACY_COMMAND_RX_UUID = "0000ae02-0000-1000-8000-00805f9b34fb";

export const AIREC_FRAME_HEADER = [0x55, 0xaa] as const;
export const AIREC_GET_FILES_COMMAND = 0x05;
export const AIREC_GET_FILES_COMPLETE = 0x06;
export const AIREC_GET_FILES_FAILED = 0xfe;
export const AIREC_MAX_FILE_LIST_ITEMS = 512;
export const AIREC_MAX_FRAME_PAYLOAD_BYTES = 252;

export interface AirecTransferChannel {
  serviceUuid: string;
  characteristicUuid: string;
  characteristic: AirecGattCharacteristicSummary;
}

export interface AirecFileListChannels {
  command: AirecTransferChannel;
  response: AirecTransferChannel;
  protocol: "primary" | "legacy";
}

export interface AirecProtocolFrame {
  key: number;
  payload: Uint8Array;
}

export interface AirecFrameExtraction {
  frames: AirecProtocolFrame[];
  remaining: Uint8Array;
}

export interface AirecRecorderFile {
  name: string;
  sizeBytes: number;
}

export interface AirecFileListResult {
  files: AirecRecorderFile[];
  protocol: "primary" | "legacy";
}

function normalizedUuid(value: string): string {
  return value.trim().toLowerCase();
}

function findCharacteristic(
  profile: AirecConnectionProfile,
  uuid: string,
  predicate: (characteristic: AirecGattCharacteristicSummary) => boolean,
): AirecTransferChannel | null {
  const expected = normalizedUuid(uuid);
  for (const service of profile.services) {
    const characteristic = service.characteristics.find(
      (candidate) => normalizedUuid(candidate.uuid) === expected && predicate(candidate),
    );
    if (characteristic) {
      return {
        serviceUuid: service.uuid,
        characteristicUuid: characteristic.uuid,
        characteristic,
      };
    }
  }
  return null;
}

/**
 * Returns a known, explicitly advertised command/notification pair. A missing
 * or mismatched profile yields null before any device write is attempted.
 */
export function findAirecFileListChannels(profile: AirecConnectionProfile): AirecFileListChannels | null {
  const pairs = [
    {
      protocol: "primary" as const,
      commandUuid: AIREC_COMMAND_TX_UUID,
      responseUuid: AIREC_COMMAND_RX_UUID,
    },
    {
      protocol: "legacy" as const,
      commandUuid: AIREC_LEGACY_COMMAND_TX_UUID,
      responseUuid: AIREC_LEGACY_COMMAND_RX_UUID,
    },
  ];

  for (const pair of pairs) {
    const command = findCharacteristic(
      profile,
      pair.commandUuid,
      (characteristic) => characteristic.writable || characteristic.writableWithoutResponse,
    );
    const response = findCharacteristic(
      profile,
      pair.responseUuid,
      (characteristic) => characteristic.notifiable,
    );

    if (command && response) {
      return { command, response, protocol: pair.protocol };
    }
  }

  return null;
}

/** The vendor's no-payload getFiles request: 55 AA 01 05. */
export function createAirecGetFilesRequest(): Uint8Array {
  return Uint8Array.from([...AIREC_FRAME_HEADER, 0x01, AIREC_GET_FILES_COMMAND]);
}

/**
 * Decodes a stream of vendor frames. Notifications can split a frame across
 * BLE packets or combine multiple frames, so the tail is returned for the
 * next callback. Invalid bytes are discarded until the next frame header.
 */
export function extractAirecFrames(bytes: Uint8Array): AirecFrameExtraction {
  const frames: AirecProtocolFrame[] = [];
  let offset = 0;

  while (offset + 3 <= bytes.length) {
    if (bytes[offset] !== AIREC_FRAME_HEADER[0] || bytes[offset + 1] !== AIREC_FRAME_HEADER[1]) {
      offset += 1;
      continue;
    }

    const payloadLength = bytes[offset + 2];
    if (payloadLength < 1 || payloadLength > AIREC_MAX_FRAME_PAYLOAD_BYTES) {
      offset += 1;
      continue;
    }

    const end = offset + 3 + payloadLength;
    if (end > bytes.length) break;

    frames.push({
      key: bytes[offset + 3],
      payload: bytes.slice(offset + 4, end),
    });
    offset = end;
  }

  return {
    frames,
    remaining: bytes.slice(offset),
  };
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
    if (!value || value.length > 240) return null;
    if (/\0|[\u0000-\u001f]|[\\/]/.test(value)) return null;
    return value;
  } catch {
    return null;
  }
}

/**
 * The vendor reads the filename as all bytes except the final signed 32-bit
 * integer. Its ByteArray decoder uses network (big-endian) byte order.
 */
export function parseAirecFileListEntry(payload: Uint8Array): AirecRecorderFile | null {
  if (payload.length < 5) return null;

  const name = decodeUtf8(payload.slice(0, -4));
  if (!name) return null;

  const view = new DataView(payload.buffer, payload.byteOffset + payload.length - 4, 4);
  const sizeBytes = view.getInt32(0, false);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) return null;

  return { name, sizeBytes };
}

export function appendAirecBytes(current: Uint8Array, incoming: Uint8Array): Uint8Array {
  const next = new Uint8Array(current.length + incoming.length);
  next.set(current, 0);
  next.set(incoming, current.length);
  return next;
}

export function addAirecFile(files: AirecRecorderFile[], candidate: AirecRecorderFile): AirecRecorderFile[] {
  if (files.length >= AIREC_MAX_FILE_LIST_ITEMS) return files;
  if (files.some((file) => file.name === candidate.name && file.sizeBytes === candidate.sizeBytes)) return files;
  return [...files, candidate];
}

export function formatAirecFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = sizeBytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[index]}`;
}
