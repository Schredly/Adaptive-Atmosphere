/**
 * Spotify Web Playback SDK wrapper.
 *
 * Injects the SDK script, creates a Player that authenticates via our PKCE
 * token, and turns this browser tab into a Spotify Connect device. Exposes the
 * device id (for Web API `play`/`transfer`), local transport controls, and a
 * normalized state stream. Requires a Spotify **Premium** account (SDK limitation).
 */

import { getAccessToken } from "./spotifyAuth";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Spotify?: any;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

export interface SdkTrack {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl?: string;
}

export interface SdkState {
  paused: boolean;
  positionMs: number;
  durationMs: number;
  track: SdkTrack | null;
}

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const tag = document.createElement("script");
    tag.src = SDK_SRC;
    tag.async = true;
    tag.onerror = () => reject(new Error("Failed to load Spotify Web Playback SDK."));
    document.body.appendChild(tag);
  });
  return scriptPromise;
}

export class WebPlaybackController {
  private player: any = null;
  private deviceId: string | null = null;
  private state: SdkState = { paused: true, positionMs: 0, durationMs: 0, track: null };
  private listeners = new Set<(s: SdkState) => void>();
  private readyResolvers: ((id: string) => void)[] = [];

  get currentDeviceId(): string | null {
    return this.deviceId;
  }

  getState(): SdkState {
    return this.state;
  }

  onState(cb: (s: SdkState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit() {
    this.listeners.forEach((cb) => cb(this.state));
  }

  /** Initialize the player and resolve once it has a device id. */
  async init(): Promise<string> {
    await loadScript();
    if (this.deviceId) return this.deviceId;

    this.player = new window.Spotify.Player({
      name: "Adaptive Atmosphere",
      getOAuthToken: (cb: (token: string) => void) => {
        void getAccessToken().then((t) => t && cb(t));
      },
      volume: 0.8,
    });

    this.player.addListener("ready", ({ device_id }: { device_id: string }) => {
      this.deviceId = device_id;
      this.readyResolvers.forEach((r) => r(device_id));
      this.readyResolvers = [];
    });

    this.player.addListener("not_ready", () => {
      this.deviceId = null;
    });

    this.player.addListener("player_state_changed", (s: any) => {
      if (!s) return;
      const cur = s.track_window?.current_track;
      this.state = {
        paused: s.paused,
        positionMs: s.position,
        durationMs: s.duration,
        track: cur
          ? {
              id: cur.id,
              uri: cur.uri,
              name: cur.name,
              artist: (cur.artists ?? []).map((a: any) => a.name).join(", "),
              album: cur.album?.name ?? "",
              durationMs: cur.duration_ms,
              artworkUrl: cur.album?.images?.[0]?.url,
            }
          : null,
      };
      this.emit();
    });

    const connected = await this.player.connect();
    if (!connected) throw new Error("Spotify player failed to connect.");

    return new Promise<string>((resolve) => {
      if (this.deviceId) resolve(this.deviceId);
      else this.readyResolvers.push(resolve);
    });
  }

  async resume(): Promise<void> {
    await this.player?.resume();
  }
  async pause(): Promise<void> {
    await this.player?.pause();
  }
  async setVolume(v01: number): Promise<void> {
    await this.player?.setVolume(Math.max(0, Math.min(1, v01)));
  }
  async getVolume(): Promise<number> {
    return (await this.player?.getVolume?.()) ?? 0.8;
  }

  destroy(): void {
    this.player?.disconnect?.();
    this.player = null;
    this.deviceId = null;
    this.listeners.clear();
  }
}
