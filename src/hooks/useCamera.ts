/**
 * useCamera — binds the shared CameraService to a <video> element and the store.
 *
 * Returns the live status plus connect/disconnect/select controls. The hook is
 * resilient: it mirrors service events into the store (so the TopNav indicator
 * and Settings reflect reality everywhere) and re-attaches the stream whenever
 * the service reconnects after a device drop.
 */

import { useCallback, useEffect, useState } from "react";

import { cameraService } from "@/services/camera/cameraService";
import type { CameraDevice, CameraStatus } from "@/services/camera/cameraService";
import { useAtmosphereStore } from "@/store/useAtmosphereStore";

export interface UseCameraResult {
  status: CameraStatus;
  error: string | null;
  devices: CameraDevice[];
  activeDeviceId: string | null;
  connect: (deviceId?: string) => Promise<void>;
  disconnect: () => void;
  selectDevice: (deviceId: string) => Promise<void>;
  refreshDevices: () => Promise<void>;
}

export function useCamera(
  videoRef: React.RefObject<HTMLVideoElement | null>,
): UseCameraResult {
  const [status, setStatus] = useState<CameraStatus>(cameraService.getStatus());
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(
    cameraService.getActiveDeviceId(),
  );

  const setCameraStatus = useAtmosphereStore((s) => s.setCameraStatus);
  const setCameraDevices = useAtmosphereStore((s) => s.setCameraDevices);
  const setActiveCameraDevice = useAtmosphereStore((s) => s.setActiveCameraDevice);

  // Attach a stream to the bound <video> element.
  const attach = useCallback(
    (stream: MediaStream | null) => {
      const el = videoRef.current;
      if (!el) return;
      el.srcObject = stream;
      if (stream) {
        el.play().catch(() => {
          /* autoplay can reject before user gesture; ignored */
        });
      }
    },
    [videoRef],
  );

  useEffect(() => {
    const offStatus = cameraService.on("status", (s, err) => {
      setStatus(s);
      setError(err ?? null);
      setCameraStatus(s, err ?? null);
      setActiveDeviceId(cameraService.getActiveDeviceId());
      setActiveCameraDevice(cameraService.getActiveDeviceId());
    });
    const offStream = cameraService.on("stream", (stream) => attach(stream));
    const offDevices = cameraService.on("devices", (d) => {
      setDevices(d);
      setCameraDevices(d);
    });

    // If a stream is already running (e.g. remounting Dashboard), re-attach it.
    if (cameraService.getStream()) attach(cameraService.getStream());
    void cameraService.listDevices();

    return () => {
      offStatus();
      offStream();
      offDevices();
    };
  }, [attach, setCameraStatus, setCameraDevices, setActiveCameraDevice]);

  const connect = useCallback(async (deviceId?: string) => {
    await cameraService.start(deviceId);
  }, []);

  const disconnect = useCallback(() => {
    cameraService.stop();
  }, []);

  const selectDevice = useCallback(async (deviceId: string) => {
    await cameraService.start(deviceId);
  }, []);

  const refreshDevices = useCallback(async () => {
    await cameraService.listDevices();
  }, []);

  return { status, error, devices, activeDeviceId, connect, disconnect, selectDevice, refreshDevices };
}
