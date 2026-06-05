/**
 * Spotify OAuth — Authorization Code with PKCE (no client secret, browser-safe).
 *
 * Flow:
 *   1. beginLogin()  → generate verifier/challenge, stash verifier, redirect to
 *                      accounts.spotify.com/authorize
 *   2. (Spotify redirects back to VITE_SPOTIFY_REDIRECT_URI with ?code=…)
 *   3. handleRedirectCallback() → exchange code+verifier for tokens, persist them
 *   4. getAccessToken() → returns a valid token, transparently refreshing
 *
 * Tokens live in localStorage so a refresh survives reloads. Everything is a
 * no-op-friendly module: if VITE_SPOTIFY_CLIENT_ID is unset, hasCredentials()
 * is false and the app stays in demo mode.
 */

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "";
const REDIRECT_URI =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI ?? `${window.location.origin}/spotify/callback`;
const SCOPES =
  import.meta.env.VITE_SPOTIFY_SCOPES ??
  "user-read-playback-state user-modify-playback-state streaming user-read-email user-read-private playlist-read-private playlist-read-collaborative";

const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

const LS_VERIFIER = "aa_spotify_verifier";
const LS_STATE = "aa_spotify_state";
const LS_TOKENS = "aa_spotify_tokens";

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms */
  expiresAt: number;
  scope?: string;
}

export function hasCredentials(): boolean {
  return CLIENT_ID.length > 0;
}

// ── PKCE helpers ──────────────────────────────────────────────
function randomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

function base64UrlEncode(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
}

// ── Token storage ─────────────────────────────────────────────
function loadTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(LS_TOKENS);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

function saveTokens(tokens: StoredTokens): void {
  localStorage.setItem(LS_TOKENS, JSON.stringify(tokens));
}

export function logout(): void {
  localStorage.removeItem(LS_TOKENS);
  localStorage.removeItem(LS_VERIFIER);
  localStorage.removeItem(LS_STATE);
}

export function isAuthenticated(): boolean {
  return loadTokens() !== null;
}

// ── Flow ──────────────────────────────────────────────────────
export async function beginLogin(): Promise<void> {
  if (!hasCredentials()) throw new Error("VITE_SPOTIFY_CLIENT_ID is not set.");
  const verifier = randomString(96);
  const state = randomString(16);
  const challenge = base64UrlEncode(await sha256(verifier));

  localStorage.setItem(LS_VERIFIER, verifier);
  localStorage.setItem(LS_STATE, state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: SCOPES,
  });
  window.location.assign(`${AUTH_ENDPOINT}?${params.toString()}`);
}

/** True when the current URL looks like the OAuth redirect. */
export function isRedirectCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has("code") || params.has("error");
}

/**
 * Complete the OAuth flow on the redirect page. Returns true on success.
 * Cleans the auth params out of the URL afterwards.
 */
export async function handleRedirectCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const code = params.get("code");
  const returnedState = params.get("state");
  if (error || !code) {
    cleanUrl();
    return false;
  }
  const savedState = localStorage.getItem(LS_STATE);
  const verifier = localStorage.getItem(LS_VERIFIER);
  if (!verifier || (savedState && returnedState && savedState !== returnedState)) {
    cleanUrl();
    return false;
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    cleanUrl();
    return false;
  }
  const json = await res.json();
  persistTokenResponse(json);
  localStorage.removeItem(LS_VERIFIER);
  localStorage.removeItem(LS_STATE);
  cleanUrl();
  return true;
}

function persistTokenResponse(json: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}): void {
  saveTokens({
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
    scope: json.scope,
  });
}

async function refresh(tokens: StoredTokens): Promise<StoredTokens | null> {
  if (!tokens.refreshToken) return null;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const json = await res.json();
  // Spotify may omit a new refresh_token; keep the old one.
  if (!json.refresh_token) json.refresh_token = tokens.refreshToken;
  persistTokenResponse(json);
  return loadTokens();
}

/** Get a valid access token, refreshing if needed. Null if not logged in. */
export async function getAccessToken(): Promise<string | null> {
  let tokens = loadTokens();
  if (!tokens) return null;
  if (Date.now() >= tokens.expiresAt) {
    tokens = await refresh(tokens);
    if (!tokens) {
      logout();
      return null;
    }
  }
  return tokens.accessToken;
}

function cleanUrl(): void {
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, document.title, url.toString());
}
