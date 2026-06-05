/**
 * AI interpretation feed generator.
 *
 * Produces the cinematic, human-readable lines shown in the Dashboard's
 * "AI Interpretation" panel. It reacts to *changes* (state transitions, energy
 * trend reversals) rather than emitting on every tick, so the feed reads like a
 * thinking system instead of a metronome.
 */

import { ATMOSPHERE_CONFIG } from "@/types/atmosphere";
import type { AIInterpretation, AtmosphereState, InterpretationLevel } from "@/types/atmosphere";
import type { MotionSample } from "@/types/motion";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `ai-${counter}`;
}

function make(text: string, level: InterpretationLevel, color: string, t: number): AIInterpretation {
  return { id: nextId(), text, level, color, timestamp: t };
}

const STATE_ENTRY: Record<AtmosphereState, string> = {
  idle: "Environment entering idle state",
  ambient: "Environment settling into ambient state",
  focused: "Focused engagement pattern recognized",
  social: "Social interaction cluster detected",
  active: "Active movement regime engaged",
  intense: "High-intensity environment confirmed",
  chaotic: "Chaotic energy surge — peak orchestration",
};

const AMBIENT_FLAVOR: { text: string; level: InterpretationLevel; color: string }[] = [
  { text: "Moderate environmental activity detected", level: "info", color: "#3b82f6" },
  { text: "Subjects holding steady formation", level: "info", color: "#3b82f6" },
  { text: "Rhythmic motion pattern stabilizing", level: "info", color: "#8b5cf6" },
  { text: "Crowd density within nominal range", level: "info", color: "#10b981" },
];

export interface InterpretationContext {
  /** Previous sample, if any, to compute trend. */
  previous?: MotionSample;
  previousState?: AtmosphereState;
}

/**
 * Given the latest sample + derived state, return zero or more interpretation
 * lines to prepend to the feed. Usually 0–1 lines per call.
 */
export function interpret(
  sample: MotionSample,
  state: AtmosphereState,
  ctx: InterpretationContext,
): AIInterpretation[] {
  const out: AIInterpretation[] = [];
  const cfg = ATMOSPHERE_CONFIG[state];
  const t = sample.t;

  // 1. State transition is always worth a line.
  if (ctx.previousState && ctx.previousState !== state) {
    const level: InterpretationLevel =
      cfg.energyFloor >= 80 ? "peak" : state === "idle" ? "calm" : "rising";
    out.push(make(STATE_ENTRY[state], level, cfg.color, t));
    return out; // one strong signal per transition is enough
  }

  // 2. Energy trend reversals / strong slopes.
  if (ctx.previous) {
    const delta = sample.energy - ctx.previous.energy;
    if (delta > 6) {
      out.push(make("Movement intensity increasing", "rising", "#f59e0b", t));
      return out;
    }
    if (delta < -6) {
      out.push(make("Energy easing — environment cooling", "calm", "#10b981", t));
      return out;
    }
  }

  // 3. Velocity spike independent of energy band.
  if (sample.intensity > 78) {
    out.push(make("High velocity movement detected", "alert", "#ef4444", t));
    return out;
  }

  // 4. Occasional ambient flavor so the feed never goes fully silent.
  //    Deterministic on the (rounded) timestamp to avoid Math.random churn.
  if (Math.floor(t / 1000) % 6 === 0) {
    const pick = AMBIENT_FLAVOR[Math.floor(t / 6000) % AMBIENT_FLAVOR.length];
    out.push(make(pick.text, pick.level, pick.color, t));
  }

  return out;
}

/** Seed lines so the feed is populated on first paint. */
export function seedFeed(now: number): AIInterpretation[] {
  return [
    make("Moderate group activity detected", "info", "#3b82f6", now - 2000),
    make("Energy increasing steadily", "rising", "#10b981", now - 5000),
    make("Focused motion pattern recognized", "info", "#8b5cf6", now - 12000),
    make("System calibration complete", "calm", "#6b7280", now - 18000),
  ];
}

/** Human "Ns ago" label for a feed timestamp. */
export function relativeTime(timestamp: number, now: number): string {
  const sec = Math.max(0, Math.round((now - timestamp) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ago`;
}
