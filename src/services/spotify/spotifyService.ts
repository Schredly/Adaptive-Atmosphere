/**
 * Spotify orchestration service.
 *
 * Today this is a deterministic mock that maps atmosphere energy/state onto a
 * playlist + track and simulates playback. The public surface is intentionally
 * shaped like a thin wrapper over the Spotify Web API + Web Playback SDK so a
 * real implementation can be dropped in behind it.
 *
 * OAuth (PKCE) config is read from VITE_SPOTIFY_* env vars; `beginAuth()`
 * builds the authorize URL but the mock stays "connected" so the UI is alive
 * out of the box.
 */

import type { AtmosphereState } from "@/types/atmosphere";
import type { Playlist, Track } from "@/types/spotify";
import { PLAYLISTS, getTrackById } from "./catalog";

export interface MusicSelection {
  playlist: Playlist;
  track: Track;
}

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "";
const REDIRECT_URI =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI ?? "http://localhost:5173/spotify/callback";
const SCOPES =
  import.meta.env.VITE_SPOTIFY_SCOPES ??
  "user-read-playback-state user-modify-playback-state streaming";

/** True when real OAuth credentials are present in the environment. */
export function hasSpotifyCredentials(): boolean {
  return CLIENT_ID.length > 0;
}

/**
 * Build the Spotify authorize URL (Authorization Code w/ PKCE). The caller is
 * responsible for persisting the verifier and redirecting. In mock mode this
 * is unused but kept so the wiring is real.
 */
export function buildAuthorizeUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    state,
    scope: SCOPES,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/** Pick the playlist whose energy band contains `energy` (0..100). */
export function selectPlaylist(energy: number, state: AtmosphereState): Playlist {
  const clamped = Math.max(0, Math.min(100, energy));
  const byBand = PLAYLISTS.find(
    (p) => clamped >= p.energyBand[0] && clamped < p.energyBand[1],
  );
  if (byBand) return byBand;
  // Fallback: match by state, else the top band for >=100.
  return PLAYLISTS.find((p) => p.states.includes(state)) ?? PLAYLISTS[PLAYLISTS.length - 1];
}

/**
 * Deterministically choose a track from a playlist. Determinism (vs random)
 * keeps the UI from flickering between tracks every engine tick — the track
 * only changes when the playlist or the chosen index changes.
 */
export function selectTrack(playlist: Playlist, seed: number): Track {
  const ids = playlist.trackIds;
  const idx = Math.abs(Math.floor(seed)) % ids.length;
  return getTrackById(ids[idx]) ?? getTrackById(ids[0])!;
}

/**
 * Resolve a full music selection for the given atmosphere reading.
 * `rotation` advances slowly (e.g. once per real transition) so tracks change
 * occasionally rather than on every sample.
 */
export function orchestrate(
  energy: number,
  state: AtmosphereState,
  rotation: number,
): MusicSelection {
  const playlist = selectPlaylist(energy, state);
  const track = selectTrack(playlist, rotation);
  return { playlist, track };
}
