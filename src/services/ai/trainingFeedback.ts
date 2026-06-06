/**
 * trainingFeedback — capture human labels on the system's mood/music calls for
 * long-term model training.
 *
 * Stored locally (localStorage) as a capped log and exportable as JSONL. There's
 * no backend yet, so this is the collection layer: each entry pairs the motion
 * summary + what the system chose with the user's rating and (optional)
 * correction, ready to feed a future training pipeline.
 */

import type { AtmosphereState } from "@/types/atmosphere";
import type { MusicBucket } from "@/types/spotify";
import type { MotionSummary } from "./visionInterpreter";

export interface FeedbackEntry {
  at: number;
  rating: "up" | "down";
  /** What the system showed when the user gave feedback. */
  systemMood: AtmosphereState;
  systemBucket: MusicBucket | null;
  track: string | null;
  source: "rules" | "ai";
  /** The user's corrected mood, if they provided one. */
  correctedMood?: AtmosphereState;
  note?: string;
  /** The motion summary at the time, for training context. */
  summary?: MotionSummary;
}

const LS_KEY = "aa_training_feedback";
const CAP = 500;

export function getFeedback(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as FeedbackEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordFeedback(entry: FeedbackEntry): FeedbackEntry[] {
  const all = [...getFeedback(), entry].slice(-CAP);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {
    /* storage full / unavailable */
  }
  return all;
}

export function clearFeedback(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* noop */
  }
}

/** Serialize the log as JSONL (one training example per line). */
export function toJSONL(): string {
  return getFeedback()
    .map((e) => JSON.stringify(e))
    .join("\n");
}

/** Trigger a browser download of the feedback log as a .jsonl file. */
export function downloadFeedback(): void {
  const blob = new Blob([toJSONL()], { type: "application/jsonl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "adaptive-atmosphere-feedback.jsonl";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
