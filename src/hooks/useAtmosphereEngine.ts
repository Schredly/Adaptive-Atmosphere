/**
 * useAtmosphereEngine — the heartbeat of the application.
 *
 * Mounted once (in Layout) it runs a steady derivation loop that keeps the
 * entire store alive on every page:
 *   1. obtain a motion sample (mock simulator, or the latest live sample)
 *   2. derive atmosphere state + confidence + transition rule
 *   3. roll up UI metrics
 *   4. generate AI interpretation lines on meaningful change
 *
 * Music orchestration lives in useSpotifyOrchestration / spotifyManager, which
 * reacts to the atmosphereState this loop writes. Live pose data (when enabled)
 * flows into the store at frame rate via useMotionAnalysis; this loop reads the
 * freshest sample each tick, so state-change cadence stays cinematic.
 */

import { useEffect, useRef } from "react";

import { useAtmosphereStore } from "@/store/useAtmosphereStore";
import { createMotionSimulator } from "@/services/vision/motionEngine";
import {
  computeMetrics,
  describeTransition,
  read,
} from "@/services/atmosphere/atmosphereEngine";
import { interpret, seedFeed } from "@/services/ai/interpretationEngine";
import { isAIConfigured } from "@/services/ai/aiConfig";
import { interpretMotion } from "@/services/ai/visionInterpreter";
import { lookupLearnedMood } from "@/services/ai/learnedMoods";
import type { MotionSummary } from "@/services/ai/visionInterpreter";
import type { AtmosphereState } from "@/types/atmosphere";
import { NO_PATTERNS } from "@/types/motion";
import type { MotionSample } from "@/types/motion";

/** How often the derivation loop runs (ms). */
const TICK_MS = 1300;
/** Minimum gap between LLM calls when nothing changes (ms). */
const AI_MIN_INTERVAL = 6000;
/** A new mood must persist this long before we commit to it (anti-flicker). */
const MOOD_HYSTERESIS_MS = 3000;

export function useAtmosphereEngine() {
  const simulatorRef = useRef(createMotionSimulator(42));
  const prevSampleRef = useRef<MotionSample | undefined>(undefined);
  const prevStateRef = useRef<AtmosphereState | undefined>(undefined);
  const lastAiRef = useRef(0);
  // Committed (smoothed) mood + the pending candidate, for hysteresis.
  const committedStateRef = useRef<AtmosphereState | undefined>(undefined);
  const candidateRef = useRef<{ state: AtmosphereState; since: number } | null>(null);

  // Seed the AI feed once on mount.
  useEffect(() => {
    const store = useAtmosphereStore.getState();
    store.setFeed(seedFeed(Date.now()));
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const store = useAtmosphereStore.getState();

      // 1. Obtain a motion sample.
      let sample: MotionSample;
      if (store.motionSource === "mock") {
        sample = simulatorRef.current.tick(store.environmentMode);
        store.ingestMotionSample(sample);
      } else {
        // Live: use the freshest sample the pose pipeline pushed in.
        sample =
          store.motionHistory[store.motionHistory.length - 1] ?? {
            t: Date.now(),
            energy: store.motionEnergyScore,
            intensity: store.motionIntensity,
            subjects: store.subjectCount,
            confidence: store.confidenceScore,
            source: "live",
          };
      }

      // 2. Derive atmosphere (pattern-aware).
      const { state: ruleState, confidence } = read(sample);

      // Build the summary once (used by learned-override + AI augmentation).
      const summary: MotionSummary = {
        energy: sample.energy,
        velocity: sample.velocity ?? sample.intensity,
        persistence: sample.persistence ?? 0,
        rhythmConsistency: sample.rhythmConsistency ?? 0,
        volatility: sample.volatility ?? 0,
        subjects: sample.subjects,
        patterns: sample.patterns ?? NO_PATTERNS,
        ruleMood: ruleState,
        environmentMode: store.environmentMode,
      };

      // Desired mood = learned override (live sources only) or the rule call.
      let desired = ruleState;
      let learnedHit = false;
      if (store.motionSource === "live") {
        const learned = lookupLearnedMood(summary);
        if (learned && learned !== ruleState) {
          desired = learned;
          learnedHit = true;
        }
      }

      // A learned (human-corrected) mood is explicit intent → commit instantly,
      // skipping the anti-flicker hysteresis. Rule-derived moods still smooth.
      const nowMs = Date.now();
      let state = committedStateRef.current ?? desired;
      if (learnedHit) {
        state = desired;
        candidateRef.current = null;
      } else if (desired === state) {
        candidateRef.current = null;
      } else {
        if (!candidateRef.current || candidateRef.current.state !== desired) {
          candidateRef.current = { state: desired, since: nowMs };
        }
        if (nowMs - candidateRef.current.since >= MOOD_HYSTERESIS_MS) {
          state = desired;
          candidateRef.current = null;
        }
      }
      committedStateRef.current = state;

      const rule =
        learnedHit && state === desired
          ? `Learned from your feedback → ${state}`
          : describeTransition(
              state,
              sample.energy,
              sample.velocity ?? sample.intensity,
              sample.patterns,
            );
      store.applyAtmosphere(state, confidence, rule);

      // 3. Metrics.
      store.setMetrics(computeMetrics(store.motionHistory));

      // 4. AI interpretation feed.
      const lines = interpret(sample, state, {
        previous: prevSampleRef.current,
        previousState: prevStateRef.current,
      });
      store.pushInterpretation(lines);

      // 5. Optional LLM augmentation: when a real source is live and AI is
      // configured, ask the model for a richer mood read on change / periodically.
      if (store.motionSource === "live" && isAIConfigured()) {
        const now = Date.now();
        const changed = state !== prevStateRef.current;
        if (changed || now - lastAiRef.current > AI_MIN_INTERVAL) {
          lastAiRef.current = now;
          void interpretMotion(summary)
            .then((r) => useAtmosphereStore.getState().setAIRead(r))
            .catch(() => {
              /* API down/misconfigured — keep using the rule engine */
            });
        }
      }

      prevSampleRef.current = sample;
      prevStateRef.current = state;
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, []);
}
