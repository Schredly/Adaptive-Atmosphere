/**
 * Atmosphere domain types.
 *
 * The "atmosphere state" is the high-level emotional/energetic read of an
 * environment, derived from motion intelligence. The "environment mode" is the
 * operator-selected context that biases how raw motion maps onto state.
 */

export type AtmosphereState =
  | "idle"
  | "ambient"
  | "social"
  | "active"
  | "intense"
  | "focused"
  | "chaotic";

export const ATMOSPHERE_STATES: AtmosphereState[] = [
  "idle",
  "ambient",
  "social",
  "active",
  "intense",
  "focused",
  "chaotic",
];

export type EnvironmentMode =
  | "gym"
  | "jujitsu"
  | "lounge"
  | "retail"
  | "surf_skate"
  | "party";

export const ENVIRONMENT_MODES: EnvironmentMode[] = [
  "gym",
  "jujitsu",
  "lounge",
  "retail",
  "surf_skate",
  "party",
];

/** Presentation + tuning metadata for each atmosphere state. */
export interface AtmosphereStateConfig {
  state: AtmosphereState;
  label: string;
  /** Primary accent color (hex) used across the UI for this state. */
  color: string;
  /** Secondary color for gradients. */
  accent: string;
  /** Inclusive lower bound of the energy band that maps to this state. */
  energyFloor: number;
  description: string;
}

export const ATMOSPHERE_CONFIG: Record<AtmosphereState, AtmosphereStateConfig> = {
  idle: {
    state: "idle",
    label: "Idle",
    color: "#10b981",
    accent: "#06b6d4",
    energyFloor: 0,
    description: "Quiet space, minimal presence.",
  },
  ambient: {
    state: "ambient",
    label: "Ambient",
    color: "#06b6d4",
    accent: "#3b82f6",
    energyFloor: 20,
    description: "Gentle, low-key background activity.",
  },
  focused: {
    state: "focused",
    label: "Focused",
    color: "#3b82f6",
    accent: "#8b5cf6",
    energyFloor: 38,
    description: "Concentrated, deliberate engagement.",
  },
  social: {
    state: "social",
    label: "Social",
    color: "#8b5cf6",
    accent: "#3b82f6",
    energyFloor: 48,
    description: "Multiple people interacting, conversational energy.",
  },
  active: {
    state: "active",
    label: "Active",
    color: "#f59e0b",
    accent: "#3b82f6",
    energyFloor: 62,
    description: "Sustained, dynamic movement.",
  },
  intense: {
    state: "intense",
    label: "Intense",
    color: "#ef4444",
    accent: "#f59e0b",
    energyFloor: 80,
    description: "High-velocity, high-arousal environment.",
  },
  chaotic: {
    state: "chaotic",
    label: "Chaotic",
    color: "#ec4899",
    accent: "#ef4444",
    energyFloor: 92,
    description: "Peak, unpredictable, maximum-energy environment.",
  },
};

/** Operator-facing metadata for each environment mode. */
export interface EnvironmentModeConfig {
  mode: EnvironmentMode;
  /** Short id used by the original TopNav design. */
  id: string;
  label: string;
  color: string;
  /**
   * Bias applied to the raw motion energy before deriving atmosphere state.
   * Positive values make an environment read "hotter" for the same motion.
   */
  energyBias: number;
  /** How twitchy the simulation feels in this mode (0..1). */
  volatility: number;
  /** Typical BPM center the music orchestration targets. */
  targetBpm: number;
}

export const ENVIRONMENT_CONFIG: Record<EnvironmentMode, EnvironmentModeConfig> = {
  gym: { mode: "gym", id: "gym", label: "Gym", color: "#ef4444", energyBias: 14, volatility: 0.55, targetBpm: 128 },
  jujitsu: { mode: "jujitsu", id: "jujitsu", label: "Jujitsu", color: "#f59e0b", energyBias: 10, volatility: 0.7, targetBpm: 120 },
  party: { mode: "party", id: "party", label: "Party", color: "#ec4899", energyBias: 20, volatility: 0.8, targetBpm: 124 },
  lounge: { mode: "lounge", id: "lounge", label: "Lounge", color: "#8b5cf6", energyBias: -16, volatility: 0.25, targetBpm: 96 },
  retail: { mode: "retail", id: "retail", label: "Retail", color: "#3b82f6", energyBias: -6, volatility: 0.35, targetBpm: 108 },
  surf_skate: { mode: "surf_skate", id: "surf", label: "Surf/Skate", color: "#10b981", energyBias: 4, volatility: 0.5, targetBpm: 112 },
};

/** Maps a legacy TopNav id (e.g. "surf") to the canonical EnvironmentMode. */
export function modeFromId(id: string): EnvironmentMode {
  const match = ENVIRONMENT_MODES.find((m) => ENVIRONMENT_CONFIG[m].id === id);
  return match ?? "gym";
}

export type InterpretationLevel = "info" | "rising" | "peak" | "calm" | "alert";

/** A single line in the realtime AI interpretation feed. */
export interface AIInterpretation {
  id: string;
  text: string;
  level: InterpretationLevel;
  color: string;
  /** epoch ms */
  timestamp: number;
}

/** An immutable snapshot of the derived atmosphere at a point in time. */
export interface AtmosphereSnapshot {
  state: AtmosphereState;
  energy: number;
  confidence: number;
  timestamp: number;
}
