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
import type { AtmosphereState } from "@/types/atmosphere";
import type { MotionSample } from "@/types/motion";

/** How often the derivation loop runs (ms). */
const TICK_MS = 1300;

export function useAtmosphereEngine() {
  const simulatorRef = useRef(createMotionSimulator(42));
  const prevSampleRef = useRef<MotionSample | undefined>(undefined);
  const prevStateRef = useRef<AtmosphereState | undefined>(undefined);

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
      const { state, confidence } = read(sample);
      const rule = describeTransition(
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

      prevSampleRef.current = sample;
      prevStateRef.current = state;
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, []);
}
