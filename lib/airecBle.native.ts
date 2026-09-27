import { PermissionsAndroid, Platform } from "react-native";
import {
  BleManager,
  ConnectionPriority,
  State,
  type Device,
  type Subscription,
} from "react-native-ble-plx";

import type {
  AirecConnectionProfile,
  AirecDeviceSummary,
  AirecGattCharacteristicSummary,
  AirecGattServiceSummary,
} from "./airecBleUtils";

export type AirecScanResult = AirecDeviceSummary;

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

  watchDisconnection(deviceId: string, onDisconnected: (message: string | null) => void): Subscription {
    return getManager().onDeviceDisconnected(deviceId, (error) => {
      onDisconnected(error ? asMessage(error) : null);
    });
  }

  async disconnect(deviceId: string): Promise<void> {
    await getManager().cancelDeviceConnection(deviceId);
  }

  async destroy(): Promise<void> {
    await this.stopScan();
  }
}
