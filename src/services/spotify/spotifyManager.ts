/**
 * spotifyManager — the orchestration brain (singleton, like cameraService).
 *
 * Owns the active playback controller (demo or live), runs the orchestration
 * engine against atmosphere updates, manages crossfade/cooldown timers, and
 * mirrors playback into the Zustand store. UI components call its imperative
 * methods (login, setMode, loadDevices, togglePlay…); the useSpotifyOrchestration
 * hook feeds it atmosphere changes and forwards its snapshots to the store.
 */

import { useAtmosphereStore } from "@/store/useAtmosphereStore";
import { BUCKET_META } from "@/types/spotify";
import type {
  MusicBucket,
  Playlist,
  PlaylistRef,
  SpotifyMode,
  Track,
} from "@/types/spotify";
import type { AtmosphereState } from "@/types/atmosphere";
import { DEMO_PLAYLIST_BY_BUCKET, demoPlaylistRef } from "./catalog";
import {
  DemoController,
  SpotifyController,
  type PlaybackController,
} from "./playbackController";
import { decideOrchestration } from "./orchestrationEngine";
import * as auth from "./spotifyAuth";
import * as api from "./spotifyApi";

function buildPlaylist(bucket: MusicBucket, ref: PlaylistRef | null): Playlist {
  const meta = BUCKET_META[bucket];
  const demo = DEMO_PLAYLIST_BY_BUCKET[bucket];
  return {
    id: ref?.id ?? demo.id,
    name: ref?.name ?? demo.name,
    uri: ref?.uri,
    imageUrl: ref?.imageUrl,
    trackCount: ref?.trackCount ?? demo.trackIds.length,
    demo: ref?.demo ?? !ref,
    energyBand: meta.energyBand,
    color: meta.color,
    gradient: meta.gradient,
    states: [],
    trackIds: demo.trackIds,
  };
}

class SpotifyManager {
  private controller: PlaybackController | null = null;
  private offSnapshot: (() => void) | null = null;
  private crossfadeTimer: number | null = null;
  private cooldownTimer: number | null = null;
  private lastTrackId: string | null = null;
  private initializing = false;
  /** Set when the user manually pauses, so orchestration won't auto-resume. */
  private userPaused = false;
  /**
   * True when there's no live analysis source (no video/camera). Starts true so
   * nothing plays until input arrives (avoids the mock simulator churning music).
   */
  private noInput = true;

  private get store() {
    return useAtmosphereStore.getState();
  }

  // ── Lifecycle ───────────────────────────────────────────────
  async init(mode: SpotifyMode): Promise<void> {
    if (this.initializing) return;
    this.initializing = true;
    try {
      await this.swapController(mode);
      // Don't auto-play on boot: music starts only once a real analysis source
      // (uploaded video or live camera) becomes active, via setInputActive().
      if (mode === "live" && auth.isAuthenticated()) {
        await this.refreshProfile();
      }
    } finally {
      this.initializing = false;
    }
  }

  private async swapController(mode: SpotifyMode): Promise<void> {
    this.offSnapshot?.();
    this.controller?.destroy();
    // Only spin up the real SDK player when we actually have a session — a live
    // controller without a token would hang waiting for `ready`.
    const useLive = mode === "live" && auth.isAuthenticated();
    this.controller = useLive ? new SpotifyController() : new DemoController();
    try {
      await this.controller.init();
    } catch (err) {
      // Live init failed (no premium / SDK blocked) → fall back to demo player.
      if (useLive) {
        this.controller = new DemoController();
        await this.controller.init();
      } else {
        throw err;
      }
    }
    this.offSnapshot = this.controller.onUpdate(() => this.pushSnapshot());
    // Apply the user's persisted volume / mute to the fresh controller.
    await this.controller.setVolume(this.store.musicVolume);
    this.controller.setMuted?.(this.store.audioMuted);
  }

  async setMode(mode: SpotifyMode): Promise<void> {
    this.store.setSpotifyMode(mode);
    this.userPaused = false;
    this.clearTimers();
    await this.swapController(mode);
    // Resume scoring only if a source is already active; otherwise stay stopped.
    if (mode === "demo" && !this.noInput) {
      await this.applyForState(this.store.atmosphereState, true);
    }
  }

  // ── Auth / account ─────────────────────────────────────────
  async login(): Promise<void> {
    await auth.beginLogin(); // redirects
  }

  logout(): void {
    auth.logout();
    this.store.setSpotifyUser(null);
    this.store.setSpotifyDevices([]);
    this.store.setUserPlaylists([]);
    this.store.setSpotifyConnected(false);
    void this.setMode("demo");
  }

  async refreshProfile(): Promise<void> {
    try {
      const user = await api.getMe();
      this.store.setSpotifyUser(user);
      this.store.setSpotifyConnected(true);
      await Promise.all([this.loadDevices(), this.loadPlaylists()]);
    } catch {
      this.store.setSpotifyConnected(false);
    }
  }

  async loadDevices(): Promise<void> {
    try {
      const devices = await api.getDevices();
      this.store.setSpotifyDevices(devices);
      const active = devices.find((d) => d.isActive);
      if (active) this.store.setActiveDeviceId(active.id);
    } catch {
      /* ignore */
    }
  }

  async loadPlaylists(): Promise<void> {
    try {
      this.store.setUserPlaylists(await api.getUserPlaylists());
    } catch {
      /* ignore */
    }
  }

  async selectDevice(deviceId: string): Promise<void> {
    this.store.setActiveDeviceId(deviceId);
    try {
      await api.transferPlayback(deviceId, !["paused", "stopped"].includes(this.store.playbackState));
      await this.loadDevices();
    } catch {
      /* ignore */
    }
  }

  // ── Orchestration ───────────────────────────────────────────
  /** Called by the hook whenever the atmosphere reading changes. */
  async onAtmosphere(state: AtmosphereState, energy: number, confidence: number): Promise<void> {
    await this.applyForState(state, false, energy, confidence);
  }

  /**
   * Tell the orchestrator whether a real analysis source (uploaded video or live
   * camera) is active. With no input we stop the music instead of letting the
   * mock simulator churn through playlists.
   */
  setInputActive(active: boolean): void {
    if (active) {
      if (!this.noInput) return;
      this.noInput = false;
      // Resume adapting (respects userPaused inside applyForState).
      void this.applyForState(this.store.atmosphereState, false);
    } else {
      if (this.noInput) return;
      this.noInput = true;
      this.clearTimers();
      void this.controller?.pause(800);
      this.store.setPlaybackState("paused");
      this.store.setTransition({
        phase: "idle",
        fromBucket: this.store.activeBucket,
        toBucket: this.store.activeBucket,
        startedAt: Date.now(),
        durationMs: 0,
        reason: "No video or camera — music stopped",
      });
    }
  }

  private async applyForState(
    state: AtmosphereState,
    seed: boolean,
    energy = this.store.motionEnergyScore,
    confidence = this.store.confidenceScore,
  ): Promise<void> {
    if (!this.controller) return;
    // Respect a manual pause AND "no live input": the engine must not
    // auto-resume/transition while paused by the user, or while there's no real
    // analysis source (no video/camera). Seed calls (init/mode-switch/manual
    // play) bypass these.
    if ((this.userPaused || this.noInput) && !seed) return;
    const s = this.store;
    const snap = this.controller.snapshot();

    const decision = decideOrchestration({
      state,
      energy,
      confidence,
      now: Date.now(),
      currentBucket: s.activeBucket,
      isPlaying: snap.isPlaying,
      lastTransitionAt: s.lastTransitionAt,
      cooldownMs: s.settings.stateCooldown * 1000,
      confidenceThreshold: s.settings.confidenceThreshold,
      transitionAggressiveness: s.settings.transitionAggressiveness,
      bpmGap: Math.abs((snap.track?.bpm ?? s.currentBpm) - s.currentBpm),
    });

    const target = decision.targetBucket;

    if (decision.action === "hold") {
      // Reflect cooldown phase + reason without changing playback.
      s.setTransition({
        phase: decision.cooldownRemainingMs > 0 ? "cooldown" : "idle",
        fromBucket: s.activeBucket,
        toBucket: s.activeBucket,
        startedAt: s.transition.startedAt,
        durationMs: decision.cooldownRemainingMs > 0 ? decision.cooldownMs : 0,
        reason: decision.reason,
      });
      return;
    }

    if (decision.action === "pause") {
      await this.controller.pause(decision.fadeMs);
      s.setPlaybackState("paused");
      s.setTransition({
        phase: "idle",
        fromBucket: s.activeBucket,
        toBucket: s.activeBucket,
        startedAt: Date.now(),
        durationMs: 0,
        reason: decision.reason,
      });
      return;
    }

    // transition / resume → resolve the playlist for the target bucket.
    const ref = s.playlistMappings[target] ?? (s.spotifyMode === "demo" ? demoPlaylistRef(target) : null);
    if (s.spotifyMode === "live" && !ref) {
      s.setTransition({
        phase: "idle",
        fromBucket: s.activeBucket,
        toBucket: target,
        startedAt: Date.now(),
        durationMs: 0,
        reason: `No playlist mapped for "${target}" — open Spotify settings`,
      });
      return;
    }

    const from = s.activeBucket;
    await this.controller.playBucket({ bucket: target, playlist: ref, fadeMs: decision.fadeMs });
    s.setActiveBucket(target);
    s.setLastTransitionAt(Date.now());
    s.setPlaybackState(seed ? "playing" : "transitioning");

    // Reflect the active playlist immediately.
    const playlist = buildPlaylist(target, ref);
    const snap2 = this.controller.snapshot();
    if (snap2.track) s.setMusic(playlist, snap2.track);

    // Phase machine: crossfading → cooldown → idle.
    this.clearTimers();
    s.setTransition({
      phase: "crossfading",
      fromBucket: from,
      toBucket: target,
      startedAt: Date.now(),
      durationMs: decision.fadeMs,
      reason: decision.reason,
    });
    this.crossfadeTimer = window.setTimeout(() => {
      this.store.setPlaybackState("playing");
      this.store.setTransition({
        phase: "cooldown",
        fromBucket: from,
        toBucket: target,
        startedAt: Date.now(),
        durationMs: decision.cooldownMs,
        reason: "Cooldown — stabilizing atmosphere",
      });
      this.cooldownTimer = window.setTimeout(() => {
        this.store.setTransition({
          phase: "idle",
          fromBucket: target,
          toBucket: target,
          startedAt: Date.now(),
          durationMs: 0,
          reason: "Atmosphere stable — monitoring",
        });
      }, decision.cooldownMs);
    }, decision.fadeMs);
  }

  // ── Manual transport ────────────────────────────────────────
  async togglePlay(): Promise<void> {
    if (!this.controller) return;
    const snap = this.controller.snapshot();
    if (snap.isPlaying) {
      // Manual pause — latch it so the orchestration loop doesn't auto-resume.
      this.userPaused = true;
      await this.controller.pause();
      this.store.setPlaybackState("paused");
    } else if (snap.track) {
      this.userPaused = false;
      await this.controller.resume();
      this.store.setPlaybackState("playing");
    } else {
      this.userPaused = false;
      await this.applyForState(this.store.atmosphereState, true);
    }
  }

  async setVolume(v01: number): Promise<void> {
    this.store.setMusicVolume(v01);
    await this.controller?.setVolume(v01);
  }

  /** Unlock audio output from a user gesture (the "Enable sound" control). */
  enableAudio(): void {
    this.controller?.enableAudio?.();
  }

  setMuted(muted: boolean): void {
    this.store.setAudioMuted(muted);
    this.controller?.setMuted?.(muted);
  }

  // ── Store mirroring ─────────────────────────────────────────
  private pushSnapshot(): void {
    if (!this.controller) return;
    const s = this.store;
    const snap = this.controller.snapshot();
    s.setTrackProgress(snap.positionMs, snap.durationMs);
    if (s.audioEnabled !== snap.audioEnabled) s.setAudioEnabled(snap.audioEnabled);
    if (snap.track && snap.track.id !== this.lastTrackId) {
      this.lastTrackId = snap.track.id;
      const bucket = snap.bucket ?? s.activeBucket ?? "groove";
      const ref = s.playlistMappings[bucket] ?? null;
      s.setMusic(buildPlaylist(bucket, ref), snap.track);
    }
    // Keep playbackState honest with the controller (ignore mid-crossfade).
    if (s.transition.phase !== "crossfading") {
      s.setPlaybackState(snap.isPlaying ? "playing" : "paused");
    }
  }

  private clearTimers(): void {
    if (this.crossfadeTimer !== null) clearTimeout(this.crossfadeTimer);
    if (this.cooldownTimer !== null) clearTimeout(this.cooldownTimer);
    this.crossfadeTimer = null;
    this.cooldownTimer = null;
  }

  getTrack(): Track | null {
    return this.controller?.snapshot().track ?? null;
  }

  destroy(): void {
    this.clearTimers();
    this.offSnapshot?.();
    this.controller?.destroy();
    this.controller = null;
  }
}

export const spotifyManager = new SpotifyManager();
