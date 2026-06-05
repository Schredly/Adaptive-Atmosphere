/**
 * Atmosphere derivation — pure functions only.
 *
 * Turns motion intelligence (energy, velocity, subjects, and the special
 * activity patterns) into a discrete AtmosphereState, a confidence score, the
 * UI metrics, and the human-readable "transition rule". No side effects, no
 * store access — the engine hook owns orchestration; this file owns the math.
 *
 * Energy bands (per spec):
 *   0–10    idle room
 *   10–30   ambient / social
 *   30–60   active
 *   60–85   high energy
 *   85–100  chaotic / intense
 */

import { NO_PATTERNS } from "@/types/motion";
import type { AtmosphereState } from "@/types/atmosphere";
import type { ActivityPatterns, MotionMetrics, MotionSample } from "@/types/motion";

export interface AtmosphereReading {
  state: AtmosphereState;
  confidence: number;
}

export type EnergyBand = "idle" | "ambient" | "active" | "high" | "chaotic";

/** Coarse 5-band label of the 0..100 energy score. */
export function energyBand(energy: number): EnergyBand {
  if (energy < 10) return "idle";
  if (energy < 30) return "ambient";
  if (energy < 60) return "active";
  if (energy < 85) return "high";
  return "chaotic";
}

/**
 * Map motion → atmosphere across all seven states, pattern-aware.
 *
 * Patterns refine the raw band:
 *   • erratic spikes at high energy  → chaotic
 *   • focused repetitive movement    → focused (gym reps, drilling, pacing)
 *   • multiple synchronized subjects → social / active lean
 */
export function deriveAtmosphereState(
  energy: number,
  velocity: number,
  subjects: number,
  patterns: ActivityPatterns = NO_PATTERNS,
): AtmosphereState {
  // Strong pattern overrides first.
  if (patterns.erratic && energy >= 70) return "chaotic";
  if (patterns.repetitive && energy >= 22 && energy < 82) return "focused";

  const band = energyBand(energy);
  switch (band) {
    case "idle":
      return "idle";
    case "ambient":
      return subjects >= 3 ? "social" : "ambient";
    case "active":
      // Distinguish concentrated (focused) from dynamic (active) and group (social).
      if (subjects >= 3 && velocity < 45) return "social";
      if (velocity < 32) return "focused";
      return "active";
    case "high":
      return velocity >= 55 || patterns.highIntensity ? "intense" : "active";
    case "chaotic":
      return patterns.erratic || velocity >= 60 ? "chaotic" : "intense";
  }
}

/**
 * Confidence reflects detection quality + how cleanly the reading sits inside
 * its band. For live samples we trust the analyzer's own confidence more.
 */
export function deriveConfidence(sample: MotionSample): number {
  const { energy, intensity, subjects, confidence } = sample;
  const edges = [10, 30, 60, 85];
  const nearest = edges.reduce((min, edge) => Math.min(min, Math.abs(energy - edge)), Infinity);
  const marginScore = Math.min(1, nearest / 12);
  const subjectScore = subjects > 0 ? 1 : 0.55;
  const coherence = 1 - Math.abs(intensity - energy) / 100;
  const base = confidence / 100;

  // Live analyzer confidence is well-calibrated; weight it heavily.
  const baseWeight = sample.source === "live" ? 0.6 : 0.45;
  const raw =
    base * baseWeight +
    marginScore * 0.2 +
    subjectScore * 0.12 +
    coherence * (0.88 - baseWeight);
  return Math.round(Math.max(55, Math.min(99, raw * 100)));
}

/** The plain-language rule the Transition Engine panel displays. */
export function describeTransition(
  state: AtmosphereState,
  energy: number,
  velocity: number,
  patterns: ActivityPatterns = NO_PATTERNS,
): string {
  if (patterns.synchronized) return "Multi-subject synchronization locked — holding the groove";
  if (patterns.erratic && state === "chaotic") return "Erratic spikes detected — capping to prevent runaway escalation";
  if (patterns.repetitive && state === "focused") return "Focused repetitive movement — steady rhythmic adaptation";
  if (state === "chaotic") return "Saturating soundtrack at peak intensity";
  if (state === "intense") return "Driving peak playlist due to sustained high-velocity movement";
  if (energy >= 60) return "Escalating soundtrack due to sustained movement increase";
  if (velocity >= 35) return "Maintaining energy level with rhythmic adaptation";
  if (state === "idle") return "Settling into ambient bed — awaiting renewed activity";
  return "Ambient state transition with gentle progression";
}

/** Rolling, UI-facing metrics derived from recent motion history. */
export function computeMetrics(history: MotionSample[]): MotionMetrics {
  if (history.length === 0) {
    return { crowdActivity: 0, motionConfidence: 88, motionPersistence: 0, rhythmStability: 75 };
  }
  const recent = history.slice(-20);
  const avg = (sel: (s: MotionSample) => number) =>
    recent.reduce((sum, s) => sum + sel(s), 0) / recent.length;

  const avgSubjects = avg((s) => s.subjects);
  const avgConfidence = avg((s) => s.confidence);
  // Prefer the live persistence/rhythm signals when present.
  const avgPersistence = avg((s) => s.persistence ?? s.intensity);
  const avgRhythm = avg((s) => s.rhythmConsistency ?? 0);

  const avgEnergy = avg((s) => s.energy);
  const variance = recent.reduce((sum, s) => sum + (s.energy - avgEnergy) ** 2, 0) / recent.length;
  // Rhythm stability blends low energy-variance with measured periodicity.
  const stability = Math.max(0, 100 - Math.sqrt(variance) * 2.2) * 0.6 + avgRhythm * 0.4;

  return {
    crowdActivity: Math.round(Math.min(100, avgSubjects * 25)),
    motionConfidence: Math.round(avgConfidence),
    motionPersistence: Math.round(avgPersistence),
    rhythmStability: Math.round(Math.min(100, stability)),
  };
}

/** Full reading (state + confidence) from a sample, pattern-aware. */
export function read(sample: MotionSample): AtmosphereReading {
  const velocity = sample.velocity ?? sample.intensity;
  return {
    state: deriveAtmosphereState(sample.energy, velocity, sample.subjects, sample.patterns),
    confidence: deriveConfidence(sample),
  };
}
