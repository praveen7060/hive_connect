import { deviceInventoryApi } from "../device-inventory/api";
import type { TelemetryDeviceRecord } from "./types";

export const telemetryApi = {
  listDeviceTelemetry: () => deviceInventoryApi.devices.list() as Promise<TelemetryDeviceRecord[]>,
};
