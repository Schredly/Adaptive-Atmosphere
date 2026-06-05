/**
 * Spotify orchestration types.
 *
 * These mirror the shape we get from the Spotify Web API while staying
 * decoupled from it, so the demo controller and the real integration are
 * interchangeable behind the same store fields.
 */

import type { AtmosphereState } from "./atmosphere";

export type PlaybackState = "playing" | "paused" | "stopped" | "transitioning";

export type SpotifyMode = "demo" | "live";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  /** Whole seconds. */
  durationSec: number;
  /** Beats per minute. */
  bpm: number;
  genre: string;
  /** Optional artwork URL (demo uses gradients instead). */
  artworkUrl?: string;
  /** Spotify track URI when playing live. */
  uri?: string;
}

/**
 * The six energy buckets that playlists map onto. Atmosphere states collapse
 * onto these via STATE_TO_BUCKET.
 */
export type MusicBucket = "ambient" | "chill" | "groove" | "hype" | "intense" | "chaotic";

export const MUSIC_BUCKETS: MusicBucket[] = [
  "ambient",
  "chill",
  "groove",
  "hype",
  "intense",
  "chaotic",
];

/** Ordered energy rank of each bucket (for escalate/de-escalate reasoning). */
export const BUCKET_RANK: Record<MusicBucket, number> = {
  ambient: 0,
  chill: 1,
  groove: 2,
  hype: 3,
  intense: 4,
  chaotic: 5,
};

/** How the seven atmosphere states collapse onto the six music buckets. */
export const STATE_TO_BUCKET: Record<AtmosphereState, MusicBucket> = {
  idle: "ambient",
  ambient: "chill",
  social: "groove",
  focused: "groove",
  active: "hype",
  intense: "intense",
  chaotic: "chaotic",
};

export interface BucketMeta {
  bucket: MusicBucket;
  label: string;
  color: string;
  gradient: string;
  /** Inclusive energy band, 0..100 (for display). */
  energyBand: [number, number];
  description: string;
}

export const BUCKET_META: Record<MusicBucket, BucketMeta> = {
  ambient: { bucket: "ambient", label: "Ambient", color: "#10b981", gradient: "from-[#10b981] to-[#06b6d4]", energyBand: [0, 25], description: "Low-BPM beds for idle/quiet rooms" },
  chill: { bucket: "chill", label: "Chill", color: "#3b82f6", gradient: "from-[#3b82f6] to-[#06b6d4]", energyBand: [25, 40], description: "Relaxed background for ambient activity" },
  groove: { bucket: "groove", label: "Groove", color: "#8b5cf6", gradient: "from-[#8b5cf6] to-[#3b82f6]", energyBand: [40, 60], description: "Mid-tempo for social/focused energy" },
  hype: { bucket: "hype", label: "Hype", color: "#f59e0b", gradient: "from-[#f59e0b] to-[#3b82f6]", energyBand: [60, 75], description: "Upbeat for active environments" },
  intense: { bucket: "intense", label: "Intense", color: "#ef4444", gradient: "from-[#ef4444] to-[#f59e0b]", energyBand: [75, 90], description: "High-energy for peak intensity" },
  chaotic: { bucket: "chaotic", label: "Chaotic", color: "#ec4899", gradient: "from-[#ec4899] to-[#ef4444]", energyBand: [90, 100], description: "Aggressive / high-variance for chaos" },
};

/** A lightweight playlist reference, real (Spotify) or demo. */
export interface PlaylistRef {
  id: string;
  name: string;
  /** Spotify context URI (spotify:playlist:…) when real. */
  uri?: string;
  imageUrl?: string;
  trackCount?: number;
  /** True for the built-in demo catalog playlists. */
  demo?: boolean;
}

/** Legacy alias kept for existing imports. */
export interface Playlist extends PlaylistRef {
  energyBand: [number, number];
  color: string;
  gradient: string;
  states: AtmosphereState[];
  trackIds: string[];
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  volumePercent?: number;
}

export interface SpotifyUser {
  displayName: string;
  premium: boolean;
}

export type TransitionPhase = "idle" | "crossfading" | "cooldown";

export interface TransitionInfo {
  phase: TransitionPhase;
  fromBucket: MusicBucket | null;
  toBucket: MusicBucket | null;
  /** epoch ms the current phase started. */
  startedAt: number;
  /** Crossfade / cooldown duration for the current phase (ms). */
  durationMs: number;
  reason: string;
}

export interface SpotifyAuth {
  connected: boolean;
  accessToken?: string;
  expiresAt?: number;
  userDisplayName?: string;
}
