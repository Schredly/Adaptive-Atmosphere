/**
 * useAtmosphereStore — the single source of truth for the running system.
 *
 * Everything the UI renders flows through here. Services compute, hooks pump
 * samples in via `ingestMotionSample` / `applyAtmosphere` / `pushInterpretation`,
 * and components subscribe with selectors. Keeping all realtime state in one
 * store is what lets every page (Dashboard, Test Mode, Spotify…) stay live and
 * consistent simultaneously.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type {
  AIInterpretation,
  AtmosphereState,
  EnvironmentMode,
} from "@/types/atmosphere";
import { NO_PATTERNS } from "@/types/motion";
import type { ActivityPatterns, MotionMetrics, MotionSample, MotionSource } from "@/types/motion";
import { MUSIC_BUCKETS } from "@/types/spotify";
import type {
  MusicBucket,
  PlaybackState,
  PlaylistRef,
  Playlist,
  SpotifyDevice,
  SpotifyMode,
  SpotifyUser,
  Track,
  TransitionInfo,
} from "@/types/spotify";
import type { CameraDevice, CameraStatus } from "@/services/camera/cameraService";

type PlaylistMappings = Record<MusicBucket, PlaylistRef | null>;

const EMPTY_MAPPINGS: PlaylistMappings = MUSIC_BUCKETS.reduce((acc, b) => {
  acc[b] = null;
  return acc;
}, {} as PlaylistMappings);

/** Rolling-window caps so memory stays bounded during long sessions. */
const HISTORY_CAP = 120;
const FEED_CAP = 30;

export interface UISettings {
  cameraSource: "webcam" | "iphone";
  resolution: "720p" | "1080p" | "4K";
  frameRate: 24 | 30 | 60;
  showOverlays: boolean;
  motionThreshold: number;
  idleTimeout: number;
  transitionAggressiveness: number;
  confidenceThreshold: number;
  stateCooldown: number;
  glowIntensity: number;
  animationIntensity: number;
}

export interface AtmosphereStore {
  // ── Camera ────────────────────────────────────────────────
  cameraConnected: boolean;
  cameraStatus: CameraStatus;
  cameraError: string | null;
  activeCameraDevice: string | null;
  cameraDevices: CameraDevice[];

  // ── Environment / atmosphere ──────────────────────────────
  environmentMode: EnvironmentMode;
  atmosphereState: AtmosphereState;
  motionEnergyScore: number;
  motionIntensity: number;
  subjectCount: number;
  confidenceScore: number;
  transitionRule: string;

  // ── Motion intelligence ───────────────────────────────────
  motionSource: MotionSource;
  motionHistory: MotionSample[];
  metrics: MotionMetrics;
  /** Latest special-activity detection flags. */
  activityPatterns: ActivityPatterns;
  /** Live velocity/persistence/rhythm/volatility for the current moment. */
  velocity: number;
  persistence: number;
  rhythmConsistency: number;
  volatility: number;

  // ── AI feed ───────────────────────────────────────────────
  aiInterpretationFeed: AIInterpretation[];

  // ── Spotify orchestration ─────────────────────────────────
  spotifyConnected: boolean;
  spotifyMode: SpotifyMode;
  spotifyUser: SpotifyUser | null;
  spotifyDevices: SpotifyDevice[];
  activeDeviceId: string | null;
  userPlaylists: PlaylistRef[];
  /** Persisted bucket → playlist mapping (null = use demo fallback). */
  playlistMappings: PlaylistMappings;
  activePlaylist: Playlist | null;
  activeBucket: MusicBucket | null;
  currentTrack: Track | null;
  playbackState: PlaybackState;
  currentBpm: number;
  /** Live playback position for the progress/countdown UI. */
  trackPositionMs: number;
  trackDurationMs: number;
  /** Current transition / cooldown phase. */
  transition: TransitionInfo;
  /** epoch ms of the last committed playlist transition. */
  lastTransitionAt: number;

  // ── UI settings ───────────────────────────────────────────
  settings: UISettings;

  // ── Actions ───────────────────────────────────────────────
  setEnvironmentMode: (mode: EnvironmentMode) => void;

  setCameraStatus: (status: CameraStatus, error?: string | null) => void;
  setCameraDevices: (devices: CameraDevice[]) => void;
  setActiveCameraDevice: (deviceId: string | null) => void;

  setMotionSource: (source: MotionSource) => void;
  ingestMotionSample: (sample: MotionSample) => void;

  applyAtmosphere: (state: AtmosphereState, confidence: number, rule: string) => void;
  setMetrics: (metrics: MotionMetrics) => void;

  pushInterpretation: (items: AIInterpretation[]) => void;
  setFeed: (items: AIInterpretation[]) => void;

  setSpotifyConnected: (connected: boolean) => void;
  setSpotifyMode: (mode: SpotifyMode) => void;
  setSpotifyUser: (user: SpotifyUser | null) => void;
  setSpotifyDevices: (devices: SpotifyDevice[]) => void;
  setActiveDeviceId: (deviceId: string | null) => void;
  setUserPlaylists: (playlists: PlaylistRef[]) => void;
  setPlaylistMapping: (bucket: MusicBucket, playlist: PlaylistRef | null) => void;
  setActiveBucket: (bucket: MusicBucket | null) => void;
  setTransition: (transition: TransitionInfo) => void;
  setLastTransitionAt: (t: number) => void;
  setTrackProgress: (positionMs: number, durationMs: number) => void;
  setMusic: (playlist: Playlist, track: Track) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setBpm: (bpm: number) => void;

  updateSettings: (patch: Partial<UISettings>) => void;
}

const DEFAULT_SETTINGS: UISettings = {
  cameraSource: "webcam",
  resolution: "1080p",
  frameRate: 30,
  showOverlays: true,
  motionThreshold: 65,
  idleTimeout: 30,
  transitionAggressiveness: 50,
  confidenceThreshold: 85,
  stateCooldown: 15,
  glowIntensity: 80,
  animationIntensity: 70,
};

export const useAtmosphereStore = create<AtmosphereStore>()(
  persist(
    (set) => ({
  // Camera
  cameraConnected: false,
  cameraStatus: "idle",
  cameraError: null,
  activeCameraDevice: null,
  cameraDevices: [],

  // Environment / atmosphere
  environmentMode: "gym",
  atmosphereState: "focused",
  motionEnergyScore: 42,
  motionIntensity: 38,
  subjectCount: 2,
  confidenceScore: 88,
  transitionRule: "Ambient state transition with gentle progression",

  // Motion
  motionSource: "mock",
  motionHistory: [],
  metrics: { crowdActivity: 50, motionConfidence: 88, motionPersistence: 38, rhythmStability: 75 },
  activityPatterns: { ...NO_PATTERNS },
  velocity: 38,
  persistence: 40,
  rhythmConsistency: 0,
  volatility: 0,

  // AI feed
  aiInterpretationFeed: [],

  // Spotify
  spotifyConnected: true,
  spotifyMode: "demo",
  spotifyUser: null,
  spotifyDevices: [],
  activeDeviceId: null,
  userPlaylists: [],
  playlistMappings: { ...EMPTY_MAPPINGS },
  activePlaylist: null,
  activeBucket: null,
  currentTrack: null,
  playbackState: "playing",
  currentBpm: 112,
  trackPositionMs: 0,
  trackDurationMs: 0,
  transition: {
    phase: "idle",
    fromBucket: null,
    toBucket: null,
    startedAt: 0,
    durationMs: 0,
    reason: "Awaiting environmental change",
  },
  lastTransitionAt: 0,

  // Settings
  settings: DEFAULT_SETTINGS,

  // ── Actions ───────────────────────────────────────────────
  setEnvironmentMode: (environmentMode) => set({ environmentMode }),

  setCameraStatus: (cameraStatus, error) =>
    set({
      cameraStatus,
      cameraConnected: cameraStatus === "connected",
      cameraError: error ?? (cameraStatus === "error" ? "Camera error" : null),
    }),
  setCameraDevices: (cameraDevices) => set({ cameraDevices }),
  setActiveCameraDevice: (activeCameraDevice) => set({ activeCameraDevice }),

  setMotionSource: (motionSource) => set({ motionSource }),

  ingestMotionSample: (sample) =>
    set((s) => {
      const motionHistory = [...s.motionHistory, sample].slice(-HISTORY_CAP);
      return {
        motionHistory,
        motionEnergyScore: sample.energy,
        motionIntensity: sample.intensity,
        subjectCount: sample.subjects,
        velocity: sample.velocity ?? sample.intensity,
        persistence: sample.persistence ?? s.persistence,
        rhythmConsistency: sample.rhythmConsistency ?? s.rhythmConsistency,
        volatility: sample.volatility ?? s.volatility,
        activityPatterns: sample.patterns ?? s.activityPatterns,
      };
    }),

  applyAtmosphere: (atmosphereState, confidenceScore, transitionRule) =>
    set({ atmosphereState, confidenceScore, transitionRule }),

  setMetrics: (metrics) => set({ metrics }),

  pushInterpretation: (items) =>
    set((s) =>
      items.length === 0
        ? s
        : { aiInterpretationFeed: [...items, ...s.aiInterpretationFeed].slice(0, FEED_CAP) },
    ),
  setFeed: (aiInterpretationFeed) => set({ aiInterpretationFeed }),

  setSpotifyConnected: (spotifyConnected) => set({ spotifyConnected }),
  setSpotifyMode: (spotifyMode) => set({ spotifyMode }),
  setSpotifyUser: (spotifyUser) => set({ spotifyUser }),
  setSpotifyDevices: (spotifyDevices) => set({ spotifyDevices }),
  setActiveDeviceId: (activeDeviceId) => set({ activeDeviceId }),
  setUserPlaylists: (userPlaylists) => set({ userPlaylists }),
  setPlaylistMapping: (bucket, playlist) =>
    set((s) => ({ playlistMappings: { ...s.playlistMappings, [bucket]: playlist } })),
  setActiveBucket: (activeBucket) => set({ activeBucket }),
  setTransition: (transition) => set({ transition }),
  setLastTransitionAt: (lastTransitionAt) => set({ lastTransitionAt }),
  setTrackProgress: (trackPositionMs, trackDurationMs) =>
    set({ trackPositionMs, trackDurationMs }),
  setMusic: (activePlaylist, currentTrack) =>
    set({ activePlaylist, currentTrack, currentBpm: currentTrack.bpm }),
  setPlaybackState: (playbackState) => set({ playbackState }),
  setBpm: (currentBpm) => set({ currentBpm }),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: "adaptive-atmosphere-spotify",
      storage: createJSONStorage(() => localStorage),
      // Only persist the user's durable Spotify preferences.
      partialize: (s) => ({
        spotifyMode: s.spotifyMode,
        activeDeviceId: s.activeDeviceId,
        playlistMappings: s.playlistMappings,
      }),
    },
  ),
);
