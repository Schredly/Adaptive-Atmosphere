import { motion } from "motion/react";
import { Music, PlayCircle, PauseCircle, SkipForward, Volume2, Radio, List, Laptop, RefreshCw, LogOut } from "lucide-react";
import { useState } from "react";

import { useAtmosphereStore } from "@/store/useAtmosphereStore";
import { spotifyManager } from "@/services/spotify/spotifyManager";
import { getClientId, setClientId, getRedirectUri } from "@/services/spotify/spotifyAuth";
import { MUSIC_BUCKETS, BUCKET_META } from "@/types/spotify";
import type { MusicBucket } from "@/types/spotify";

function fmt(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SpotifyIntegration() {
  // Global Spotify state.
  const mode = useAtmosphereStore((s) => s.spotifyMode);
  const user = useAtmosphereStore((s) => s.spotifyUser);
  // "Logged in" = we actually have the user's Spotify profile (OAuth completed).
  // The store's spotifyConnected flag defaults true for the demo, so it can't
  // gate the live login UI.
  const loggedIn = user != null;
  const devices = useAtmosphereStore((s) => s.spotifyDevices);
  const activeDeviceId = useAtmosphereStore((s) => s.activeDeviceId);
  const userPlaylists = useAtmosphereStore((s) => s.userPlaylists);
  const mappings = useAtmosphereStore((s) => s.playlistMappings);
  const setPlaylistMapping = useAtmosphereStore((s) => s.setPlaylistMapping);
  const storeTrack = useAtmosphereStore((s) => s.currentTrack);
  const playbackState = useAtmosphereStore((s) => s.playbackState);
  const positionMs = useAtmosphereStore((s) => s.trackPositionMs);
  const durationMs = useAtmosphereStore((s) => s.trackDurationMs);
  const activeBucket = useAtmosphereStore((s) => s.activeBucket);
  const transition = useAtmosphereStore((s) => s.transition);

  const [volume, setVolume] = useState(80);
  const [clientId, setClientIdInput] = useState(getClientId());
  const [savedFlash, setSavedFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const redirectUri = getRedirectUri();
  const isLoopback = window.location.hostname === "127.0.0.1";
  const hasClientId = clientId.trim().length > 0;
  const isLive = mode === "live";
  const isPlaying = playbackState === "playing" || playbackState === "transitioning";
  const progress = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;

  const currentTrack = {
    title: storeTrack?.title ?? "—",
    artist: storeTrack?.artist ?? "Adaptive Atmosphere",
    album: storeTrack?.album ?? "Live Orchestration",
  };

  const onVolume = (v: number) => {
    setVolume(v);
    void spotifyManager.setVolume(v / 100);
  };

  const saveClientId = () => {
    setClientId(clientId);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  };

  const connect = () => {
    setClientId(clientId); // persist before redirecting
    void spotifyManager.login();
  };

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const onMapping = (bucket: MusicBucket, playlistId: string) => {
    if (playlistId === "__demo__") {
      setPlaylistMapping(bucket, null);
      return;
    }
    const pl = userPlaylists.find((p) => p.id === playlistId) ?? null;
    setPlaylistMapping(bucket, pl);
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-[#000000] via-[#0a0a12] to-[#000000]">
      {/* Header */}
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-semibold bg-gradient-to-r from-white via-[#10b981] to-[#3b82f6] bg-clip-text text-transparent mb-2">
            Spotify Integration
          </h1>
          <p className="text-white/40">Connect environmental intelligence to adaptive music orchestration</p>
        </div>

        {/* Mode toggle + auth */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#14141c]/70 backdrop-blur-xl rounded-xl p-1 border border-white/10">
            {(["demo", "live"] as const).map((m) => (
              <button
                key={m}
                onClick={() => void spotifyManager.setMode(m)}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  mode === m ? "bg-gradient-to-r from-[#10b981]/30 to-[#3b82f6]/30 text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {m === "demo" ? "Demo" : "Spotify"}
              </button>
            ))}
          </div>

          {isLive && loggedIn && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => spotifyManager.logout()}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 border border-white/10 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Log out
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Spotify connection setup — configure the Client ID right here, no .env */}
      {isLive && !loggedIn && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1DB954] to-[#10b981] flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white">Connect your Spotify</h3>
              <p className="text-white/40 text-xs">
                Paste your app's Client ID — you'll log in securely on Spotify's own page (never here).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Client ID + connect */}
            <div className="space-y-3">
              <label className="text-white/60 text-xs">Spotify Client ID</label>
              <div className="flex gap-2">
                <input
                  value={clientId}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder="e.g. 4f8c2b1a9d7e4f0c…"
                  spellCheck={false}
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 font-mono focus:outline-none focus:border-[#10b981]/50"
                />
                <button
                  onClick={saveClientId}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm whitespace-nowrap"
                >
                  {savedFlash ? "Saved ✓" : "Save"}
                </button>
              </div>
              <motion.button
                whileHover={{ scale: hasClientId ? 1.02 : 1 }}
                whileTap={{ scale: hasClientId ? 0.98 : 1 }}
                onClick={connect}
                disabled={!hasClientId}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-[#1DB954] to-[#10b981] rounded-xl text-white text-sm shadow-lg shadow-[#1DB954]/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Connect Spotify
              </motion.button>
              <p className="text-white/30 text-xs">Spotify Premium is required for in-browser playback.</p>
            </div>

            {/* Redirect URI + steps */}
            <div className="space-y-3">
              <label className="text-white/60 text-xs">Redirect URI — add this to your Spotify app</label>
              <div className="flex gap-2">
                <code
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-[#10b981] font-mono truncate"
                  title={redirectUri}
                >
                  {redirectUri}
                </code>
                <button
                  onClick={copyRedirect}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs whitespace-nowrap"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <ol className="text-white/40 text-xs space-y-1 list-decimal list-inside">
                <li>Create an app at developer.spotify.com/dashboard</li>
                <li>Add the Redirect URI above; enable Web API + Web Playback SDK</li>
                <li>Settings → User Management → add your Spotify account email</li>
                <li>Paste the Client ID and hit Connect</li>
              </ol>
              {!isLoopback && (
                <p className="text-amber-300/80 text-xs">
                  Tip: open the app at <span className="font-mono">http://127.0.0.1:5173</span> — Spotify rejects
                  “localhost” redirect URIs.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Now Playing */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="col-span-2 bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#10b981]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#3b82f6]/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center">
                  <Music className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl text-white">Now Playing</h2>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${loggedIn || !isLive ? "bg-[#10b981] animate-pulse shadow-lg shadow-[#10b981]/50" : "bg-white/20"}`} />
                    <span className="text-[#10b981] text-sm">
                      {isLive ? (loggedIn ? `Spotify · ${user?.displayName ?? ""}` : "Spotify · not connected") : "Demo mode"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transition state badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-xl border border-white/10">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: transition.phase === "crossfading" ? "#f59e0b" : transition.phase === "cooldown" ? "#3b82f6" : "#10b981" }}
                />
                <span className="text-white/60 text-xs capitalize">{transition.phase === "idle" ? "stable" : transition.phase}</span>
              </div>
            </div>

            <div className="flex gap-8 mb-8">
              <div className="relative">
                <div className="w-64 h-64 rounded-2xl bg-gradient-to-br from-[#3b82f6] via-[#8b5cf6] to-[#ec4899] p-1">
                  <div className="w-full h-full rounded-xl bg-[#14141c] flex items-center justify-center overflow-hidden">
                    {storeTrack?.artworkUrl ? (
                      <img src={storeTrack.artworkUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Music className="w-24 h-24 text-white/20" />
                    )}
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-4 bg-gradient-to-r from-[#3b82f6]/20 via-[#8b5cf6]/20 to-[#ec4899]/20 rounded-3xl blur-2xl -z-10"
                />
              </div>

              <div className="flex-1 flex flex-col justify-center">
                <h3 className="text-3xl text-white mb-2">{currentTrack.title}</h3>
                <p className="text-xl text-white/60 mb-1">{currentTrack.artist}</p>
                <p className="text-white/40">{currentTrack.album}</p>
                {activeBucket && (
                  <div className="mt-3 inline-flex items-center gap-2 self-start px-3 py-1 rounded-lg" style={{ backgroundColor: `${BUCKET_META[activeBucket].color}20`, border: `1px solid ${BUCKET_META[activeBucket].color}40` }}>
                    <span className="text-xs" style={{ color: BUCKET_META[activeBucket].color }}>{BUCKET_META[activeBucket].label} playlist</span>
                  </div>
                )}

                <div className="flex items-center gap-1 mt-6 h-12">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: isPlaying ? [`${20 + Math.random() * 60}%`, `${20 + Math.random() * 60}%`, `${20 + Math.random() * 60}%`] : "20%" }}
                      transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, ease: "easeInOut" }}
                      className="w-1 bg-gradient-to-t from-[#3b82f6] to-[#10b981] rounded-full"
                      style={{ height: "40%" }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="h-2 bg-black/30 rounded-full overflow-hidden mb-2">
                <motion.div animate={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-[#10b981] to-[#3b82f6]" />
              </div>
              <div className="flex justify-between text-sm text-white/40">
                <span>{fmt(positionMs)}</span>
                <span>{fmt(durationMs)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10">
                <Radio className="w-5 h-5 text-white/60" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => void spotifyManager.togglePlay()}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center shadow-lg shadow-[#10b981]/30"
              >
                {isPlaying ? <PauseCircle className="w-8 h-8 text-white" /> : <PlayCircle className="w-8 h-8 text-white" />}
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10">
                <SkipForward className="w-5 h-5 text-white/60" />
              </motion.button>
            </div>

            {/* Volume */}
            <div className="mt-8 flex items-center gap-4">
              <Volume2 className="w-5 h-5 text-white/60" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => onVolume(Number(e.target.value))}
                className="flex-1 h-2 bg-black/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <span className="text-white/60 text-sm font-mono w-12">{volume}%</span>
            </div>
          </div>
        </motion.div>

        {/* Sidebar: Mapping + Devices */}
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 }} className="col-span-1 space-y-6">
          {/* Playlist Mapping */}
          <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-[#8b5cf6]/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center">
                  <List className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white">Energy → Playlist</h3>
                  <p className="text-white/40 text-xs">Map each energy bucket</p>
                </div>
              </div>

              <div className="space-y-3">
                {MUSIC_BUCKETS.map((bucket) => {
                  const meta = BUCKET_META[bucket];
                  const mapped = mappings[bucket];
                  const isActive = activeBucket === bucket;
                  return (
                    <div key={bucket} className={`p-3 rounded-xl border transition-colors ${isActive ? "bg-white/5 border-white/20" : "bg-black/20 border-white/5"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color, boxShadow: `0 0 10px ${meta.color}60` }} />
                        <span className="text-white text-sm">{meta.label}</span>
                        <span className="text-white/30 text-xs ml-auto">{meta.energyBand[0]}–{meta.energyBand[1]}%</span>
                      </div>
                      <select
                        value={mapped?.id ?? "__demo__"}
                        onChange={(e) => onMapping(bucket, e.target.value)}
                        disabled={!isLive}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-white/30"
                      >
                        <option value="__demo__">Demo: {meta.label}</option>
                        {userPlaylists.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {isLive && userPlaylists.length === 0 && (
                <button onClick={() => void spotifyManager.loadPlaylists()} className="mt-4 w-full text-xs text-white/50 hover:text-white/80 flex items-center justify-center gap-2 py-2">
                  <RefreshCw className="w-3.5 h-3.5" /> {loggedIn ? "Load my playlists" : "Connect Spotify to map playlists"}
                </button>
              )}
            </div>
          </div>

          {/* Devices */}
          <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-[#3b82f6]/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center">
                    <Laptop className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-white">Playback Devices</h3>
                </div>
                <button onClick={() => void spotifyManager.loadDevices()} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center" title="Refresh devices">
                  <RefreshCw className="w-3.5 h-3.5 text-white/50" />
                </button>
              </div>

              {!isLive ? (
                <p className="text-white/40 text-sm py-2">Demo mode plays locally. Switch to Spotify to manage devices.</p>
              ) : devices.length === 0 ? (
                <p className="text-white/40 text-sm py-2">{loggedIn ? "No active devices found. Open Spotify on a device." : "Connect Spotify to list devices."}</p>
              ) : (
                <div className="space-y-2">
                  {devices.map((d) => {
                    const selected = d.id === activeDeviceId || d.isActive;
                    return (
                      <button
                        key={d.id}
                        onClick={() => void spotifyManager.selectDevice(d.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center justify-between ${selected ? "bg-[#10b981]/10 border-[#10b981]/30" : "bg-black/20 border-white/5 hover:bg-white/5"}`}
                      >
                        <div>
                          <p className="text-white text-sm">{d.name}</p>
                          <p className="text-white/40 text-xs capitalize">{d.type}</p>
                        </div>
                        {selected && <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-lg shadow-[#10b981]/50" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
