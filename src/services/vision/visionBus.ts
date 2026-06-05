/**
 * visionBus — a tiny in-memory channel for high-frequency vision data.
 *
 * Pose frames and analysis arrive at video frame rate (~30Hz). Routing that
 * through Zustand would thrash every subscriber. Instead, the canvas overlays
 * read the latest value from this bus inside their own requestAnimationFrame
 * loop, while only throttled, numeric summaries go to the store for the React
 * UI. One bus per app; multiple consumers (Dashboard overlay, Test Mode overlay)
 * read the `current` snapshot.
 */

import type { MotionAnalysis, PoseFrame } from "@/types/motion";

export interface VisionSnapshot {
  frame: PoseFrame | null;
  analysis: MotionAnalysis | null;
  /** Display surface dimensions the producer last saw (for scaling). */
  sourceWidth: number;
  sourceHeight: number;
}

type Listener = (snapshot: VisionSnapshot) => void;

class VisionBus {
  private snapshot: VisionSnapshot = {
    frame: null,
    analysis: null,
    sourceWidth: 0,
    sourceHeight: 0,
  };
  private listeners = new Set<Listener>();

  get current(): VisionSnapshot {
    return this.snapshot;
  }

  publish(frame: PoseFrame | null, analysis: MotionAnalysis | null, w = 0, h = 0): void {
    this.snapshot = {
      frame,
      analysis,
      sourceWidth: w || this.snapshot.sourceWidth,
      sourceHeight: h || this.snapshot.sourceHeight,
    };
    this.listeners.forEach((cb) => cb(this.snapshot));
  }

  /** Clear when a feed stops, so stale skeletons don't linger. */
  clear(): void {
    this.publish(null, null, 0, 0);
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

export const visionBus = new VisionBus();
