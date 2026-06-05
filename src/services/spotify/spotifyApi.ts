/**
 * Spotify Web API client — the minimal surface the orchestrator needs.
 *
 * Every call transparently fetches a valid token via spotifyAuth. Methods are
 * thin and typed at the boundary; failures throw so the manager can fall back
 * gracefully (e.g. to demo mode) rather than wedging the UI.
 */

import { getAccessToken } from "./spotifyAuth";
import type { PlaylistRef, SpotifyDevice, SpotifyUser, Track } from "@/types/spotify";

const API = "https://api.spotify.com/v1";

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated with Spotify.");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return res;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await authedFetch(path);
  if (!res.ok) throw new Error(`Spotify GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

// ── Profile ───────────────────────────────────────────────────
export async function getMe(): Promise<SpotifyUser> {
  const me = await getJson<{ display_name: string; product: string }>("/me");
  return { displayName: me.display_name ?? "Spotify User", premium: me.product === "premium" };
}

// ── Playlists ─────────────────────────────────────────────────
interface PagingPlaylists {
  items: {
    id: string;
    name: string;
    uri: string;
    images: { url: string }[];
    tracks: { total: number };
  }[];
  next: string | null;
}

export async function getUserPlaylists(): Promise<PlaylistRef[]> {
  const out: PlaylistRef[] = [];
  let path: string | null = "/me/playlists?limit=50";
  while (path) {
    const page: PagingPlaylists = await getJson<PagingPlaylists>(path);
    for (const p of page.items) {
      out.push({
        id: p.id,
        name: p.name,
        uri: p.uri,
        imageUrl: p.images?.[0]?.url,
        trackCount: p.tracks?.total,
      });
    }
    // next is an absolute URL; strip the API prefix.
    path = page.next ? page.next.replace(API, "") : null;
  }
  return out;
}

interface PlaylistTracksResponse {
  items: {
    track: {
      id: string;
      uri: string;
      name: string;
      duration_ms: number;
      album: { name: string; images: { url: string }[] };
      artists: { name: string }[];
    } | null;
  }[];
}

/** Fetch a handful of tracks for a playlist (for BPM-aware display). */
export async function getPlaylistTracks(playlistId: string, limit = 20): Promise<Track[]> {
  const data = await getJson<PlaylistTracksResponse>(
    `/playlists/${playlistId}/tracks?limit=${limit}`,
  );
  return data.items
    .map((i) => i.track)
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .map((t) => ({
      id: t.id,
      uri: t.uri,
      title: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      album: t.album.name,
      durationSec: Math.round(t.duration_ms / 1000),
      bpm: 0, // populated via audio-features if needed
      genre: "",
      artworkUrl: t.album.images?.[0]?.url,
    }));
}

// ── Devices ───────────────────────────────────────────────────
export async function getDevices(): Promise<SpotifyDevice[]> {
  const data = await getJson<{ devices: {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
    volume_percent: number | null;
  }[] }>("/me/player/devices");
  return data.devices.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    isActive: d.is_active,
    volumePercent: d.volume_percent ?? undefined,
  }));
}

export async function transferPlayback(deviceId: string, play = false): Promise<void> {
  const res = await authedFetch("/me/player", {
    method: "PUT",
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
  if (!res.ok && res.status !== 204) throw new Error(`transferPlayback → ${res.status}`);
}

// ── Playback control ──────────────────────────────────────────
export async function play(opts: {
  deviceId?: string;
  contextUri?: string;
  uris?: string[];
  positionMs?: number;
}): Promise<void> {
  const query = opts.deviceId ? `?device_id=${opts.deviceId}` : "";
  const body: Record<string, unknown> = {};
  if (opts.contextUri) body.context_uri = opts.contextUri;
  if (opts.uris) body.uris = opts.uris;
  if (opts.positionMs != null) body.position_ms = opts.positionMs;
  const res = await authedFetch(`/me/player/play${query}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) throw new Error(`play → ${res.status}`);
}

export async function pause(deviceId?: string): Promise<void> {
  const query = deviceId ? `?device_id=${deviceId}` : "";
  const res = await authedFetch(`/me/player/pause${query}`, { method: "PUT" });
  if (!res.ok && res.status !== 204) throw new Error(`pause → ${res.status}`);
}

export async function setVolume(percent: number, deviceId?: string): Promise<void> {
  const vol = Math.max(0, Math.min(100, Math.round(percent)));
  const query = new URLSearchParams({ volume_percent: String(vol) });
  if (deviceId) query.set("device_id", deviceId);
  const res = await authedFetch(`/me/player/volume?${query.toString()}`, { method: "PUT" });
  if (!res.ok && res.status !== 204) throw new Error(`setVolume → ${res.status}`);
}
