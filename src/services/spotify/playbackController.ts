/**
 * Playback controllers — one interface, two implementations.
 *
 *   DemoController     simulated playback over the built-in catalog (no login).
 *   SpotifyController  real playback via the Web Playback SDK + Web API.
 *
 * The orchestration manager talks only to this interface, so switching between
 * demo and live is a one-line swap and the rest of the system is identical.
 */

import { demoTracksForBucket } from "./catalog";
import { DemoSynth } from "./demoSynth";
import { WebPlaybackController } from "./webPlaybackSdk";
import * as api from "./spotifyApi";
import type { MusicBucket, PlaylistRef, SpotifyMode, Track } from "@/types/spotify";

export interface PlayTarget {
  bucket: MusicBucket;
  /** The mapped playlist (or null → demo fallback for the demo controller). */
  playlist: PlaylistRef | null;
  fadeMs: number;
}

export interface PlaybackSnapshot {
  isPlaying: boolean;
  track: Track | null;
  positionMs: number;
  durationMs: number;
  bucket: MusicBucket | null;
  /** Whether audio output is actually unlocked/audible (demo synth context). */
  audioEnabled: boolean;
}

export interface PlaybackController {
  readonly kind: SpotifyMode;
  init(): Promise<void>;
  playBucket(target: PlayTarget): Promise<void>;
  pause(fadeMs?: number): Promise<void>;
  resume(): Promise<void>;
  setVolume(v01: number): Promise<void>;
  /** Mute/unmute output without losing the volume setting. */
  setMuted?(muted: boolean): void;
  /** Unlock audio from a user gesture (browser autoplay policy). */
  enableAudio?(): void;
  snapshot(): PlaybackSnapshot;
  onUpdate(cb: () => void): () => void;
  destroy(): void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ──────────────────────────────────────────────────────────────
// Demo controller
// ──────────────────────────────────────────────────────────────
export class DemoController implements PlaybackController {
  readonly kind = "demo" as const;
  private bucket: MusicBucket | null = null;
  private queue: Track[] = [];
  private index = 0;
  private positionMs = 0;
  private playing = false;
  private timer: number | null = null;
  private listeners = new Set<() => void>();
  private volume = 0.8;
  /** Synthesized, adaptive audio so demo mode actually makes sound (no login). */
  private synth = new DemoSynth();

  async init(): Promise<void> {
    this.synth.setVolume(this.volume);
    // Surface audio-unlock transitions through the normal snapshot channel.
    this.synth.onEnabledChange = () => this.emit();
  }

  enableAudio(): void {
    this.synth.unlock();
  }

  setMuted(muted: boolean): void {
    this.synth.setMuted(muted);
  }

  onUpdate(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  private emit() {
    this.listeners.forEach((cb) => cb());
  }

  async playBucket(target: PlayTarget): Promise<void> {
    this.bucket = target.bucket;
    this.queue = demoTracksForBucket(target.bucket);
    this.index = Math.floor(Math.random() * this.queue.length);
    this.positionMs = 0;
    this.playing = true;
    this.synth.setProgram(target.bucket, this.queue[this.index]?.bpm ?? 96);
    this.synth.play();
    this.startTimer();
    this.emit();
  }

  async resume(): Promise<void> {
    if (this.queue.length === 0) return;
    this.playing = true;
    this.synth.resume();
    this.startTimer();
    this.emit();
  }

  async pause(fadeMs = 120): Promise<void> {
    this.playing = false;
    this.synth.pause(fadeMs);
    this.stopTimer();
    this.emit();
  }

  async setVolume(v01: number): Promise<void> {
    this.volume = v01;
    this.synth.setVolume(v01);
  }

  private startTimer() {
    this.stopTimer();
    this.timer = window.setInterval(() => {
      if (!this.playing) return;
      this.positionMs += 250;
      const dur = (this.queue[this.index]?.durationSec ?? 200) * 1000;
      if (this.positionMs >= dur) {
        this.index = (this.index + 1) % Math.max(1, this.queue.length);
        this.positionMs = 0;
        // New track in the same bucket — keep the synth tempo honest.
        if (this.bucket) this.synth.setProgram(this.bucket, this.queue[this.index]?.bpm ?? 96);
      }
      this.emit();
    }, 250);
  }
  private stopTimer() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  snapshot(): PlaybackSnapshot {
    const track = this.queue[this.index] ?? null;
    return {
      isPlaying: this.playing,
      track,
      positionMs: this.positionMs,
      durationMs: (track?.durationSec ?? 0) * 1000,
      bucket: this.bucket,
      audioEnabled: this.synth.enabled,
    };
  }

  destroy(): void {
    this.stopTimer();
    this.synth.destroy();
    this.listeners.clear();
  }
}

// ──────────────────────────────────────────────────────────────
// Spotify controller (Web Playback SDK + Web API)
// ──────────────────────────────────────────────────────────────
export class SpotifyController implements PlaybackController {
  readonly kind = "live" as const;
  private sdk = new WebPlaybackController();
  private deviceId: string | null = null;
  private bucket: MusicBucket | null = null;
  private listeners = new Set<() => void>();
  private rampToken = 0;
  private targetVolume = 0.8;

  async init(): Promise<void> {
    this.deviceId = await this.sdk.init();
    // Make this browser tab the active playback device.
    try {
      await api.transferPlayback(this.deviceId, false);
    } catch {
      /* device may already be active */
    }
    this.sdk.onState(() => this.emit());
  }

  onUpdate(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  private emit() {
    this.listeners.forEach((cb) => cb());
  }

  async playBucket(target: PlayTarget): Promise<void> {
    if (!target.playlist?.uri || !this.deviceId) return; // nothing to play live
    this.bucket = target.bucket;
    // Crossfade: duck → switch context → ramp back up.
    const half = Math.max(150, target.fadeMs / 2);
    await this.ramp(this.targetVolume, 0.15, half);
    await api.play({ deviceId: this.deviceId, contextUri: target.playlist.uri });
    await this.ramp(0.15, this.targetVolume, half);
    this.emit();
  }

  async resume(): Promise<void> {
    await this.sdk.resume();
    this.emit();
  }

  async pause(fadeMs = 0): Promise<void> {
    if (fadeMs > 0) await this.ramp(await this.sdk.getVolume(), 0, fadeMs);
    await this.sdk.pause();
    // Restore the working volume for next resume.
    await this.sdk.setVolume(this.targetVolume);
    this.emit();
  }

  async setVolume(v01: number): Promise<void> {
    this.targetVolume = v01;
    await this.sdk.setVolume(v01);
  }

  setMuted(muted: boolean): void {
    void this.sdk.setVolume(muted ? 0 : this.targetVolume);
  }

  enableAudio(): void {
    // The SDK's audio element unlocks on the same gesture; nudge a resume.
    void this.sdk.resume();
  }

  /** Smoothly ramp the SDK volume; cancels any in-flight ramp. */
  private async ramp(from01: number, to01: number, ms: number): Promise<void> {
    const token = ++this.rampToken;
    const steps = Math.max(1, Math.round(ms / 80));
    for (let i = 1; i <= steps; i++) {
      if (token !== this.rampToken) return; // superseded
      const v = from01 + ((to01 - from01) * i) / steps;
      await this.sdk.setVolume(Math.max(0, Math.min(1, v)));
      await sleep(ms / steps);
    }
  }

  snapshot(): PlaybackSnapshot {
    const s = this.sdk.getState();
    return {
      isPlaying: !s.paused && s.track !== null,
      track: s.track
        ? {
            id: s.track.id,
            uri: s.track.uri,
            title: s.track.name,
            artist: s.track.artist,
            album: s.track.album,
            durationSec: Math.round(s.track.durationMs / 1000),
            bpm: 0,
            genre: "",
            artworkUrl: s.track.artworkUrl,
          }
        : null,
      positionMs: s.positionMs,
      durationMs: s.durationMs,
      bucket: this.bucket,
      audioEnabled: s.track !== null,
    };
  }

  destroy(): void {
    this.sdk.destroy();
    this.listeners.clear();
  }
}
