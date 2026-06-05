/**
 * orchestrationEngine — the music decision engine.
 *
 * Pure function. Given the current atmosphere reading and the orchestrator's
 * memory (current bucket, last transition time, playback state), it decides
 * whether to hold, transition, pause, or resume — applying:
 *
 *   • confidence threshold   — ignore low-confidence atmosphere reads
 *   • transition cooldown     — avoid excessive playlist switching
 *   • idle → fade out / pause
 *   • escalate / de-escalate  — reasoned from bucket energy rank
 *   • BPM-aware crossfade      — bigger tempo jumps get longer fades
 *
 * The manager owns the side effects (talking to the controller); this owns the
 * logic so it stays testable.
 */

import { BUCKET_RANK, STATE_TO_BUCKET } from "@/types/spotify";
import type { AtmosphereState } from "@/types/atmosphere";
import type { MusicBucket } from "@/types/spotify";

export type OrchestrationAction = "hold" | "transition" | "pause" | "resume";

export interface OrchestrationInput {
  state: AtmosphereState;
  energy: number;
  confidence: number;
  now: number;
  currentBucket: MusicBucket | null;
  isPlaying: boolean;
  lastTransitionAt: number;
  /** Cooldown between committed transitions (ms). */
  cooldownMs: number;
  /** Minimum atmosphere confidence to act on (0..100). */
  confidenceThreshold: number;
  /** 0..100 — higher = shorter crossfades, snappier escalation. */
  transitionAggressiveness: number;
  /** Absolute BPM difference between current and target, if known. */
  bpmGap?: number;
}

export interface OrchestrationDecision {
  action: OrchestrationAction;
  targetBucket: MusicBucket;
  reason: string;
  /** Crossfade / fade duration (ms). */
  fadeMs: number;
  /** Cooldown to apply after a committed transition (ms). */
  cooldownMs: number;
  /** ms remaining on the active cooldown when the action is a hold. */
  cooldownRemainingMs: number;
}

/** Crossfade length from aggressiveness + tempo gap. */
export function computeFadeMs(aggressiveness: number, bpmGap = 0): number {
  const base = 3000 - aggressiveness * 22; // 0→3000ms, 100→800ms
  const tempo = Math.min(1200, Math.max(0, bpmGap) * 30); // bigger jump → smoother
  return Math.round(Math.max(700, Math.min(3500, base + tempo)));
}

export function decideOrchestration(input: OrchestrationInput): OrchestrationDecision {
  const {
    state,
    confidence,
    now,
    currentBucket,
    isPlaying,
    lastTransitionAt,
    cooldownMs,
    confidenceThreshold,
    transitionAggressiveness,
    bpmGap,
  } = input;

  const targetBucket = STATE_TO_BUCKET[state];
  const fadeMs = computeFadeMs(transitionAggressiveness, bpmGap);
  const cooldownRemainingMs = Math.max(0, cooldownMs - (now - lastTransitionAt));

  const base = (action: OrchestrationAction, reason: string, fade = fadeMs): OrchestrationDecision => ({
    action,
    targetBucket,
    reason,
    fadeMs: fade,
    cooldownMs,
    cooldownRemainingMs,
  });

  // 1. Idle → fade out / pause.
  if (state === "idle") {
    return isPlaying
      ? base("pause", "Idle room — fading out", 2500)
      : base("hold", "Idle — playback paused");
  }

  // 2. Resume if we were paused but the room is active again.
  if (!isPlaying) {
    return base("resume", `Activity resumed — entering ${targetBucket}`);
  }

  // 3. Don't act on low-confidence reads.
  if (confidence < confidenceThreshold) {
    return base("hold", `Confidence ${Math.round(confidence)}% below threshold`);
  }

  // 4. Already in the right bucket — stay put.
  if (currentBucket === targetBucket) {
    return base("hold", "Atmosphere stable — holding playlist");
  }

  // 5. Respect the cooldown to avoid thrashing.
  if (cooldownRemainingMs > 0) {
    return base("hold", `Cooldown — ${Math.ceil(cooldownRemainingMs / 1000)}s to next transition`);
  }

  // 6. Commit a transition, reasoned by direction.
  const fromRank = currentBucket ? BUCKET_RANK[currentBucket] : -1;
  const toRank = BUCKET_RANK[targetBucket];
  const reason =
    fromRank < 0
      ? `Starting playback in ${targetBucket}`
      : toRank > fromRank
        ? `Escalating energy → ${targetBucket}`
        : `De-escalating energy → ${targetBucket}`;
  return base("transition", reason);
}

export function describeBucket(bucket: MusicBucket): string {
  return bucket.charAt(0).toUpperCase() + bucket.slice(1);
}
