/**
 * Static music catalog used by the mock Spotify orchestrator.
 *
 * Playlists mirror the energy bands shown in the Dashboard's "Playlist
 * Mapping" panel. Replace `getTrack`/`getPlaylist` consumers with the Spotify
 * Web API and this file becomes seed/fallback data only.
 */

import type { MusicBucket, Playlist, PlaylistRef, Track } from "@/types/spotify";

export const TRACKS: Track[] = [
  // Ambient
  { id: "amb-1", title: "Stillwater", artist: "Aeon Field", album: "Low Tide", durationSec: 284, bpm: 84, genre: "Ambient" },
  { id: "amb-2", title: "Soft Horizon", artist: "Nimbus", album: "Drift", durationSec: 312, bpm: 88, genre: "Ambient / Downtempo" },
  // Chill
  { id: "chl-1", title: "Glass Avenue", artist: "Mono Lake", album: "After Hours", durationSec: 241, bpm: 102, genre: "Chillwave" },
  { id: "chl-2", title: "Velvet Static", artist: "Halcyon", album: "Neon Quiet", durationSec: 226, bpm: 106, genre: "Chillwave" },
  // Groove
  { id: "grv-1", title: "Groove & Motion", artist: "Pulsewidth", album: "Kinetic", durationSec: 238, bpm: 112, genre: "Electronic / Ambient" },
  { id: "grv-2", title: "Midnight Synthwave", artist: "Neon Dreams", album: "Digital Horizons", durationSec: 272, bpm: 118, genre: "Synthwave" },
  // Hype
  { id: "hyp-1", title: "Overdrive", artist: "Voltage", album: "Redline", durationSec: 204, bpm: 126, genre: "Future House" },
  { id: "hyp-2", title: "Electric Pulse", artist: "Cyber Sounds", album: "Mainframe", durationSec: 218, bpm: 128, genre: "Electro" },
  // Intense
  { id: "int-1", title: "Afterburner", artist: "Mach Theory", album: "Threshold", durationSec: 196, bpm: 134, genre: "Techno" },
  { id: "int-2", title: "Blackout", artist: "Null Sector", album: "Hard Light", durationSec: 188, bpm: 138, genre: "Hard Techno" },
  // Chaotic
  { id: "cha-1", title: "Detonate", artist: "Kill Switch", album: "Riot Frequency", durationSec: 172, bpm: 150, genre: "Hardcore" },
  { id: "cha-2", title: "Supernova", artist: "Event Horizon", album: "Critical Mass", durationSec: 164, bpm: 156, genre: "Drum & Bass" },
];

export const PLAYLISTS: Playlist[] = [
  {
    id: "pl-ambient",
    name: "Ambient",
    energyBand: [0, 25],
    color: "#10b981",
    gradient: "from-[#10b981] to-[#06b6d4]",
    states: ["idle"],
    trackIds: ["amb-1", "amb-2"],
  },
  {
    id: "pl-chill",
    name: "Chill",
    energyBand: [25, 40],
    color: "#3b82f6",
    gradient: "from-[#3b82f6] to-[#06b6d4]",
    states: ["ambient"],
    trackIds: ["chl-1", "chl-2"],
  },
  {
    id: "pl-groove",
    name: "Groove",
    energyBand: [40, 60],
    color: "#8b5cf6",
    gradient: "from-[#8b5cf6] to-[#3b82f6]",
    states: ["focused", "social"],
    trackIds: ["grv-1", "grv-2"],
  },
  {
    id: "pl-hype",
    name: "Hype",
    energyBand: [60, 75],
    color: "#f59e0b",
    gradient: "from-[#f59e0b] to-[#3b82f6]",
    states: ["active"],
    trackIds: ["hyp-1", "hyp-2"],
  },
  {
    id: "pl-intense",
    name: "Intense",
    energyBand: [75, 90],
    color: "#ef4444",
    gradient: "from-[#ef4444] to-[#f59e0b]",
    states: ["intense"],
    trackIds: ["int-1", "int-2"],
  },
  {
    id: "pl-chaotic",
    name: "Chaotic",
    energyBand: [90, 100],
    color: "#ec4899",
    gradient: "from-[#ec4899] to-[#ef4444]",
    states: ["chaotic"],
    trackIds: ["cha-1", "cha-2"],
  },
];

const TRACK_BY_ID = new Map(TRACKS.map((t) => [t.id, t]));

export function getTrackById(id: string): Track | undefined {
  return TRACK_BY_ID.get(id);
}

/** Demo playlist serving each energy bucket (used as fallback when unmapped). */
export const DEMO_PLAYLIST_BY_BUCKET: Record<MusicBucket, Playlist> = {
  ambient: PLAYLISTS[0],
  chill: PLAYLISTS[1],
  groove: PLAYLISTS[2],
  hype: PLAYLISTS[3],
  intense: PLAYLISTS[4],
  chaotic: PLAYLISTS[5],
};

export function demoTracksForBucket(bucket: MusicBucket): Track[] {
  return DEMO_PLAYLIST_BY_BUCKET[bucket].trackIds
    .map((id) => getTrackById(id))
    .filter((t): t is Track => t !== undefined);
}

export function demoPlaylistRef(bucket: MusicBucket): PlaylistRef {
  const p = DEMO_PLAYLIST_BY_BUCKET[bucket];
  return { id: p.id, name: p.name, demo: true, trackCount: p.trackIds.length };
}
