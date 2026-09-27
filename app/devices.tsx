import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AirecBleClient, type AirecScanResult } from "@/lib/airecBle";
import { formatAirecFileSize, type AirecFileListResult } from "@/lib/airecFileTransfer";
import {
  formatRssi,
  getAirecDeviceLabel,
  getProfileSummary,
  isLikelyAirecRecorder,
  type AirecConnectionProfile,
  type AirecTransferHint,
} from "@/lib/airecBleUtils";

function describeError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "FlowType could not connect to the recorder.";
}

export default function DevicesScreen() {
  const router = useRouter();
  const clientRef = useRef(new AirecBleClient());
  const disconnectSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const [devices, setDevices] = useState<AirecScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AirecConnectionProfile | null>(null);
  const [transferHint, setTransferHint] = useState<AirecTransferHint | null>(null);
  const [isInspectingTransfer, setIsInspectingTransfer] = useState(false);
  const [fileListResult, setFileListResult] = useState<AirecFileListResult | null>(null);
  const [isListingFiles, setIsListingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);

  const stopScan = useCallback(async () => {
    await clientRef.current.stopScan();
    setIsScanning(false);
  }, []);

  const startScan = useCallback(async () => {
    setError(null);
    setDisconnectMessage(null);
    setDevices([]);
    setProfile(null);
    setTransferHint(null);
    setFileListResult(null);
    disconnectSubscriptionRef.current?.remove();
    disconnectSubscriptionRef.current = null;

    try {
      setIsScanning(true);
      await clientRef.current.scan((device) => {
        setDevices((current) => {
          const existingIndex = current.findIndex((item) => item.id === device.id);
          const next = existingIndex >= 0
            ? current.map((item, index) => (index === existingIndex ? device : item))
            : [...current, device];
          return next.sort((left, right) => {
            const nameOrder = Number(isLikelyAirecRecorder(right)) - Number(isLikelyAirecRecorder(left));
            if (nameOrder !== 0) return nameOrder;
            return (right.rssi ?? -999) - (left.rssi ?? -999);
          });
        });
      });
    } catch (scanError) {
      setIsScanning(false);
      setError(describeError(scanError));
    }
  }, []);

  const connect = useCallback(async (device: AirecScanResult) => {
    setError(null);
    setDisconnectMessage(null);
    setConnectingId(device.id);
    try {
      const connectedProfile = await clientRef.current.connect(device.id);
      setProfile(connectedProfile);
      setTransferHint(null);
      setFileListResult(null);
      disconnectSubscriptionRef.current?.remove();
      disconnectSubscriptionRef.current = clientRef.current.watchDisconnection(device.id, (message) => {
        setProfile(null);
        setTransferHint(null);
        setFileListResult(null);
        setDisconnectMessage(
          message
            ? `Recorder disconnected: ${message}`
            : "Recorder disconnected.",
        );
      });
    } catch (connectionError) {
      setError(describeError(connectionError));
    } finally {
      setConnectingId(null);
      setIsScanning(false);
    }
  }, []);

  const inspectTransferProfile = useCallback(async () => {
    if (!profile) return;
    setError(null);
    setIsInspectingTransfer(true);
    try {
      const hint = await clientRef.current.inspectTransferProfile(profile.deviceId);
      setTransferHint(hint);
    } catch (inspectionError) {
      setError(describeError(inspectionError));
    } finally {
      setIsInspectingTransfer(false);
    }
  }, [profile]);

  const listRecorderFiles = useCallback(async () => {
    if (!profile) return;
    setError(null);
    setIsListingFiles(true);
    try {
      const result = await clientRef.current.listRecorderFiles(profile.deviceId, profile);
      setFileListResult(result);
    } catch (listingError) {
      setError(describeError(listingError));
    } finally {
      setIsListingFiles(false);
    }
  }, [profile]);

  const disconnect = useCallback(async () => {
    if (!profile) return;
    try {
      await clientRef.current.disconnect(profile.deviceId);
      disconnectSubscriptionRef.current?.remove();
      disconnectSubscriptionRef.current = null;
      setProfile(null);
      setTransferHint(null);
      setFileListResult(null);
      setDisconnectMessage("Recorder disconnected.");
    } catch (disconnectError) {
      setError(describeError(disconnectError));
    }
  }, [profile]);

  const shareDiagnostics = useCallback(async () => {
    if (!profile) return;
    const details = profile.services
      .map((service) => `${service.uuid}\n${service.characteristics.map((item) => `  • ${item.uuid} [R:${item.readable ? 1 : 0} W:${item.writable || item.writableWithoutResponse ? 1 : 0} N:${item.notifiable ? 1 : 0}]`).join("\n")}`)
      .join("\n\n");

    await Share.share({
      title: "FlowType AIREC connection diagnostic",
      message: `FlowType connected to ${profile.deviceName}\n${getProfileSummary(profile)}\nRead-only transfer inspection: ${transferHint ? `${transferHint.readableValueCount}/${transferHint.readableCharacteristicCount} readable characteristics returned printable data; hotspot ${transferHint.advertisedSsid ? "identifier detected" : "identifier not exposed"}.` : "not run"}\n\n${details}`,
    });
  }, [profile, transferHint]);

  useEffect(() => {
    const client = clientRef.current;
    return () => {
      disconnectSubscriptionRef.current?.remove();
      void client.destroy();
    };
  }, []);

  return (
    <ScreenContainer edges={["left", "right", "bottom"]} className="px-4">
      <Stack.Screen options={{ headerShown: true, title: "AIREC Recorder", headerShadowVisible: false }} />
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}><IconSymbol name="waveform" size={26} color="#A5B4FC" /></View>
              <View style={styles.heroCopy}>
                <Text style={styles.title}>Connect your AIREC recorder</Text>
                <Text style={styles.subtitle}>
                  Turn on the recorder, keep it nearby, then scan. FlowType reads the Bluetooth profile safely before any file transfer.
                </Text>
              </View>
            </View>

            {profile ? (
              <View style={styles.connectedCard}>
                <View style={styles.cardHeading}>
                  <View style={styles.connectedDot} />
                  <Text style={styles.connectedTitle}>Connected to {profile.deviceName}</Text>
                </View>
                <Text style={styles.connectedMeta}>{getProfileSummary(profile)}</Text>
                <Text style={styles.safetyText}>
                  Check whether this recorder exposes a Quick Transfer Wi-Fi profile through a readable characteristic. FlowType does not write, subscribe, or send undocumented commands.
                </Text>
                <View style={styles.fileListSection}>
                  <Text style={styles.fileListIntro}>
                    Recording list uses AIREC’s verified Bluetooth getFiles command only. It does not start Wi-Fi, download audio, delete recordings, or change the recorder.
                  </Text>
                  <TouchableOpacity
                    style={[styles.fileListButton, isListingFiles && styles.inspectButtonDisabled]}
                    onPress={() => void listRecorderFiles()}
                    disabled={isListingFiles}
                    activeOpacity={0.82}
                  >
                    {isListingFiles ? <ActivityIndicator color="#DCFCE7" /> : <IconSymbol name="folder.fill" size={16} color="#DCFCE7" />}
                    <Text style={styles.fileListButtonText}>
                      {isListingFiles ? "Reading recorder list…" : "List recordings on AIREC"}
                    </Text>
                  </TouchableOpacity>
                  {fileListResult ? (
                    <View style={styles.fileListResult}>
                      <Text style={styles.transferResultTitle}>
                        {fileListResult.files.length} recording{fileListResult.files.length === 1 ? "" : "s"} found
                      </Text>
                      <Text style={styles.transferResultText}>
                        Verified {fileListResult.protocol} AIREC Bluetooth response. Files remain safely on the recorder.
                      </Text>
                      {fileListResult.files.slice(0, 12).map((file) => (
                        <View key={`${file.name}-${file.sizeBytes}`} style={styles.fileRow}>
                          <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                          <Text style={styles.fileSize}>{formatAirecFileSize(file.sizeBytes)}</Text>
                        </View>
                      ))}
                      {fileListResult.files.length > 12 ? (
                        <Text style={styles.moreFilesText}>Showing the first 12 of {fileListResult.files.length} recordings.</Text>
                      ) : null}
                      <Text style={styles.transferNextStep}>
                        Audio download needs the recorder’s Wi-Fi/TCP session. This screen first proves the exact file list without risking the 64 GB archive; the next build will add download only after this list is confirmed on your recorder.
                      </Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[styles.inspectButton, isInspectingTransfer && styles.inspectButtonDisabled]}
                  onPress={() => void inspectTransferProfile()}
                  disabled={isInspectingTransfer}
                  activeOpacity={0.82}
                >
                  {isInspectingTransfer ? <ActivityIndicator color="#DBEAFE" /> : <IconSymbol name="magnifyingglass" size={16} color="#DBEAFE" />}
                  <Text style={styles.inspectButtonText}>{isInspectingTransfer ? "Inspecting transfer profile…" : "Inspect Quick Transfer profile"}</Text>
                </TouchableOpacity>
                {transferHint ? (
                  <View style={styles.transferResult}>
                    {transferHint.advertisedSsid ? (
                      <>
                        <Text style={styles.transferResultTitle}>Recorder hotspot advertised</Text>
                        <Text style={styles.transferResultText}>Network: {transferHint.advertisedSsid} • Security: {transferHint.security ?? "unknown"}</Text>
                        <Text style={styles.transferResultText}>This identifies the recorder network without opening it or requesting files. The next transfer step still needs a verified vendor file-list command.</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.transferResultTitle}>No Quick Transfer hotspot was exposed</Text>
                        <Text style={styles.transferResultText}>{transferHint.readableValueCount} of {transferHint.readableCharacteristicCount} readable characteristics returned printable data. The recorder needs its vendor pairing command before it will advertise a hotspot.</Text>
                      </>
                    )}
                  </View>
                ) : null}
                <View style={styles.connectedActions}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={shareDiagnostics} activeOpacity={0.82}>
                    <Text style={styles.secondaryButtonText}>Share diagnostic</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.disconnectButton} onPress={disconnect} activeOpacity={0.82}>
                    <Text style={styles.disconnectButtonText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.scanButton, isScanning && styles.scanButtonActive]}
                onPress={isScanning ? stopScan : startScan}
                disabled={connectingId !== null}
                activeOpacity={0.84}
              >
                {isScanning ? <ActivityIndicator color="#FFFFFF" /> : <IconSymbol name="magnifyingglass" size={18} color="#FFFFFF" />}
                <Text style={styles.scanButtonText}>{isScanning ? "Stop scanning" : "Find nearby recorders"}</Text>
              </TouchableOpacity>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {disconnectMessage ? <Text style={styles.infoText}>{disconnectMessage}</Text> : null}
            <Text style={styles.listTitle}>{isScanning ? "NEARBY BLUETOOTH DEVICES" : devices.length ? "FOUND DEVICES" : "READY TO SCAN"}</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{isScanning ? "Looking for your recorder…" : "No nearby devices yet"}</Text>
            <Text style={styles.emptyText}>
              Put the AIREC device in app-connection mode—the blue indicator should stay on—then tap Find nearby recorders.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const likelyAirec = isLikelyAirecRecorder(item);
          const isConnecting = connectingId === item.id;
          return (
            <TouchableOpacity
              style={[styles.deviceCard, likelyAirec && styles.deviceCardLikely]}
              onPress={() => void connect(item)}
              disabled={connectingId !== null || profile !== null}
              activeOpacity={0.82}
            >
              <View style={[styles.deviceIcon, likelyAirec && styles.deviceIconLikely]}>
                <IconSymbol name="waveform" size={20} color={likelyAirec ? "#C4B5FD" : "#94A3B8"} />
              </View>
              <View style={styles.deviceCopy}>
                <View style={styles.deviceTitleRow}>
                  <Text style={styles.deviceName}>{getAirecDeviceLabel(item)}</Text>
                  {likelyAirec ? <Text style={styles.recorderBadge}>RECORDER</Text> : null}
                </View>
                <Text style={styles.deviceMeta}>{formatRssi(item.rssi)} • {item.id}</Text>
              </View>
              {isConnecting ? <ActivityIndicator color="#A5B4FC" /> : <IconSymbol name="chevron.right" size={20} color="#64748B" />}
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.footerTitle}>What this does</Text>
            <Text style={styles.footerText}>• Requests standard Android Bluetooth permissions only when you scan.{"\n"}• Connects and discovers the recorder’s exposed services before a file-list request.{"\n"}• Keeps your existing WAV import flow unchanged while download transfer is validated.</Text>
            {Platform.OS === "web" ? <Text style={styles.webNote}>Use the installed Android/iOS app to scan and connect Bluetooth recorders.</Text> : null}
            <TouchableOpacity style={styles.backLink} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.backLinkText}>Back to Dictate</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 18, paddingBottom: 36, gap: 12 },
  hero: { flexDirection: "row", gap: 13, alignItems: "flex-start", marginBottom: 18 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#242847", alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1, gap: 4 },
  title: { color: "#F8FAFC", fontSize: 21, lineHeight: 27, fontWeight: "800" },
  subtitle: { color: "#94A3B8", fontSize: 13, lineHeight: 19 },
  scanButton: { backgroundColor: "#6366F1", minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginBottom: 12 },
  scanButtonActive: { backgroundColor: "#475569" },
  scanButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  listTitle: { color: "#64748B", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginTop: 8, marginBottom: 1 },
  emptyCard: { backgroundColor: "#171B29", borderColor: "#263145", borderWidth: 1, borderRadius: 16, padding: 18, gap: 6 },
  emptyTitle: { color: "#E2E8F0", fontSize: 15, fontWeight: "700" },
  emptyText: { color: "#94A3B8", fontSize: 13, lineHeight: 19 },
  deviceCard: { backgroundColor: "#171B29", borderColor: "#263145", borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 11, marginTop: 8 },
  deviceCardLikely: { borderColor: "rgba(139,92,246,0.75)", backgroundColor: "#1D1C34" },
  deviceIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#242A3B" },
  deviceIconLikely: { backgroundColor: "#33275A" },
  deviceCopy: { flex: 1, gap: 4 },
  deviceTitleRow: { flexDirection: "row", gap: 7, alignItems: "center", flexWrap: "wrap" },
  deviceName: { color: "#F1F5F9", fontSize: 15, fontWeight: "700", maxWidth: "72%" },
  deviceMeta: { color: "#64748B", fontSize: 11 },
  recorderBadge: { color: "#C4B5FD", fontSize: 9, fontWeight: "900", letterSpacing: 0.7, backgroundColor: "#38285B", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  connectedCard: { backgroundColor: "#17291F", borderColor: "#23613C", borderWidth: 1, borderRadius: 16, padding: 16, gap: 9, marginBottom: 4 },
  cardHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  connectedDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#34D399" },
  connectedTitle: { color: "#DCFCE7", fontSize: 15, fontWeight: "800", flex: 1 },
  connectedMeta: { color: "#86EFAC", fontSize: 12, fontWeight: "600" },
  safetyText: { color: "#A7F3D0", fontSize: 12, lineHeight: 18 },
  fileListSection: { gap: 8, marginTop: 2 },
  fileListIntro: { color: "#BBF7D0", fontSize: 12, lineHeight: 17 },
  fileListButton: { backgroundColor: "#155E75", minHeight: 42, borderRadius: 11, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  fileListButtonText: { color: "#DCFCE7", fontSize: 12, fontWeight: "800" },
  fileListResult: { backgroundColor: "rgba(6,78,59,0.30)", borderColor: "rgba(52,211,153,0.34)", borderWidth: 1, borderRadius: 11, padding: 11, gap: 7 },
  fileRow: { backgroundColor: "rgba(15,23,42,0.52)", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 8 },
  fileName: { color: "#ECFDF5", fontSize: 12, fontWeight: "600", flex: 1 },
  fileSize: { color: "#A7F3D0", fontSize: 11, fontWeight: "700" },
  moreFilesText: { color: "#86EFAC", fontSize: 11, lineHeight: 16 },
  transferNextStep: { color: "#BBF7D0", fontSize: 11, lineHeight: 16, marginTop: 1 },
  inspectButton: { backgroundColor: "#213C68", minHeight: 42, borderRadius: 11, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  inspectButtonDisabled: { opacity: 0.72 },
  inspectButtonText: { color: "#DBEAFE", fontSize: 12, fontWeight: "800" },
  transferResult: { backgroundColor: "rgba(30,58,138,0.24)", borderColor: "rgba(96,165,250,0.34)", borderWidth: 1, borderRadius: 11, padding: 11, gap: 4 },
  transferResultTitle: { color: "#DBEAFE", fontSize: 12, fontWeight: "800" },
  transferResultText: { color: "#BFDBFE", fontSize: 12, lineHeight: 17 },
  connectedActions: { flexDirection: "row", gap: 8, marginTop: 3 },
  secondaryButton: { backgroundColor: "rgba(167,243,208,0.12)", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  secondaryButtonText: { color: "#A7F3D0", fontWeight: "700", fontSize: 12 },
  disconnectButton: { backgroundColor: "rgba(248,113,113,0.15)", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  disconnectButtonText: { color: "#FCA5A5", fontWeight: "700", fontSize: 12 },
  errorText: { color: "#FCA5A5", backgroundColor: "rgba(127,29,29,0.26)", borderColor: "rgba(248,113,113,0.35)", borderWidth: 1, borderRadius: 12, padding: 11, fontSize: 12, lineHeight: 17, marginBottom: 1 },
  infoText: { color: "#C4B5FD", backgroundColor: "rgba(99,102,241,0.12)", borderRadius: 12, padding: 11, fontSize: 12, lineHeight: 17, marginBottom: 1 },
  footer: { marginTop: 14, backgroundColor: "#111522", borderRadius: 14, padding: 15, gap: 7 },
  footerTitle: { color: "#CBD5E1", fontSize: 13, fontWeight: "800" },
  footerText: { color: "#94A3B8", fontSize: 12, lineHeight: 19 },
  webNote: { color: "#FCD34D", fontSize: 12, lineHeight: 17 },
  backLink: { alignSelf: "flex-start", paddingVertical: 6, marginTop: 2 },
  backLinkText: { color: "#A5B4FC", fontSize: 13, fontWeight: "800" },
});
