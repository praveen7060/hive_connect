import { CameraView, useCameraPermissions } from "expo-camera";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

type ClaimedDevice = {
  id: string;
  alias?: string | null;
  installationId?: string | null;
  claimedAt: string;
  device: {
    id: string;
    name: string;
    serialNumber: string;
    status?: string | null;
  };
};

type ClaimResponse = {
  success: boolean;
  device: {
    id: string;
    name: string;
    serialNumber: string;
  };
};

const DEFAULT_API_BASE = "http://10.0.2.2:4000/api";

function resolveApiBase() {
  const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
    (Constants.manifest2?.extra as Record<string, unknown> | undefined);
  const value = typeof extra?.apiBaseUrl === "string" ? extra.apiBaseUrl.trim() : "";
  return value || DEFAULT_API_BASE;
}

function readTokenFromUrl(url: string) {
  const parsed = Linking.parse(url);
  const token = parsed.queryParams?.token;
  return typeof token === "string" ? token.trim() : "";
}

async function request<T>(
  apiBaseUrl: string,
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as Record<string, unknown>;
      if (typeof payload.message === "string" && payload.message.trim()) {
        message = payload.message;
      }
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export default function App() {
  const defaultApiBaseUrl = useMemo(resolveApiBase, []);
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [appId, setAppId] = useState("");
  const [appKey, setAppKey] = useState("");
  const [installationId, setInstallationId] = useState("device-001");
  const [qrToken, setQrToken] = useState("");
  const [commandKey, setCommandKey] = useState("turn_on");
  const [commandPayload, setCommandPayload] = useState('{"status":"on"}');
  const [commandParameters, setCommandParameters] = useState('{"switchNo":"S1"}');
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [claimedDevices, setClaimedDevices] = useState<ClaimedDevice[]>([]);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    const applyUrl = (url: string) => {
      const token = readTokenFromUrl(url);
      if (token) {
        setQrToken(token);
        setStatus("QR token received from deep link");
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) applyUrl(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) => applyUrl(url));
    return () => sub.remove();
  }, []);

  async function refreshClaims() {
    if (!appId.trim() || !appKey.trim()) {
      Alert.alert("Missing credentials", "Enter appId and appKey first.");
      return;
    }

    setIsBusy(true);
    try {
      const data = await request<ClaimedDevice[]>(
        apiBaseUrl,
        `/application-console/apps/${encodeURIComponent(appId.trim())}/devices`,
        "GET",
        undefined,
        {
          "x-app-key": appKey.trim(),
        }
      );
      setClaimedDevices(data);
      if (data[0]?.device?.id && !selectedDeviceId) {
        setSelectedDeviceId(data[0].device.id);
      }
      setStatus(`Loaded ${data.length} claimed device(s)`);
    } catch (error) {
      Alert.alert("Load failed", error instanceof Error ? error.message : "Unable to load devices");
    } finally {
      setIsBusy(false);
    }
  }

  async function claimQrToken() {
    if (!qrToken.trim()) {
      Alert.alert("Missing QR token", "Scan a QR code or paste the token first.");
      return;
    }

    setIsBusy(true);
    try {
      const result = await request<ClaimResponse>(apiBaseUrl, "/application-console/claims", "POST", {
        appId: appId.trim(),
        appKey: appKey.trim(),
        qrToken: qrToken.trim(),
        installationId: installationId.trim() || undefined,
      });
      setSelectedDeviceId(result.device.id);
      setStatus(`Claimed device ${result.device.name}`);
      await refreshClaims();
    } catch (error) {
      Alert.alert("Claim failed", error instanceof Error ? error.message : "Unable to claim QR");
    } finally {
      setIsBusy(false);
    }
  }

  async function executeCommand() {
    if (!selectedDeviceId.trim()) {
      Alert.alert("Missing device", "Select or claim a device first.");
      return;
    }

    let payload: Record<string, unknown> = {};
    let parameters: Record<string, unknown> = {};

    try {
      payload = commandPayload.trim() ? (JSON.parse(commandPayload) as Record<string, unknown>) : {};
      parameters = commandParameters.trim() ? (JSON.parse(commandParameters) as Record<string, unknown>) : {};
    } catch {
      Alert.alert("Invalid JSON", "Command payload or parameters are not valid JSON.");
      return;
    }

    setIsBusy(true);
    try {
      await request(
        apiBaseUrl,
        `/application-console/apps/${encodeURIComponent(appId.trim())}/devices/${encodeURIComponent(selectedDeviceId.trim())}/commands/${encodeURIComponent(commandKey.trim())}`,
        "POST",
        {
          installationId: installationId.trim() || undefined,
          payload,
          parameters,
        },
        {
          "x-app-key": appKey.trim(),
        }
      );
      setStatus(`Command '${commandKey}' sent`);
      Alert.alert("Success", "Command sent successfully.");
    } catch (error) {
      Alert.alert("Command failed", error instanceof Error ? error.message : "Unable to send command");
    } finally {
      setIsBusy(false);
    }
  }

  const canScan = scanEnabled && permission?.granted;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Hive Connect Mobile</Text>
        <Text style={styles.subtitle}>QR claim and command test client</Text>

        <Card title="Connection">
          <Label text="API Base URL" />
          <TextInput
            value={apiBaseUrl}
            onChangeText={setApiBaseUrl}
            placeholder="http://192.168.1.10:4000/api"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helper}>Use `10.0.2.2` for Android emulator or your laptop IP for a real phone.</Text>

          <Label text="Application ID" />
          <TextInput
            value={appId}
            onChangeText={setAppId}
            placeholder="Paste appId"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Label text="Application Key" />
          <TextInput
            value={appKey}
            onChangeText={setAppKey}
            placeholder="Paste server appKey"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Label text="Installation ID" />
          <TextInput
            value={installationId}
            onChangeText={setInstallationId}
            placeholder="phone-001"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable style={styles.secondaryButton} onPress={() => void refreshClaims()}>
            <Text style={styles.secondaryButtonText}>Load Claimed Devices</Text>
          </Pressable>
        </Card>

        <Card title="QR Enrollment">
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>Enable QR Scanner</Text>
              <Text style={styles.helper}>Scan `hiveconnect://device-claim?token=...` style QR codes</Text>
            </View>
            <Switch value={scanEnabled} onValueChange={setScanEnabled} />
          </View>

          {scanEnabled && !permission?.granted ? (
            <Pressable style={styles.secondaryButton} onPress={() => void requestPermission()}>
              <Text style={styles.secondaryButtonText}>Allow Camera</Text>
            </Pressable>
          ) : null}

          {canScan ? (
            <View style={styles.cameraFrame}>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => {
                  const token = data.includes("://") ? readTokenFromUrl(data) : data.trim();
                  if (token) {
                    setQrToken(token);
                    setScanEnabled(false);
                    setStatus("QR scanned successfully");
                  }
                }}
              />
              <View style={styles.cameraOverlay}>
                <Text style={styles.cameraOverlayText}>Align the QR within the frame</Text>
              </View>
            </View>
          ) : null}

          <Label text="QR Token" />
          <TextInput value={qrToken} onChangeText={setQrToken} placeholder="Scanned or pasted token" style={styles.input} autoCapitalize="none" />
          <Text style={styles.helper}>The QR can contain the raw token or a deep link like `hiveconnect://device-claim?token=...`.</Text>

          <Pressable style={styles.primaryButton} onPress={() => void claimQrToken()}>
            <Text style={styles.primaryButtonText}>Claim Device</Text>
          </Pressable>
        </Card>

        <Card title="Claimed Devices">
          {claimedDevices.length === 0 ? (
            <Text style={styles.helper}>No claimed devices loaded yet.</Text>
          ) : (
            <FlatList
              data={claimedDevices}
              scrollEnabled={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const selected = selectedDeviceId === item.device.id;
                return (
                  <Pressable
                    style={[styles.deviceRow, selected ? styles.deviceRowSelected : null]}
                    onPress={() => setSelectedDeviceId(item.device.id)}
                  >
                    <View style={styles.deviceTextWrap}>
                      <Text style={styles.deviceName}>{item.device.name}</Text>
                      <Text style={styles.deviceMeta}>{item.device.serialNumber}</Text>
                    </View>
                    <Text style={styles.deviceMeta}>{selected ? "Selected" : item.alias || "Claimed"}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </Card>

        <Card title="Command Test">
          <Label text="Selected Device ID" />
          <TextInput value={selectedDeviceId} onChangeText={setSelectedDeviceId} placeholder="Device record id" style={styles.input} autoCapitalize="none" />

          <Label text="Command Key" />
          <TextInput value={commandKey} onChangeText={setCommandKey} placeholder="turn_on" style={styles.input} autoCapitalize="none" />

          <Label text="Command Payload JSON" />
          <TextInput value={commandPayload} onChangeText={setCommandPayload} multiline style={styles.textArea} autoCapitalize="none" />

          <Label text="Command Parameters JSON" />
          <TextInput value={commandParameters} onChangeText={setCommandParameters} multiline style={styles.textArea} autoCapitalize="none" />

          <Pressable style={styles.primaryButton} onPress={() => void executeCommand()}>
            <Text style={styles.primaryButtonText}>Send Command</Text>
          </Pressable>
        </Card>

        <Card title="Status">
          {isBusy ? <ActivityIndicator color="#0f172a" /> : null}
          <Text style={styles.statusText}>{status}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: -8,
    fontSize: 14,
    color: "#475569",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  helper: {
    fontSize: 12,
    color: "#64748b",
  },
  mutedValue: {
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#0f172a",
  },
  textArea: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
    textAlignVertical: "top",
  },
  primaryButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cameraFrame: {
    height: 260,
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    position: "relative",
    backgroundColor: "#0f172a",
  },
  cameraOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.72)",
    padding: 10,
  },
  cameraOverlayText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  deviceRowSelected: {
    borderColor: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  deviceTextWrap: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  deviceMeta: {
    fontSize: 12,
    color: "#64748b",
  },
  statusText: {
    fontSize: 13,
    color: "#334155",
  },
});
