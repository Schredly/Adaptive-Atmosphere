/**
 * aiConfig — runtime, browser-stored configuration for the optional LLM that
 * augments the rule-based mood engine.
 *
 * Bring-your-own-key: the provider, API key and model live in localStorage (like
 * the Spotify Client ID). No backend — the browser calls OpenAI/Anthropic
 * directly. Keys are therefore visible to the page; intended for local/personal
 * use. Leave the provider "off" to stay fully rule-based.
 */

export type AIProvider = "off" | "openai" | "anthropic";

const LS_PROVIDER = "aa_ai_provider";
const LS_MODEL = "aa_ai_model"; // per-provider: `${LS_MODEL}_${provider}`
const LS_KEY = "aa_ai_key"; // per-provider: `${LS_KEY}_${provider}`

export const DEFAULT_MODEL: Record<Exclude<AIProvider, "off">, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
};

function read(k: string): string {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
}
function write(k: string, v: string): void {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* localStorage unavailable */
  }
}

export function getProvider(): AIProvider {
  const p = read(LS_PROVIDER);
  return p === "openai" || p === "anthropic" ? p : "off";
}
export function setProvider(p: AIProvider): void {
  write(LS_PROVIDER, p === "off" ? "" : p);
}

export function getApiKey(provider: AIProvider = getProvider()): string {
  return provider === "off" ? "" : read(`${LS_KEY}_${provider}`);
}
export function setApiKey(provider: Exclude<AIProvider, "off">, key: string): void {
  write(`${LS_KEY}_${provider}`, key.trim());
}

export function getModel(provider: AIProvider = getProvider()): string {
  if (provider === "off") return "";
  return read(`${LS_MODEL}_${provider}`) || DEFAULT_MODEL[provider];
}
export function setModel(provider: Exclude<AIProvider, "off">, model: string): void {
  const m = model.trim();
  write(`${LS_MODEL}_${provider}`, m === DEFAULT_MODEL[provider] ? "" : m);
}

/** True when a provider is selected and has a key — i.e. AI can run. */
export function isAIConfigured(): boolean {
  const p = getProvider();
  return p !== "off" && getApiKey(p).length > 0;
}
