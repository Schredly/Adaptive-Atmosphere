/**
 * Pose service — multi-person pose detection via MediaPipe Pose.
 *
 * Lazy-loads the MediaPipe Tasks Vision WASM bundle (so the app boots instantly
 * in mock mode) and, per video frame, emits a structured `PoseFrame` of
 * normalized landmarks. It is camera-agnostic: the same service drives both the
 * live webcam (useMotionAnalysis) and uploaded-video analysis (Test Mode).
 *
 * The numeric *interpretation* of those frames lives in motionAnalysisEngine —
 * this file is purely "pixels → landmarks".
 */

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { PoseFrame, PoseKeypoint, PoseSubject } from "@/types/motion";

const MODEL_URL =
  import.meta.env.VITE_POSE_MODEL_URL ??
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";

type Delegate = "GPU" | "CPU";

/**
 * Preferred inference backend. GPU is fastest, but on some machines (notably
 * certain macOS GPUs) the GPU delegate loads cleanly yet silently returns *no*
 * landmarks. We default to GPU and auto-fall-back to CPU when that happens; set
 * `VITE_POSE_DELEGATE=CPU` to skip GPU entirely.
 */
const PREFERRED_DELEGATE: Delegate =
  (import.meta.env.VITE_POSE_DELEGATE ?? "GPU").toUpperCase() === "CPU" ? "CPU" : "GPU";

/**
 * Consecutive empty GPU detections (with frames actively flowing) after which we
 * assume the GPU delegate is non-functional and rebuild on CPU. ~1s @ 30fps.
 */
const EMPTY_FALLBACK_FRAMES = 30;

type PoseLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { landmarks?: NormalizedLandmark[][] };
  close: () => void;
};

/** How many people to track simultaneously. */
const MAX_POSES = 4;

function toKeypoints(landmarks: NormalizedLandmark[]): PoseKeypoint[] {
  return landmarks.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility }));
}

function centroidOf(keypoints: PoseKeypoint[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const k of keypoints) {
    if ((k.visibility ?? 1) < 0.3) continue;
    sx += k.x;
    sy += k.y;
    n += 1;
  }
  return n > 0 ? { x: sx / n, y: sy / n } : { x: 0.5, y: 0.5 };
}

export class PoseService {
  private landmarker: PoseLandmarkerLike | null = null;
  private loadingPromise: Promise<void> | null = null;
  private lastTimestamp = -1;

  private delegate: Delegate = PREFERRED_DELEGATE;
  private emptyStreak = 0;
  private detectedEver = false;
  private fallbackTried = false;
  private rebuilding = false;

  get ready(): boolean {
    return this.landmarker !== null;
  }

  /** Build a landmarker on the given backend. */
  private async build(delegate: Delegate): Promise<PoseLandmarkerLike> {
    const vision = await import("@mediapipe/tasks-vision");
    const { FilesetResolver, PoseLandmarker } = vision;
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    return (await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numPoses: MAX_POSES,
      minPoseDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
    })) as unknown as PoseLandmarkerLike;
  }

  /** Lazy-load the model. Concurrent callers share one load. */
  async start(): Promise<void> {
    if (this.landmarker) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      this.landmarker = await this.build(this.delegate);
    })();

    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * When the GPU delegate is loaded but yields nothing for a sustained stretch
   * of frames, transparently rebuild on CPU and swap it in. Runs at most once.
   */
  private maybeFallbackToCPU(): void {
    if (
      this.fallbackTried ||
      this.rebuilding ||
      this.delegate !== "GPU" ||
      this.detectedEver ||
      this.emptyStreak < EMPTY_FALLBACK_FRAMES
    ) {
      return;
    }
    this.fallbackTried = true;
    this.rebuilding = true;
    void (async () => {
      try {
        const cpu = await this.build("CPU");
        const old = this.landmarker;
        this.landmarker = cpu;
        this.delegate = "CPU";
        this.lastTimestamp = -1;
        this.emptyStreak = 0;
        old?.close();
        console.info(
          "[poseService] GPU delegate returned no detections — switched to CPU.",
        );
      } catch {
        // Couldn't build CPU; stay on GPU rather than break the feed.
      } finally {
        this.rebuilding = false;
      }
    })();
  }

  /**
   * Run detection on a video frame and return a structured PoseFrame.
   * `timestamp` (ms) must be monotonically increasing; we guard against
   * non-monotonic values (e.g. when scrubbing) by nudging forward.
   */
  detect(video: HTMLVideoElement, timestamp: number, mirrored = false): PoseFrame | null {
    if (!this.landmarker || video.readyState < 2) return null;

    let ts = timestamp;
    if (ts <= this.lastTimestamp) ts = this.lastTimestamp + 1;
    this.lastTimestamp = ts;

    const result = this.landmarker.detectForVideo(video, ts);
    const people = result.landmarks ?? [];

    const subjects: PoseSubject[] = people.map((landmarks, i) => {
      const keypoints = toKeypoints(landmarks);
      return { id: i, keypoints, centroid: centroidOf(keypoints) };
    });

    // Track detection health so a dead GPU delegate can fall back to CPU.
    if (subjects.length > 0) {
      this.detectedEver = true;
      this.emptyStreak = 0;
    } else {
      this.emptyStreak += 1;
      this.maybeFallbackToCPU();
    }

    return { t: Date.now(), subjects, mirrored };
  }

  /** Reset the monotonic timestamp guard (call when switching sources/seeking). */
  resetClock(): void {
    this.lastTimestamp = -1;
  }

  stop(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.loadingPromise = null;
    this.lastTimestamp = -1;
    this.emptyStreak = 0;
    this.detectedEver = false;
    this.fallbackTried = false;
    this.delegate = PREFERRED_DELEGATE;
  }
}

export const poseService = new PoseService();
