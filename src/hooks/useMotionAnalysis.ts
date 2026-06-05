/**
 * useMotionAnalysis — runs the live computer-vision pipeline over a video feed.
 *
 *   webcam <video>  →  poseService (MediaPipe Pose)  →  PoseFrame
 *                    →  MotionAnalysisEngine          →  MotionAnalysis
 *                    →  visionBus (every frame, for the canvas overlay)
 *                    →  store    (throttled ~8Hz, for the React UI)
 *
 * Performance: pose detection is capped (~24 fps) independent of the render
 * loop, the overlay reads the bus without re-rendering React, and store writes
 * are throttled so the numeric UI updates smoothly without jitter. If the model
 * can't load it falls back to mock mode — the simulation keeps the UI alive.
 *
 * By default `preferLive` follows VITE_MOTION_SOURCE, so the app ships in mock
 * mode and live analysis is one env flag (or Settings toggle) away.
 */

import { useEffect, useRef, useState } from "react";

import { poseService } from "@/services/vision/poseService";
import { MotionAnalysisEngine } from "@/services/vision/motionAnalysisEngine";
import { visionBus } from "@/services/vision/visionBus";
import { useAtmosphereStore } from "@/store/useAtmosphereStore";
import type { MotionSample } from "@/types/motion";

const ENV_PREFERS_LIVE = import.meta.env.VITE_MOTION_SOURCE === "live";

/** Cap pose detection (ms between detects) — ~24fps is plenty and stable. */
const DETECT_INTERVAL = 1000 / 24;
/** Throttle store writes (ms) so the React UI updates smoothly. */
const STORE_INTERVAL = 120;

export interface UseMotionAnalysisOptions {
  enabled: boolean;
  preferLive?: boolean;
}

export interface UseMotionAnalysisResult {
  mode: "mock" | "live";
  loading: boolean;
  error: string | null;
}

export function useMotionAnalysis(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  { enabled, preferLive = ENV_PREFERS_LIVE }: UseMotionAnalysisOptions,
): UseMotionAnalysisResult {
  const [mode, setMode] = useState<"mock" | "live">("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const ingestMotionSample = useAtmosphereStore((s) => s.ingestMotionSample);
  const setMotionSource = useAtmosphereStore((s) => s.setMotionSource);

  useEffect(() => {
    let cancelled = false;
    const analyzer = new MotionAnalysisEngine();
    let lastDetect = 0;
    let lastStore = 0;

    async function startLive() {
      if (!enabled || !preferLive) return;
      setLoading(true);
      setError(null);
      try {
        await poseService.start();
        if (cancelled) return;
        poseService.resetClock();
        analyzer.reset();
        setMotionSource("live");
        setMode("live");

        const loop = (ts: number) => {
          rafRef.current = requestAnimationFrame(loop);
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;
          if (ts - lastDetect < DETECT_INTERVAL) return;
          lastDetect = ts;

          const frame = poseService.detect(video, performance.now(), true);
          if (!frame) return;
          const analysis = analyzer.ingest(frame);

          // Every frame → overlay (cheap, no React).
          visionBus.publish(frame, analysis, video.videoWidth, video.videoHeight);

          // Throttled → store (drives the React UI).
          if (ts - lastStore >= STORE_INTERVAL) {
            lastStore = ts;
            const sample: MotionSample = {
              t: Date.now(),
              energy: analysis.energy,
              intensity: analysis.velocity,
              subjects: analysis.subjects,
              confidence: analysis.confidence,
              source: "live",
              velocity: analysis.velocity,
              persistence: analysis.persistence,
              rhythmConsistency: analysis.rhythmConsistency,
              volatility: analysis.volatility,
              direction: analysis.direction,
              patterns: analysis.patterns,
            };
            ingestMotionSample(sample);
          }
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Pose model unavailable — using simulation.");
        setMotionSource("mock");
        setMode("mock");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void startLive();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      visionBus.clear();
      poseService.resetClock();
      // Keep the model warm (singleton) but hand control back to the simulator.
      useAtmosphereStore.getState().setMotionSource("mock");
      setMode("mock");
    };
  }, [enabled, preferLive, videoRef, ingestMotionSample, setMotionSource]);

  return { mode, loading, error };
}
