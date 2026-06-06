/**
 * visionInterpreter — sends a compact motion/pose summary to the configured LLM
 * (OpenAI or Anthropic) and gets back a natural-language mood read + reasoning,
 * plus an optional suggested music bucket.
 *
 * It AUGMENTS the rule-based engine: the rules still drive real-time selection;
 * this adds a richer interpretation and can nudge the bucket. Cheap by design —
 * it summarizes the pose/motion numbers (not raw frames) and runs on transitions.
 */

import { getApiKey, getModel, getProvider } from "./aiConfig";
import { learnedExamples, signatureOf } from "./learnedMoods";
import { MUSIC_BUCKETS } from "@/types/spotify";
import type { MusicBucket } from "@/types/spotify";
import { ATMOSPHERE_STATES } from "@/types/atmosphere";
import type { AtmosphereState } from "@/types/atmosphere";
import type { ActivityPatterns } from "@/types/motion";

export interface MotionSummary {
  energy: number;
  velocity: number;
  persistence: number;
  rhythmConsistency: number;
  volatility: number;
  subjects: number;
  patterns: ActivityPatterns;
  /** The rule engine's current call, for context. */
  ruleMood: AtmosphereState;
  environmentMode: string;
}

export interface AIRead {
  mood: AtmosphereState;
  bucket: MusicBucket;
  reasoning: string;
  provider: string;
  model: string;
  at: number;
}

const SYSTEM = `You are the perception layer of an environmental music system. You read a room's motion and decide its mood, then pick a matching music bucket.
Moods: ${ATMOSPHERE_STATES.join(", ")}.
Music buckets (low→high energy): ${MUSIC_BUCKETS.join(", ")}.
Given a motion summary, respond with ONLY a JSON object: {"mood": <one mood>, "bucket": <one bucket>, "reasoning": "<one concise sentence on why>"}. No prose outside the JSON.`;

function buildUserPrompt(s: MotionSummary): string {
  const active = Object.entries(s.patterns)
    .filter(([, v]) => v)
    .map(([k]) => k);
  // Few-shot: recent human corrections so the model adapts to this user's taste.
  const examples = learnedExamples(6);
  const fewShot = examples.length
    ? "Human corrections for similar motion (prefer these when the current motion matches):\n" +
      examples.map((e) => `- ${signatureOf(e.summary)} → ${e.mood}`).join("\n") +
      "\n\n"
    : "";
  return fewShot + [
    `Environment: ${s.environmentMode}`,
    `Energy: ${Math.round(s.energy)}/100`,
    `Velocity: ${Math.round(s.velocity)}/100`,
    `Persistence: ${Math.round(s.persistence)}/100`,
    `Rhythm consistency: ${Math.round(s.rhythmConsistency)}/100`,
    `Volatility: ${Math.round(s.volatility)}/100`,
    `People detected: ${s.subjects}`,
    `Active patterns: ${active.length ? active.join(", ") : "none"}`,
    `Rule-engine mood: ${s.ruleMood}`,
    `Classify the mood and choose a bucket.`,
  ].join("\n");
}

/** Pull the first JSON object out of a model response that may include prose. */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function callOpenAI(key: string, model: string, user: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    signal,
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(key: string, model: string, user: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      // Required to call the API directly from a browser.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    signal,
    body: JSON.stringify({
      model,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = await res.json();
  return json.content?.[0]?.text ?? "";
}

/**
 * Interpret a motion summary with the configured provider. Throws if no provider
 * is configured or the request fails; callers should treat failures as "skip,
 * keep using the rule engine".
 */
export async function interpretMotion(summary: MotionSummary, signal?: AbortSignal): Promise<AIRead> {
  const provider = getProvider();
  const key = getApiKey(provider);
  const model = getModel(provider);
  if (provider === "off" || !key) throw new Error("AI provider not configured");

  const user = buildUserPrompt(summary);
  const text =
    provider === "openai"
      ? await callOpenAI(key, model, user, signal)
      : await callAnthropic(key, model, user, signal);

  const parsed = parseJsonObject(text);
  if (!parsed) throw new Error("AI returned unparseable output");

  // Validate against allowed values; fall back to the rule call if off-list.
  const mood = (ATMOSPHERE_STATES as readonly string[]).includes(String(parsed.mood))
    ? (parsed.mood as AtmosphereState)
    : summary.ruleMood;
  const bucket = (MUSIC_BUCKETS as readonly string[]).includes(String(parsed.bucket))
    ? (parsed.bucket as MusicBucket)
    : undefined;

  return {
    mood,
    bucket: bucket ?? bucketForMood(mood),
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "(no reasoning given)",
    provider,
    model,
    at: Date.now(),
  };
}

// Local copy of the mood→bucket fallback so we never return an invalid bucket.
function bucketForMood(mood: AtmosphereState): MusicBucket {
  // Mirror of STATE_TO_BUCKET without importing the map circularly.
  const map: Record<AtmosphereState, MusicBucket> = {
    idle: "ambient",
    ambient: "chill",
    social: "groove",
    focused: "groove",
    active: "hype",
    intense: "intense",
    chaotic: "chaotic",
  };
  return map[mood];
}
