/**
 * motionAnalysisEngine — turns a stream of pose frames into rich motion
 * intelligence.
 *
 * It maintains a rolling ~3s buffer of per-frame movement and derives:
 *   • energy            heavily-smoothed environmental energy (0..100)
 *   • velocity          instantaneous movement speed (0..100)
 *   • direction         net movement vector (each axis -1..1)
 *   • persistence       how sustained recent movement is (0..100)
 *   • rhythmConsistency periodicity of movement, via autocorrelation (0..100)
 *   • volatility        erraticness / jerk (0..100)
 *
 * …plus the four special-activity patterns (repetitive, highIntensity,
 * synchronized, erratic) that distinguish a gym rep from a jujitsu scramble
 * from a synchronized dance floor.
 *
 * Everything is computed in normalized image space (0..1) so it is resolution
 * independent. Pure aggregation — no DOM, no model — so it is trivially testable
 * and is reused identically for the live webcam and uploaded-video pipelines.
 */

import { MOTION_KEYPOINTS } from "./poseConstants";
import { NO_PATTERNS } from "@/types/motion";
import type {
  ActivityPatterns,
  MotionAnalysis,
  PoseFrame,
  PoseSubject,
} from "@/types/motion";

/** Per-frame aggregate, retained in the rolling buffer. */
interface FrameMetric {
  t: number;
  dt: number;
  /** Mean keypoint speed across subjects (image-fraction / second). */
  speed: number;
  /** Net displacement direction this frame. */
  dx: number;
  dy: number;
  /** Per-subject speed (index-aligned) for synchronization analysis. */
  subjectSpeeds: number[];
  visibility: number;
  subjects: number;
}

/** Movement (image-fraction/sec) that should read as ~100 velocity. */
const SPEED_REF = 0.85;
/** Frames older than this (ms) are evicted from the buffer. */
const WINDOW_MS = 3000;
/** A frame counts toward "persistence" above this speed. */
const ACTIVE_SPEED = 0.04;

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function subjectSpeed(cur: PoseSubject, prev: PoseSubject): { speed: number; dx: number; dy: number } {
  let sum = 0;
  let dx = 0;
  let dy = 0;
  let n = 0;
  for (const idx of MOTION_KEYPOINTS) {
    const a = cur.keypoints[idx];
    const b = prev.keypoints[idx];
    if (!a || !b) continue;
    const vis = Math.min(a.visibility ?? 1, b.visibility ?? 1);
    if (vis < 0.3) continue;
    const ex = a.x - b.x;
    const ey = a.y - b.y;
    sum += Math.hypot(ex, ey);
    dx += ex;
    dy += ey;
    n += 1;
  }
  if (n === 0) return { speed: 0, dx: 0, dy: 0 };
  return { speed: sum / n, dx: dx / n, dy: dy / n };
}

/** Normalized autocorrelation peak (lag>min) of a 1-D signal → periodicity. */
function periodicity(signal: number[]): number {
  const n = signal.length;
  if (n < 12) return 0;
  const mean = signal.reduce((s, v) => s + v, 0) / n;
  const centered = signal.map((v) => v - mean);
  const denom = centered.reduce((s, v) => s + v * v, 0);
  if (denom < 1e-9) return 0;

  const minLag = Math.max(3, Math.floor(n * 0.12));
  const maxLag = Math.floor(n * 0.7);
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acc = 0;
    for (let i = 0; i + lag < n; i++) acc += centered[i] * centered[i + lag];
    best = Math.max(best, acc / denom);
  }
  return clamp(best, 0, 1);
}

/** Pearson correlation between two equal-length series. */
function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 6) return 0;
  const sa = a.slice(-n);
  const sb = b.slice(-n);
  const ma = sa.reduce((s, v) => s + v, 0) / n;
  const mb = sb.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = sa[i] - ma;
    const y = sb[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (da < 1e-9 || db < 1e-9) return 0;
  return num / Math.sqrt(da * db);
}

export class MotionAnalysisEngine {
  private buffer: FrameMetric[] = [];
  private prevFrame: PoseFrame | null = null;
  /** Per-subject-index recent speed series (for synchronization). */
  private subjectSeries: number[][] = [];
  private smoothedEnergy = 0;
  private peakVelocity = 0;

  reset(): void {
    this.buffer = [];
    this.prevFrame = null;
    this.subjectSeries = [];
    this.smoothedEnergy = 0;
    this.peakVelocity = 0;
  }

  /** Feed one detected frame. Returns the current analysis. */
  ingest(frame: PoseFrame): MotionAnalysis {
    const prev = this.prevFrame;
    const dt = prev ? Math.max(1, frame.t - prev.t) / 1000 : 1 / 30;

    let frameSpeedSum = 0;
    let dxSum = 0;
    let dySum = 0;
    let matched = 0;
    const subjectSpeeds: number[] = [];

    if (prev) {
      const pairs = Math.min(frame.subjects.length, prev.subjects.length);
      for (let i = 0; i < pairs; i++) {
        const { speed, dx, dy } = subjectSpeed(frame.subjects[i], prev.subjects[i]);
        const persec = speed / dt;
        subjectSpeeds[i] = persec;
        frameSpeedSum += persec;
        dxSum += dx / dt;
        dySum += dy / dt;
        matched += 1;
        // Maintain per-subject series for synchronization correlation.
        (this.subjectSeries[i] ??= []).push(persec);
        if (this.subjectSeries[i].length > 90) this.subjectSeries[i].shift();
      }
    }

    const meanSpeed = matched > 0 ? frameSpeedSum / matched : 0;
    const visibility = avgVisibility(frame);

    this.buffer.push({
      t: frame.t,
      dt,
      speed: meanSpeed,
      dx: matched > 0 ? dxSum / matched : 0,
      dy: matched > 0 ? dySum / matched : 0,
      subjectSpeeds,
      visibility,
      subjects: frame.subjects.length,
    });
    // Evict old frames.
    const cutoff = frame.t - WINDOW_MS;
    while (this.buffer.length > 0 && this.buffer[0].t < cutoff) this.buffer.shift();

    this.prevFrame = frame;
    return this.analyze(frame.t);
  }

  /** Compute the full analysis from the current buffer. */
  analyze(now: number): MotionAnalysis {
    const buf = this.buffer;
    if (buf.length < 2) {
      const subjects = this.prevFrame?.subjects.length ?? 0;
      this.smoothedEnergy *= 0.9;
      return {
        energy: Math.round(this.smoothedEnergy),
        velocity: 0,
        persistence: 0,
        rhythmConsistency: 0,
        volatility: 0,
        direction: { x: 0, y: 0 },
        subjects,
        confidence: subjects > 0 ? 70 : 40,
        patterns: { ...NO_PATTERNS },
      };
    }

    const speeds = buf.map((f) => f.speed);
    const recent = speeds.slice(-8);
    const recentMean = recent.reduce((s, v) => s + v, 0) / recent.length;

    // Velocity: scale recent mean speed against the reference.
    const velocity = clamp((recentMean / SPEED_REF) * 100);
    this.peakVelocity = Math.max(this.peakVelocity * 0.96, velocity);

    // Energy: heavily smoothed velocity, with a presence floor.
    const subjects = buf[buf.length - 1].subjects;
    const presence = subjects > 0 ? 4 + Math.min(subjects, 6) * 1.5 : 0;
    const target = Math.max(velocity * 0.92, presence);
    this.smoothedEnergy = this.smoothedEnergy * 0.86 + target * 0.14;
    const energy = clamp(this.smoothedEnergy);

    // Persistence: fraction of windowed frames that were "active".
    const activeFrac = buf.filter((f) => f.speed > ACTIVE_SPEED).length / buf.length;
    const persistence = clamp(activeFrac * 100);

    // Rhythm: autocorrelation periodicity of the speed signal.
    const rhythmConsistency = clamp(periodicity(speeds) * 100);

    // Volatility: normalized std-dev of frame-to-frame speed deltas (jerk).
    const deltas: number[] = [];
    for (let i = 1; i < speeds.length; i++) deltas.push(Math.abs(speeds[i] - speeds[i - 1]));
    const dMean = deltas.reduce((s, v) => s + v, 0) / Math.max(1, deltas.length);
    const dVar = deltas.reduce((s, v) => s + (v - dMean) ** 2, 0) / Math.max(1, deltas.length);
    const volatility = clamp(Math.sqrt(dVar) / (recentMean + 0.01) * 55);

    // Direction: net movement over the recent window.
    const dxN = buf.slice(-8).reduce((s, f) => s + f.dx, 0);
    const dyN = buf.slice(-8).reduce((s, f) => s + f.dy, 0);
    const dirMag = Math.hypot(dxN, dyN) || 1;
    const direction = {
      x: clamp((dxN / dirMag), -1, 1),
      y: clamp((dyN / dirMag), -1, 1),
    };

    // Synchronization: mean pairwise correlation of subject speed series.
    let sync = 0;
    if (subjects >= 2 && this.subjectSeries.length >= 2) {
      let acc = 0;
      let pairs = 0;
      for (let i = 0; i < this.subjectSeries.length; i++) {
        for (let j = i + 1; j < this.subjectSeries.length; j++) {
          acc += correlation(this.subjectSeries[i], this.subjectSeries[j]);
          pairs += 1;
        }
      }
      sync = pairs > 0 ? acc / pairs : 0;
    }

    const confidence = clamp(
      40 + avgRecentVisibility(buf) * 50 + Math.min(subjects, 4) * 2.5,
      40,
      99,
    );

    const patterns: ActivityPatterns = {
      highIntensity: this.peakVelocity > 70 || velocity > 72,
      repetitive: rhythmConsistency > 52 && persistence > 38 && velocity > 12 && velocity < 78,
      synchronized: subjects >= 2 && sync > 0.55,
      erratic: volatility > 62 && this.peakVelocity > 45,
    };

    void now;
    return {
      energy: Math.round(energy),
      velocity: Math.round(velocity),
      persistence: Math.round(persistence),
      rhythmConsistency: Math.round(rhythmConsistency),
      volatility: Math.round(volatility),
      direction,
      subjects,
      confidence: Math.round(confidence),
      patterns,
    };
  }
}

function avgVisibility(frame: PoseFrame): number {
  let sum = 0;
  let n = 0;
  for (const s of frame.subjects) {
    for (const k of s.keypoints) {
      sum += k.visibility ?? 1;
      n += 1;
    }
  }
  return n > 0 ? sum / n : 0;
}

function avgRecentVisibility(buf: FrameMetric[]): number {
  const recent = buf.slice(-10);
  if (recent.length === 0) return 0;
  return recent.reduce((s, f) => s + f.visibility, 0) / recent.length;
}
