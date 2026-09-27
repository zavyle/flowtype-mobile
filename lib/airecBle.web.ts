import type { AirecFileListResult } from "./airecFileTransfer";
import type {
  AirecConnectionProfile,
  AirecDeviceSummary,
  AirecTransferHint,
} from "./airecBleUtils";

export type AirecScanResult = AirecDeviceSummary;

const WEB_MESSAGE = "AIREC Bluetooth connection is available in the installed FlowType Android or iOS app, not the web preview.";

export class AirecBleClient {
  async scan(_onDevice: (device: AirecScanResult) => void): Promise<void> {
    throw new Error(WEB_MESSAGE);
  }

  async stopScan(): Promise<void> {}

  async connect(_deviceId: string): Promise<AirecConnectionProfile> {
    throw new Error(WEB_MESSAGE);
  }

  async inspectTransferProfile(_deviceId: string): Promise<AirecTransferHint> {
    throw new Error(WEB_MESSAGE);
  }

  async listRecorderFiles(
    _deviceId: string,
    _profile: AirecConnectionProfile,
  ): Promise<AirecFileListResult> {
    throw new Error(WEB_MESSAGE);
  }

  watchDisconnection(_deviceId: string, _onDisconnected: (message: string | null) => void): { remove: () => void } {
    return { remove: () => undefined };
  }

  async disconnect(_deviceId: string): Promise<void> {}

  async destroy(): Promise<void> {}
}
