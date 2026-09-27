import { PermissionsAndroid, Platform } from "react-native";
import {
  BleManager,
  ConnectionPriority,
  State,
  type Characteristic,
  type Device,
  type Subscription,
} from "react-native-ble-plx";

import {
  AIREC_GET_FILES_COMMAND,
  AIREC_GET_FILES_COMPLETE,
  AIREC_GET_FILES_FAILED,
  addAirecFile,
  appendAirecBytes,
  createAirecGetFilesRequest,
  extractAirecFrames,
  findAirecFileListChannels,
  parseAirecFileListEntry,
  type AirecFileListResult,
  type AirecRecorderFile,
} from "./airecFileTransfer";
import {
  extractAirecTransferHint,
  type AirecConnectionProfile,
  type AirecDeviceSummary,
  type AirecGattCharacteristicSummary,
  type AirecGattServiceSummary,
  type AirecTransferHint,
} from "./airecBleUtils";

export type AirecScanResult = AirecDeviceSummary;

export type { AirecFileListResult } from "./airecFileTransfer";

let manager: BleManager | null = null;

function getManager(): BleManager {
  manager ??= new BleManager();
  return manager;
}

function toSummary(device: Device): AirecScanResult {
  return {
    id: device.id,
    name: device.name,
    localName: device.localName,
    rssi: device.rssi,
    serviceUUIDs: device.serviceUUIDs,
  };
}

function asMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "Bluetooth could not complete that operation.";
}

function decodeBase64Text(value: string | null): string | null {
  if (!value) return null;

  try {
    const bytes = globalThis.atob(value);
    if (!bytes || bytes.length > 512) return null;
    const printable = Array.from(bytes).filter((char) => {
      const code = char.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
    }).length;

    // Binary payloads are deliberately ignored; this flow only reads clear text
    // that a recorder explicitly exposes in a readable characteristic.
    if (printable / bytes.length < 0.92) return null;
    return bytes;
  } catch {
    return null;
  }
}

function decodeBase64Bytes(value: string | null): Uint8Array | null {
  if (!value) return null;
  try {
    const decoded = globalThis.atob(value);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function encodeBase64Bytes(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return globalThis.btoa(value);
}

function removeSubscription(subscription: Subscription | null): void {
  subscription?.remove();
}

async function requestAndroidBluetoothPermissions(): Promise<void> {
  if (Platform.OS !== "android") return;

  const apiLevel = Number(Platform.Version);
  const permissions =
    apiLevel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const result = await PermissionsAndroid.requestMultiple(permissions);
  const denied = permissions.filter((permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED);
  if (denied.length > 0) {
    throw new Error("Bluetooth permission is required to find and connect your recorder.");
  }
}

export class AirecBleClient {
  private scanActive = false;
  private readonly connectedDevices = new Map<string, Device>();

  async scan(onDevice: (device: AirecScanResult) => void): Promise<void> {
    const ble = getManager();
    await requestAndroidBluetoothPermissions();

    const state = await ble.state();
    if (state !== State.PoweredOn) {
      throw new Error("Turn on Bluetooth, then try scanning again.");
    }

    await this.stopScan();
    this.scanActive = true;
    await ble.startDeviceScan(null, { allowDuplicates: false, legacyScan: false }, (error, device) => {
      if (error) {
        this.scanActive = false;
        return;
      }
      if (device) onDevice(toSummary(device));
    });
  }

  async stopScan(): Promise<void> {
    if (!this.scanActive) return;
    this.scanActive = false;
    await getManager().stopDeviceScan();
  }

  async connect(deviceId: string): Promise<AirecConnectionProfile> {
    await this.stopScan();
    const ble = getManager();

    try {
      let device = await ble.connectToDevice(deviceId, { autoConnect: false, requestMTU: 185 });
      device = await device.discoverAllServicesAndCharacteristics();

      if (Platform.OS === "android") {
        device = await device.requestConnectionPriority(ConnectionPriority.High).catch(() => device);
      }

      const services = await device.services();
      const summaries: AirecGattServiceSummary[] = await Promise.all(
        services.map(async (service) => {
          const characteristics = await device.characteristicsForService(service.uuid);
          return {
            uuid: service.uuid,
            characteristics: characteristics.map(
              (characteristic): AirecGattCharacteristicSummary => ({
                uuid: characteristic.uuid,
                readable: characteristic.isReadable,
                writable: characteristic.isWritableWithResponse,
                writableWithoutResponse: characteristic.isWritableWithoutResponse,
                notifiable: characteristic.isNotifiable,
              }),
            ),
          };
        }),
      );

      this.connectedDevices.set(device.id, device);
      return {
        deviceId: device.id,
        deviceName: device.name?.trim() || device.localName?.trim() || "AIREC recorder",
        rssi: device.rssi,
        services: summaries,
      };
    } catch (error) {
      throw new Error(asMessage(error));
    }
  }

  /**
   * Reads only characteristics advertised by the recorder as readable. It
   * never subscribes, writes, enables transfer, or retains a passphrase.
   */
  async inspectTransferProfile(deviceId: string): Promise<AirecTransferHint> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) throw new Error("Reconnect the recorder before inspecting its transfer profile.");

    try {
      const services = await device.services();
      let readableCharacteristicCount = 0;
      let readableValueCount = 0;
      let detected: Pick<AirecTransferHint, "advertisedSsid" | "security" | "sourceCharacteristic"> | null = null;

      for (const service of services) {
        const characteristics = await device.characteristicsForService(service.uuid);
        const readable = characteristics.filter((characteristic): characteristic is Characteristic => characteristic.isReadable);
        readableCharacteristicCount += readable.length;

        for (const characteristic of readable) {
          const readValue = await characteristic.read().catch(() => null);
          const text = decodeBase64Text(readValue?.value ?? null);
          if (!text) continue;

          readableValueCount += 1;
          const hint = extractAirecTransferHint(text, characteristic.uuid);
          if (hint?.advertisedSsid || hint?.security) {
            detected = hint;
            break;
          }
        }

        if (detected) break;
      }

      return {
        readableCharacteristicCount,
        readableValueCount,
        advertisedSsid: detected?.advertisedSsid ?? null,
        security: detected?.security ?? null,
        sourceCharacteristic: detected?.sourceCharacteristic ?? null,
      };
    } catch (error) {
      throw new Error(asMessage(error));
    }
  }

  /**
   * Lists recordings through AIREC's verified BLE getFiles command only.
   * It does not start Wi-Fi/TCP sync, download audio, delete a file, alter
   * recorder settings, or write to any characteristic except the vendor's
   * known command channel.
   */
  async listRecorderFiles(
    deviceId: string,
    profile: AirecConnectionProfile,
  ): Promise<AirecFileListResult> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) throw new Error("Reconnect the recorder before listing its recordings.");

    const channels = findAirecFileListChannels(profile);
    if (!channels) {
      throw new Error(
        "This recorder does not expose AIREC's verified file-list command and response channels. No command was sent.",
      );
    }

    let buffered: Uint8Array<ArrayBufferLike> = new Uint8Array();
    let files: AirecRecorderFile[] = [];
    let subscription: Subscription | null = null;

    try {
      return await new Promise<AirecFileListResult>((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          finish(() =>
            reject(
              new Error(
                "The recorder did not finish its file list within 45 seconds. It remains unchanged; reconnect and try again.",
              ),
            ),
          );
        }, 45_000);

        const finish = (callback: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          removeSubscription(subscription);
          callback();
        };

        subscription = device.monitorCharacteristicForService(
          channels.response.serviceUuid,
          channels.response.characteristicUuid,
          (error, characteristic) => {
            if (error) {
              finish(() => reject(new Error(asMessage(error))));
              return;
            }

            const incoming = decodeBase64Bytes(characteristic?.value ?? null);
            if (!incoming) return;

            const extracted = extractAirecFrames(appendAirecBytes(buffered, incoming));
            buffered = extracted.remaining;

            for (const frame of extracted.frames) {
              if (frame.key === AIREC_GET_FILES_COMMAND) {
                const file = parseAirecFileListEntry(frame.payload);
                if (file) files = addAirecFile(files, file);
              }

              if (frame.key === AIREC_GET_FILES_FAILED) {
                finish(() => reject(new Error("The AIREC recorder declined the file-list request. No files were changed.")));
                return;
              }

              if (frame.key === AIREC_GET_FILES_COMPLETE) {
                finish(() => resolve({ files, protocol: channels.protocol }));
                return;
              }
            }
          },
          `flowtype-airec-file-list-${deviceId}`,
        );

        const request = encodeBase64Bytes(createAirecGetFilesRequest());
        const write = channels.command.characteristic.writable
          ? device.writeCharacteristicWithResponseForService(
              channels.command.serviceUuid,
              channels.command.characteristicUuid,
              request,
            )
          : device.writeCharacteristicWithoutResponseForService(
              channels.command.serviceUuid,
              channels.command.characteristicUuid,
              request,
            );

        void write.catch((error: unknown) => {
          finish(() => reject(new Error(asMessage(error))));
        });
      });
    } catch (error) {
      throw new Error(asMessage(error));
    } finally {
      removeSubscription(subscription);
    }
  }

  watchDisconnection(deviceId: string, onDisconnected: (message: string | null) => void): Subscription {
    return getManager().onDeviceDisconnected(deviceId, (error) => {
      this.connectedDevices.delete(deviceId);
      onDisconnected(error ? asMessage(error) : null);
    });
  }

  async disconnect(deviceId: string): Promise<void> {
    await getManager().cancelDeviceConnection(deviceId);
    this.connectedDevices.delete(deviceId);
  }

  async destroy(): Promise<void> {
    await this.stopScan();
    this.connectedDevices.clear();
  }
}
