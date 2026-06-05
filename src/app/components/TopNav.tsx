import { motion } from "motion/react";
import { User, Settings, Bell, Music } from "lucide-react";
import { useAtmosphereStore } from "@/store/useAtmosphereStore";
import { ENVIRONMENT_CONFIG, ENVIRONMENT_MODES, modeFromId } from "@/types/atmosphere";

const modes = ENVIRONMENT_MODES.map((mode) => {
  const cfg = ENVIRONMENT_CONFIG[mode];
  return { id: cfg.id, label: cfg.label, color: cfg.color };
});

export function TopNav() {
  // Environment mode is global state — switching it here re-biases the live
  // motion engine on every page.
  const environmentMode = useAtmosphereStore((s) => s.environmentMode);
  const setEnvironmentMode = useAtmosphereStore((s) => s.setEnvironmentMode);
  const isSpotifyConnected = useAtmosphereStore((s) => s.spotifyConnected);

  const selectedMode = ENVIRONMENT_CONFIG[environmentMode].id;

  return (
    <div className="sticky top-0 z-50 bg-[#000000]/80 backdrop-blur-xl border-b border-white/5">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-[#3b82f6]/20">
              <div className="w-5 h-5 rounded-lg bg-white/20 backdrop-blur-sm" />
            </div>
            <div>
              <h1 className="text-white font-semibold">Adaptive Atmosphere</h1>
              <p className="text-white/40 text-xs">AI Environmental Orchestration</p>
            </div>
          </div>

          {/* Environment Mode Selector */}
          <div className="flex items-center gap-2 bg-[#14141c]/70 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10">
            {modes.map((mode) => {
              const isActive = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setEnvironmentMode(modeFromId(mode.id))}
                  className="relative px-4 py-2 rounded-xl transition-all"
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeMode"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, ${mode.color}20, ${mode.color}10)`,
                        border: `1px solid ${mode.color}30`,
                      }}
                    />
                  )}
                  <span
                    className={`relative z-10 text-xs font-medium transition-colors ${
                      isActive ? "text-white" : "text-white/40 hover:text-white/70"
                    }`}
                    style={isActive ? { color: mode.color } : {}}
                  >
                    {mode.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Spotify Connection Indicator */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-3 py-2 bg-[#14141c]/70 backdrop-blur-xl rounded-xl border border-white/10 hover:border-white/20 transition-all"
            >
              <div className={`w-2 h-2 rounded-full ${isSpotifyConnected ? "bg-[#1DB954]" : "bg-white/20"} shadow-lg ${isSpotifyConnected ? "shadow-[#1DB954]/50" : ""}`} />
              <Music className="w-4 h-4 text-white/60" />
              <span className="text-white/60 text-sm">{isSpotifyConnected ? "Connected" : "Disconnected"}</span>
            </motion.button>

            {/* Notifications */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-10 h-10 bg-[#14141c]/70 backdrop-blur-xl rounded-xl border border-white/10 hover:border-white/20 transition-all flex items-center justify-center"
            >
              <Bell className="w-4 h-4 text-white/60" />
              <div className="absolute top-2 right-2 w-2 h-2 bg-[#ef4444] rounded-full shadow-lg shadow-[#ef4444]/50" />
            </motion.button>

            {/* Profile */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-3 py-2 bg-[#14141c]/70 backdrop-blur-xl rounded-xl border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-sm">Alex Rivera</span>
            </motion.button>

            {/* Settings */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 bg-[#14141c]/70 backdrop-blur-xl rounded-xl border border-white/10 hover:border-white/20 transition-all flex items-center justify-center"
            >
              <Settings className="w-4 h-4 text-white/60" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
