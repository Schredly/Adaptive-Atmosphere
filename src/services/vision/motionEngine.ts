/**
 * Mock motion engine — the cinematic simulator.
 *
 * Produces a believable, continuously-evolving stream of MotionSamples without
 * any camera. It models energy as a momentum-driven random walk with periodic
 * "events" (surges and lulls), biased by the active environment mode. The goal
 * is motion that feels *intentional* — it builds, peaks, and settles — rather
 * than white noise.
 *
 * Swap this for `poseService` output (see useMotionAnalysis) to drive the same
 * MotionSample shape from a live feed.
 */

import { ENVIRONMENT_CONFIG } from "@/types/atmosphere";
import type { EnvironmentMode } from "@/types/atmosphere";
import type { ActivityPatterns, MotionSample } from "@/types/motion";

interface SimState {
  energy: number; // 0..100, smoothed
  momentum: number; // signed drift
  subjects: number;
  /** ticks remaining in the current "event" (surge/lull). */
  eventTtl: number;
  /** signed target pull during an event. */
  eventPull: number;
  /** rolling intensity history for persistence/volatility/rhythm. */
  recent: number[];
  /** ticks remaining in a focused "drill" (repetitive) phase. */
  drillTtl: number;
  /** phase accumulator for the periodic drill signal. */
  drillPhase: number;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function createMotionSimulator(initialEnergy = 42) {
  const state: SimState = {
    energy: initialEnergy,
    momentum: 0,
    subjects: 2,
    eventTtl: 0,
    eventPull: 0,
    recent: [],
    drillTtl: 0,
    drillPhase: 0,
  };

  function tick(mode: EnvironmentMode): MotionSample {
    const cfg = ENVIRONMENT_CONFIG[mode];

    // Occasionally kick off a directional "event": a surge or a lull.
    if (state.eventTtl <= 0 && Math.random() < 0.12 * (0.5 + cfg.volatility)) {
      const surging = Math.random() < 0.55;
      state.eventTtl = 4 + Math.floor(Math.random() * 8);
      state.eventPull = surging ? 2.4 : -2.0;
    }

    // Momentum integrates a gentle pull toward the mode's natural center plus
    // any active event, with volatility-scaled noise.
    const center = 50 + cfg.energyBias;
    const restoring = (center - state.energy) * 0.015;
    const eventForce = state.eventTtl > 0 ? state.eventPull : 0;
    const noise = (Math.random() - 0.5) * (3 + cfg.volatility * 7);

    state.momentum = state.momentum * 0.7 + restoring + eventForce * 0.5 + noise * 0.3;
    state.energy = clamp(state.energy + state.momentum);
    if (state.eventTtl > 0) state.eventTtl -= 1;

    // Occasionally enter a focused, periodic "drill" phase (reps / drilling /
    // pacing) so the mock surfaces the repetitive pattern believably.
    if (state.drillTtl <= 0 && Math.random() < 0.05) {
      state.drillTtl = 8 + Math.floor(Math.random() * 10);
    }
    let drillBoost = 0;
    if (state.drillTtl > 0) {
      state.drillTtl -= 1;
      state.drillPhase += Math.PI / 4;
      drillBoost = Math.sin(state.drillPhase) * 14; // periodic component
    }

    // Instantaneous intensity tracks the magnitude of change + a volatility
    // floor, so fast environments read "twitchy" even at moderate energy.
    const momentumMag = Math.abs(state.momentum);
    const intensity = clamp(
      state.energy * 0.55 +
        momentumMag * 9 +
        cfg.volatility * 18 +
        drillBoost +
        (Math.random() - 0.5) * 8,
    );

    // Maintain a short intensity history for derived metrics.
    state.recent.push(intensity);
    if (state.recent.length > 24) state.recent.shift();
    const recent = state.recent;

    const velocity = intensity;
    const persistence = clamp((recent.filter((v) => v > 28).length / Math.max(1, recent.length)) * 100);

    // Volatility = normalized jerk.
    let jerk = 0;
    for (let i = 1; i < recent.length; i++) jerk += Math.abs(recent[i] - recent[i - 1]);
    const jerkMean = jerk / Math.max(1, recent.length - 1);
    const volatility = clamp(jerkMean * 1.7 + cfg.volatility * 22);

    // Rhythm consistency: high during a drill phase, otherwise inversely
    // related to volatility (steady movement reads as rhythmic).
    const rhythmConsistency = clamp(
      state.drillTtl > 0 ? 62 + Math.random() * 22 : Math.max(0, 60 - volatility * 0.7),
    );

    const direction = {
      x: clamp(Math.sin(state.drillPhase * 0.5 + state.energy * 0.02), -1, 1),
      y: clamp((Math.random() - 0.5) * 1.4, -1, 1),
    };

    const patterns: ActivityPatterns = {
      highIntensity: intensity > 72,
      repetitive: rhythmConsistency > 55 && persistence > 38 && state.energy > 22 && state.energy < 82,
      synchronized:
        state.subjects >= 3 &&
        (mode === "party" || mode === "jujitsu") &&
        state.energy > 45 &&
        rhythmConsistency > 45,
      erratic: volatility > 60 && intensity > 45,
    };

    // Subjects drift slowly and scale with energy/party-ness.
    const subjectTarget = 1 + Math.round((state.energy / 100) * (mode === "party" ? 5 : 3));
    if (Math.random() < 0.18) {
      state.subjects = clamp(
        state.subjects + Math.sign(subjectTarget - state.subjects),
        0,
        8,
      );
    }

    const confidence = clamp(84 + Math.random() * 12, 0, 100);

    return {
      t: Date.now(),
      energy: Math.round(state.energy * 10) / 10,
      intensity: Math.round(intensity),
      subjects: Math.max(1, state.subjects),
      confidence: Math.round(confidence * 10) / 10,
      source: "mock",
      velocity: Math.round(velocity),
      persistence: Math.round(persistence),
      rhythmConsistency: Math.round(rhythmConsistency),
      volatility: Math.round(volatility),
      direction,
      patterns,
    };
  }

  /** Force the internal energy (e.g. when handing off from a live feed). */
  function seed(energy: number) {
    state.energy = clamp(energy);
    state.momentum = 0;
  }

  return { tick, seed };
}

export type MotionSimulator = ReturnType<typeof createMotionSimulator>;
