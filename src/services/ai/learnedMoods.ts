/**
 * learnedMoods — turns the user's mood corrections into behavior that carries
 * forward to *similar* videos, entirely in the browser.
 *
 * Each correction is stored against a coarse motion "signature" (environment +
 * energy band + crowd size + active patterns). When a new clip produces a
 * matching signature, the engine applies the learned mood (overriding the rule
 * call), and the LLM (when on) gets recent corrections as few-shot examples.
 * No backend — this is the lightweight, immediate learning layer; the exported
 * JSONL feedback log remains the path to real offline fine-tuning.
 */

import type { AtmosphereState } from "@/types/atmosphere";
import type { MotionSummary } from "./visionInterpreter";

const LS_KEY = "aa_learned_moods";

interface LearnedEntry {
  mood: AtmosphereState;
  count: number;
  at: number;
  summary: MotionSummary;
}
type LearnedMap = Record<string, LearnedEntry>;

/** Coarse, match-on-similar key for a motion summary. */
export function signatureOf(s: MotionSummary): string {
  const band = Math.min(4, Math.max(0, Math.floor(s.energy / 20))); // 0..4
  const crowd = s.subjects <= 0 ? "0" : s.subjects === 1 ? "1" : "2+";
  const pats =
    Object.entries(s.patterns)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .sort()
      .join("+") || "none";
  return `${s.environmentMode}|e${band}|c${crowd}|${pats}`;
}

function load(): LearnedMap {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as LearnedMap;
  } catch {
    return {};
  }
}
function save(m: LearnedMap): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable */
  }
}

/** Record a human correction for the current motion signature. */
export function learnCorrection(summary: MotionSummary, mood: AtmosphereState): void {
  const m = load();
  const sig = signatureOf(summary);
  const prev = m[sig];
  m[sig] = {
    mood,
    count: prev && prev.mood === mood ? prev.count + 1 : 1,
    at: Date.now(),
    summary,
  };
  save(m);
}

/** The learned mood for a signature, if the user has corrected one like it. */
export function lookupLearnedMood(summary: MotionSummary): AtmosphereState | null {
  return load()[signatureOf(summary)]?.mood ?? null;
}

/** Recent corrections, for seeding the LLM as few-shot examples. */
export function learnedExamples(limit = 6): { summary: MotionSummary; mood: AtmosphereState }[] {
  return Object.values(load())
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map((e) => ({ summary: e.summary, mood: e.mood }));
}

export function learnedCount(): number {
  return Object.keys(load()).length;
}

export function clearLearned(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* noop */
  }
}
