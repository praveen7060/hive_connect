import { useEffect, useMemo, useState } from "react";
import { deviceControlApi } from "./api";
import type { ClaimedDeviceRecord, ControlApplication } from "./types";

export function useDeviceControlData() {
  const [apps, setApps] = useState<ControlApplication[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [claimedDevices, setClaimedDevices] = useState<ClaimedDeviceRecord[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadApps = async () => {
      setAppsLoading(true);
      setError(null);
      try {
        const nextApps = await deviceControlApi.listApps();
        if (!mounted) return;
        setApps(nextApps);
        setSelectedAppId((current) => current || nextApps[0]?.id || "");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load applications");
      } finally {
        if (mounted) setAppsLoading(false);
      }
    };

    void loadApps();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedApp = useMemo(
    () => apps.find((app) => app.id === selectedAppId) ?? null,
    [apps, selectedAppId]
  );

  useEffect(() => {
    let mounted = true;
    const loadClaimedDevices = async () => {
      if (!selectedApp?.id || !selectedApp.appKey) {
        setClaimedDevices([]);
        return;
      }

      setDevicesLoading(true);
      setError(null);
      try {
        const nextDevices = await deviceControlApi.listClaimedDevices(selectedApp.id, selectedApp.appKey);
        if (!mounted) return;
        setClaimedDevices(nextDevices);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load claimed devices");
      } finally {
        if (mounted) setDevicesLoading(false);
      }
    };

    void loadClaimedDevices();
    return () => {
      mounted = false;
    };
  }, [selectedApp?.appKey, selectedApp?.id]);

  return {
    apps,
    selectedApp,
    selectedAppId,
    setSelectedAppId,
    claimedDevices,
    appsLoading,
    devicesLoading,
    error,
  };
}
