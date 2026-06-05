/**
 * Motion intelligence types.
 *
 * A MotionSample is the atomic unit produced by the motion engine — whether
 * that engine is the cinematic mock simulator or the live MediaPipe Pose +
 * motionAnalysisEngine pipeline. The rich analysis fields are optional so the
 * mock simulator and the real analyzer stay interchangeable.
 */

export type MotionSource = "mock" | "live";

/** Special activity patterns the analysis engine detects. */
export interface ActivityPatterns {
  /** Sustained, periodic movement in a stable region (reps, drilling, pacing). */
  repetitive: boolean;
  /** High instantaneous velocity / explosive movement. */
  highIntensity: boolean;
  /** Multiple subjects moving in correlated rhythm (group classes, dancing). */
  synchronized: boolean;
  /** Sudden, high-variance spikes (scrambles, crashes, mosh energy). */
  erratic: boolean;
}

export const NO_PATTERNS: ActivityPatterns = {
  repetitive: false,
  highIntensity: false,
  synchronized: false,
  erratic: false,
};

export interface MotionSample {
  /** epoch ms */
  t: number;
  /** Smoothed environment energy, 0..100. */
  energy: number;
  /** Instantaneous movement intensity / velocity, 0..100. */
  intensity: number;
  /** Number of detected subjects in frame. */
  subjects: number;
  /** Detection confidence, 0..100. */
  confidence: number;
  /** Where this sample came from. */
  source: MotionSource;

  // ── Rich analysis (live pipeline; optional for the mock simulator) ──
  /** Movement speed, 0..100. */
  velocity?: number;
  /** How sustained recent movement is, 0..100. */
  persistence?: number;
  /** Periodicity / rhythm consistency, 0..100. */
  rhythmConsistency?: number;
  /** Erraticness, 0..100. */
  volatility?: number;
  /** Net directional movement vector, each component -1..1. */
  direction?: { x: number; y: number };
  /** Detected special-activity flags. */
  patterns?: ActivityPatterns;
}

/** A normalized pose keypoint (MediaPipe-compatible, 0..1 image space). */
export interface PoseKeypoint {
  x: number;
  y: number;
  /** Out-of-plane depth (relative). */
  z?: number;
  /** Visibility / presence confidence, 0..1. */
  visibility?: number;
}

/** One detected person's pose for a single frame. */
export interface PoseSubject {
  id: number;
  keypoints: PoseKeypoint[];
  /** Centroid of visible keypoints, 0..1 image space. */
  centroid: { x: number; y: number };
}

/** Result of a single pose-detection pass over a video frame. */
export interface PoseFrame {
  t: number;
  subjects: PoseSubject[];
  /** True if the source video is horizontally mirrored (selfie webcam). */
  mirrored: boolean;
}

/** Full analysis output for a moment in time. */
export interface MotionAnalysis {
  energy: number;
  velocity: number;
  persistence: number;
  rhythmConsistency: number;
  volatility: number;
  direction: { x: number; y: number };
  subjects: number;
  confidence: number;
  patterns: ActivityPatterns;
}

/** Aggregate, UI-facing motion metrics derived from history. */
export interface MotionMetrics {
  crowdActivity: number;
  motionConfidence: number;
  motionPersistence: number;
  rhythmStability: number;
}
