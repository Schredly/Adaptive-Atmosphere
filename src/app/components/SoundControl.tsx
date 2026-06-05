import { motion } from "motion/react";
import { Volume2, VolumeX } from "lucide-react";

import { useAtmosphereStore } from "@/store/useAtmosphereStore";
import { spotifyManager } from "@/services/spotify/spotifyManager";

/**
 * SoundControl — the audio affordance for the orchestrated music.
 *
 * Browsers won't produce sound until a user gesture, so until audio is unlocked
 * this renders a clear "Tap to enable sound" button (any click unlocks the Web
 * Audio context). Once running, it becomes a mute toggle + volume slider. State
 * lives in the store and is driven by spotifyManager, so it reflects reality
 * whether the source is the demo synth or live Spotify.
 */
export function SoundControl() {
  const enabled = useAtmosphereStore((s) => s.audioEnabled);
  const muted = useAtmosphereStore((s) => s.audioMuted);
  const volume = useAtmosphereStore((s) => s.musicVolume);
  const pct = Math.round(volume * 100);

  if (!enabled) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => spotifyManager.enableAudio()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#10b981]/25 to-[#3b82f6]/25 border border-[#10b981]/40 text-white text-sm shadow-lg shadow-[#10b981]/10"
      >
        <Volume2 className="w-4 h-4" />
        Tap to enable sound
      </motion.button>
    );
  }

  const onSlide = (next: number) => {
    if (muted) spotifyManager.setMuted(false);
    void spotifyManager.setVolume(next / 100);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => spotifyManager.setMuted(!muted)}
        title={muted ? "Unmute" : "Mute"}
        className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 flex-shrink-0 transition-colors"
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onSlide(Number(e.target.value))}
        className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
      />
      <span className="text-white/40 text-xs font-mono w-9 text-right">{muted ? "—" : `${pct}%`}</span>
    </div>
  );
}
