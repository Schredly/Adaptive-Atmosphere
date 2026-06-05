/**
 * Camera service — owns getUserMedia, device enumeration, stream lifecycle,
 * and automatic reconnection.
 *
 * Designed for live webcams and external/Continuity iPhone cameras (which show
 * up as regular `videoinput` devices once paired with macOS). The service is
 * UI-agnostic: it emits events and exposes the active MediaStream; the
 * `useCamera` hook binds it to a <video> element and the store.
 */

export interface CameraDevice {
  deviceId: string;
  label: string;
  /** Heuristic: looks like an iPhone / Continuity Camera. */
  isPhone: boolean;
}

export type CameraStatus = "idle" | "connecting" | "connected" | "error";

export interface CameraEvents {
  status: (status: CameraStatus, error?: string) => void;
  stream: (stream: MediaStream | null) => void;
  devices: (devices: CameraDevice[]) => void;
}

const PHONE_HINT = /iphone|continuity|ios|mobile/i;

function toCameraDevice(d: MediaDeviceInfo, index: number): CameraDevice {
  const label = d.label || `Camera ${index + 1}`;
  return { deviceId: d.deviceId, label, isPhone: PHONE_HINT.test(label) };
}

export class CameraService {
  private stream: MediaStream | null = null;
  private currentDeviceId: string | null = null;
  private status: CameraStatus = "idle";
  private listeners: { [K in keyof CameraEvents]: Set<CameraEvents[K]> } = {
    status: new Set(),
    stream: new Set(),
    devices: new Set(),
  };
  private reconnectTimer: number | null = null;
  private destroyed = false;

  constructor() {
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener?.("devicechange", this.handleDeviceChange);
    }
  }

  on<K extends keyof CameraEvents>(event: K, cb: CameraEvents[K]): () => void {
    this.listeners[event].add(cb);
    return () => this.listeners[event].delete(cb);
  }

  private emitStatus(status: CameraStatus, error?: string) {
    this.status = status;
    this.listeners.status.forEach((cb) => cb(status, error));
  }
  private emitStream(stream: MediaStream | null) {
    this.listeners.stream.forEach((cb) => cb(stream));
  }
  private emitDevices(devices: CameraDevice[]) {
    this.listeners.devices.forEach((cb) => cb(devices));
  }

  getStatus(): CameraStatus {
    return this.status;
  }
  getStream(): MediaStream | null {
    return this.stream;
  }
  getActiveDeviceId(): string | null {
    return this.currentDeviceId;
  }

  /** Enumerate video input devices. Labels require an active permission grant. */
  async listDevices(): Promise<CameraDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    const cams = all
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => toCameraDevice(d, i));
    this.emitDevices(cams);
    return cams;
  }

  /** Start (or switch to) a camera. Passing no deviceId uses the default. */
  async start(deviceId?: string): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = "Camera API unavailable in this browser/context (needs HTTPS or localhost).";
      this.emitStatus("error", msg);
      throw new Error(msg);
    }

    this.emitStatus("connecting");
    this.stop(/* keepStatus */ true);

    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = stream;
      this.currentDeviceId =
        deviceId ?? stream.getVideoTracks()[0]?.getSettings().deviceId ?? null;

      // Reconnect if the OS/device drops the track unexpectedly.
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", this.handleTrackEnded);
      });

      this.emitStream(stream);
      this.emitStatus("connected");
      // Re-list now that we (likely) have label permission.
      void this.listDevices();
      return stream;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to access camera.";
      this.emitStatus("error", msg);
      throw err;
    }
  }

  /** Stop the active stream. Keeps listeners attached. */
  stop(keepStatus = false): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.removeEventListener("ended", this.handleTrackEnded);
        track.stop();
      });
      this.stream = null;
      this.emitStream(null);
    }
    if (!keepStatus) this.emitStatus("idle");
  }

  private handleTrackEnded = () => {
    if (this.destroyed) return;
    this.emitStatus("error", "Camera disconnected — attempting to reconnect…");
    this.scheduleReconnect();
  };

  private handleDeviceChange = () => {
    void this.listDevices();
    // If our active device vanished, try to recover onto another one.
    if (this.status === "connected" && this.currentDeviceId) {
      void navigator.mediaDevices.enumerateDevices().then((devices) => {
        const stillThere = devices.some(
          (d) => d.kind === "videoinput" && d.deviceId === this.currentDeviceId,
        );
        if (!stillThere) this.scheduleReconnect();
      });
    }
  };

  private scheduleReconnect(attempt = 0): void {
    if (this.destroyed || this.reconnectTimer) return;
    const delay = Math.min(8000, 1000 * 2 ** attempt);
    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.start(this.currentDeviceId ?? undefined);
      } catch {
        if (attempt < 4) this.scheduleReconnect(attempt + 1);
        else this.emitStatus("error", "Unable to reconnect to camera.");
      }
    }, delay);
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    navigator.mediaDevices?.removeEventListener?.("devicechange", this.handleDeviceChange);
    (Object.keys(this.listeners) as (keyof CameraEvents)[]).forEach((k) =>
      this.listeners[k].clear(),
    );
  }
}

/** App-wide singleton — one physical camera pipeline shared by all consumers. */
export const cameraService = new CameraService();
