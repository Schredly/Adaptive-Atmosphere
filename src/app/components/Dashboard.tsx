import { motion } from "motion/react";
import { Activity, Zap, Music, Eye, Radio, Users, Waves, Brain, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAtmosphereStore } from "@/store/useAtmosphereStore";
import { useCamera } from "@/hooks/useCamera";
import { useMotionAnalysis } from "@/hooks/useMotionAnalysis";
import { ATMOSPHERE_CONFIG } from "@/types/atmosphere";
import { relativeTime } from "@/services/ai/interpretationEngine";
import { PoseOverlay } from "./vision/PoseOverlay";
import { SoundControl } from "./SoundControl";

const PATTERN_LABELS: { key: "repetitive" | "highIntensity" | "synchronized" | "erratic"; label: string; color: string }[] = [
  { key: "highIntensity", label: "High Intensity", color: "#ef4444" },
  { key: "repetitive", label: "Focused Reps", color: "#8b5cf6" },
  { key: "synchronized", label: "In Sync", color: "#10b981" },
  { key: "erratic", label: "Erratic Spike", color: "#f59e0b" },
];

const RESOLUTION_DIMS: Record<string, string> = {
  "720p": "1280×720",
  "1080p": "1920×1080",
  "4K": "3840×2160",
};

export function Dashboard() {
  // ── Live state from the global atmosphere store ──────────────
  const energyLevel = useAtmosphereStore((s) => s.motionEnergyScore);
  const motionIntensity = useAtmosphereStore((s) => s.motionIntensity);
  const peopleCount = useAtmosphereStore((s) => s.subjectCount);
  const currentBPM = useAtmosphereStore((s) => s.currentBpm);
  const atmosphereState = useAtmosphereStore((s) => s.atmosphereState);
  const confidenceScore = useAtmosphereStore((s) => s.confidenceScore);
  const transitionRule = useAtmosphereStore((s) => s.transitionRule);
  const metrics = useAtmosphereStore((s) => s.metrics);
  const feed = useAtmosphereStore((s) => s.aiInterpretationFeed);
  const currentTrack = useAtmosphereStore((s) => s.currentTrack);
  const activePlaylist = useAtmosphereStore((s) => s.activePlaylist);
  const playbackState = useAtmosphereStore((s) => s.playbackState);
  const settings = useAtmosphereStore((s) => s.settings);
  const updateSettings = useAtmosphereStore((s) => s.updateSettings);
  const activityPatterns = useAtmosphereStore((s) => s.activityPatterns);
  const motionSource = useAtmosphereStore((s) => s.motionSource);
  const transition = useAtmosphereStore((s) => s.transition);

  // Smooth ticking clock for the live transition countdown.
  const [uiNow, setUiNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setUiNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const transitionElapsed = uiNow - transition.startedAt;
  const transitionRemaining = Math.max(0, transition.durationMs - transitionElapsed);
  const transitionProgress = transition.durationMs > 0 ? Math.min(100, (transitionElapsed / transition.durationMs) * 100) : 0;
  const phaseLabel = transition.phase === "crossfading" ? "Crossfading" : transition.phase === "cooldown" ? "Cooldown" : "Stable";
  const phaseColor = transition.phase === "crossfading" ? "#f59e0b" : transition.phase === "cooldown" ? "#3b82f6" : "#10b981";

  const stateCfg = ATMOSPHERE_CONFIG[atmosphereState];
  const activePatterns = PATTERN_LABELS.filter((p) => activityPatterns[p.key]);

  // ── Camera + live motion analysis ────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera(videoRef);
  const analysis = useMotionAnalysis(videoRef, { enabled: camera.status === "connected" });
  const cameraLive = camera.status === "connected";
  // Real pose visualization replaces the simulated skeletons when live.
  const liveAnalysis = cameraLive && motionSource === "live" && settings.showOverlays;

  const handleWebcam = () => {
    updateSettings({ cameraSource: "webcam" });
    void camera.connect();
  };
  const handleIphone = () => {
    updateSettings({ cameraSource: "iphone" });
    const phone = camera.devices.find((d) => d.isPhone);
    void camera.connect(phone?.deviceId);
  };

  // ── Decorative audio waveform (purely visual eye-candy) ──────
  const [audioWaveform, setAudioWaveform] = useState<number[]>(() =>
    Array(60).fill(0).map(() => Math.random()),
  );
  useEffect(() => {
    const interval = setInterval(() => {
      // Amplitude scales with live energy so the visualizer breathes with the room.
      const amp = 0.25 + (energyLevel / 100) * 0.75;
      setAudioWaveform(Array(60).fill(0).map(() => Math.random() * amp));
    }, 600);
    return () => clearInterval(interval);
  }, [energyLevel]);

  const now = Date.now();

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-[#000000] via-[#0a0a12] to-[#000000]">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold bg-gradient-to-r from-white via-[#3b82f6] to-[#8b5cf6] bg-clip-text text-transparent mb-1">
              Adaptive Atmosphere
            </h1>
            <p className="text-white/40 text-sm">AI Atmosphere Control Console</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#14141c]/70 backdrop-blur-xl rounded-xl border border-white/10">
              <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse shadow-lg shadow-[#10b981]/50" />
              <span className="text-[#10b981] text-sm">System Active</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-12 gap-5">
        {/* LEFT PANEL — LIVE ENVIRONMENT */}
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="col-span-5 bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#3b82f6]/10 rounded-full blur-3xl" />

          <div className="relative z-10 h-full flex flex-col p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center">
                  <Eye className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-sm">Live Environment</h3>
                  <p className="text-white/40 text-xs">Computer Vision</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${cameraLive ? "bg-red-500" : "bg-white/30"} animate-pulse shadow-lg shadow-red-500/50`} />
                <span className="text-white/40 text-xs font-mono">{cameraLive ? "LIVE" : "SIM"}</span>
              </div>
            </div>

            {/* Large Live Camera Card */}
            <div className="relative flex-1 bg-black rounded-2xl overflow-hidden border border-white/5">
              {/* Real webcam feed (sits beneath all the cinematic overlays) */}
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className={`absolute inset-0 w-full h-full object-cover -scale-x-100 z-0 transition-opacity duration-700 ${
                  cameraLive ? "opacity-90" : "opacity-0"
                }`}
              />

              {/* Real-time pose visualization (skeletons, trails, vectors, heat) */}
              <PoseOverlay active={liveAnalysis} className="absolute inset-0 w-full h-full z-20 pointer-events-none" />

              {/* Scanning Effect */}
              <div className="absolute inset-0 pointer-events-none z-30">
                <motion.div
                  animate={{ y: ["-100%", "100%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-x-0 h-40 bg-gradient-to-b from-transparent via-[#3b82f6]/10 to-transparent"
                />
              </div>

              {/* Grid overlay */}
              <div className="absolute inset-0 opacity-10 z-10">
                <div className="grid grid-cols-12 grid-rows-16 h-full w-full">
                  {Array.from({ length: 192 }).map((_, i) => (
                    <div key={i} className="border-r border-b border-[#3b82f6]/20" />
                  ))}
                </div>
              </div>

              {/* Heatmap Overlays */}
              <div className="absolute inset-0 z-10">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={`heatmap-${i}`}
                    animate={{
                      opacity: [0.2, 0.4, 0.2],
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 3 + i,
                      repeat: Infinity,
                      delay: i * 0.8,
                    }}
                    className="absolute rounded-full blur-2xl"
                    style={{
                      left: `${25 + i * 25}%`,
                      top: `${30 + i * 15}%`,
                      width: `${150 + i * 50}px`,
                      height: `${150 + i * 50}px`,
                      background: `radial-gradient(circle, ${
                        i === 0 ? "#f59e0b" : i === 1 ? "#3b82f6" : "#10b981"
                      }40, transparent)`,
                    }}
                  />
                ))}
              </div>

              {/* Pose Skeleton Overlay (simulated — replaced by PoseOverlay when live) */}
              {!liveAnalysis && (
              <div className="absolute inset-0 z-20">
                {/* Person 1 */}
                <motion.div
                  animate={{
                    x: [0, 10, -5, 0],
                    y: [0, -8, 5, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute left-[35%] top-[25%]"
                >
                  {/* Head */}
                  <div className="absolute w-6 h-6 rounded-full border-2 border-[#3b82f6] bg-[#3b82f6]/20 shadow-lg shadow-[#3b82f6]/50" />

                  {/* Torso */}
                  <div className="absolute top-6 left-3 -translate-x-1/2">
                    <div className="w-0.5 h-16 bg-gradient-to-b from-[#3b82f6] to-[#3b82f6]/50" />
                  </div>

                  {/* Arms */}
                  <motion.div
                    animate={{ rotate: [-5, 5, -5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute top-8 left-3 origin-top"
                  >
                    <div className="w-12 h-0.5 bg-gradient-to-r from-[#3b82f6] to-[#3b82f6]/50 -translate-x-6" />
                  </motion.div>
                  <motion.div
                    animate={{ rotate: [5, -5, 5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute top-8 left-3 origin-top"
                  >
                    <div className="w-12 h-0.5 bg-gradient-to-r from-[#3b82f6]/50 to-[#3b82f6] translate-x-0" />
                  </motion.div>

                  {/* Legs */}
                  <div className="absolute top-22 left-3 -translate-x-1/2">
                    <div className="w-0.5 h-14 bg-gradient-to-b from-[#3b82f6]/50 to-[#3b82f6]/20 -translate-x-2" />
                    <div className="w-0.5 h-14 bg-gradient-to-b from-[#3b82f6]/50 to-[#3b82f6]/20 translate-x-2" />
                  </div>

                  {/* Joint markers */}
                  {[
                    { top: 8, left: -9 },
                    { top: 8, left: 15 },
                    { top: 22, left: 1 },
                    { top: 36, left: -1 },
                    { top: 36, left: 5 },
                  ].map((pos, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 rounded-full bg-[#3b82f6] shadow-lg shadow-[#3b82f6]/50"
                      style={{ top: pos.top, left: pos.left }}
                    />
                  ))}
                </motion.div>

                {/* Person 2 */}
                <motion.div
                  animate={{
                    x: [0, -8, 12, 0],
                    y: [0, 6, -4, 0],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1,
                  }}
                  className="absolute right-[30%] top-[35%]"
                >
                  <div className="absolute w-6 h-6 rounded-full border-2 border-[#10b981] bg-[#10b981]/20 shadow-lg shadow-[#10b981]/50" />
                  <div className="absolute top-6 left-3 -translate-x-1/2">
                    <div className="w-0.5 h-16 bg-gradient-to-b from-[#10b981] to-[#10b981]/50" />
                  </div>
                  <motion.div
                    animate={{ rotate: [8, -8, 8] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="absolute top-8 left-3 origin-top"
                  >
                    <div className="w-12 h-0.5 bg-gradient-to-r from-[#10b981] to-[#10b981]/50 -translate-x-6" />
                  </motion.div>
                  <motion.div
                    animate={{ rotate: [-8, 8, -8] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="absolute top-8 left-3 origin-top"
                  >
                    <div className="w-12 h-0.5 bg-gradient-to-r from-[#10b981]/50 to-[#10b981]" />
                  </motion.div>
                  <div className="absolute top-22 left-3 -translate-x-1/2">
                    <div className="w-0.5 h-14 bg-gradient-to-b from-[#10b981]/50 to-[#10b981]/20 -translate-x-2" />
                    <div className="w-0.5 h-14 bg-gradient-to-b from-[#10b981]/50 to-[#10b981]/20 translate-x-2" />
                  </div>
                  {[
                    { top: 8, left: -9 },
                    { top: 8, left: 15 },
                    { top: 22, left: 1 },
                    { top: 36, left: -1 },
                    { top: 36, left: 5 },
                  ].map((pos, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 rounded-full bg-[#10b981] shadow-lg shadow-[#10b981]/50"
                      style={{ top: pos.top, left: pos.left }}
                    />
                  ))}
                </motion.div>
              </div>
              )}

              {/* Motion Trails */}
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={`trail-${i}`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: [0, 1, 0],
                    opacity: [0, 0.6, 0],
                    x: [0, Math.random() * 100 - 50],
                    y: [0, Math.random() * 100 - 50],
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                  className="absolute w-1 h-16 rounded-full blur-sm z-20"
                  style={{
                    left: `${20 + (i % 3) * 30}%`,
                    top: `${30 + Math.floor(i / 3) * 15}%`,
                    background: `linear-gradient(180deg, ${
                      i % 3 === 0 ? "#3b82f6" : i % 3 === 1 ? "#10b981" : "#f59e0b"
                    }, transparent)`,
                  }}
                />
              ))}

              {/* Live Labels Overlay */}
              <div className="absolute top-4 left-4 z-30 flex flex-col gap-2">
                <motion.div
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#10b981]/30"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-lg shadow-[#10b981]/50" />
                  <span className="text-[#10b981] text-xs font-medium">Motion Detected</span>
                </motion.div>

                <div className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#3b82f6]/30">
                  <span className="text-[#3b82f6] text-xs font-medium">{peopleCount} Active Subjects</span>
                </div>

                <motion.div
                  animate={{
                    opacity: energyLevel > 60 ? [0.7, 1, 0.7] : 0.5,
                    borderColor: energyLevel > 60 ? ["rgba(249, 158, 11, 0.3)", "rgba(249, 158, 11, 0.6)", "rgba(249, 158, 11, 0.3)"] : "rgba(249, 158, 11, 0.2)",
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border"
                >
                  <span className="text-[#f59e0b] text-xs font-medium">
                    Energy {energyLevel > 60 ? "Rising" : "Stable"}
                  </span>
                </motion.div>

                {/* Special-activity detection chips */}
                {activePatterns.map((p) => (
                  <motion.div
                    key={p.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: `${p.color}55` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}` }} />
                    <span className="text-xs font-medium" style={{ color: p.color }}>{p.label}</span>
                  </motion.div>
                ))}

                {/* Model bootstrap indicator */}
                {analysis.loading && (
                  <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#3b82f6]/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                    <span className="text-[#3b82f6] text-xs font-medium">Initializing pose AI…</span>
                  </div>
                )}
              </div>

              {/* Top Right Info */}
              <div className="absolute top-4 right-4 z-30 text-white/40 text-xs font-mono bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                {new Date(now).toLocaleTimeString()}
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-4 left-4 right-4 z-30 flex items-center justify-between">
                <div className="text-white/40 text-xs font-mono bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                  {RESOLUTION_DIMS[settings.resolution]} • {settings.frameRate}fps
                </div>

                <div className="text-white/60 text-xs font-mono bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                  CONF: {confidenceScore.toFixed(1)}%
                </div>
              </div>

              {/* Camera Source Selector */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/80 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10">
                <button
                  onClick={handleWebcam}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                    settings.cameraSource === "webcam"
                      ? "bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 border-[#3b82f6]/30"
                      : "bg-white/5 hover:bg-white/10 border-white/10"
                  }`}
                >
                  <Eye className={`w-3.5 h-3.5 ${settings.cameraSource === "webcam" ? "text-[#3b82f6]" : "text-white/60"}`} />
                  <span className={`text-xs font-medium ${settings.cameraSource === "webcam" ? "text-[#3b82f6]" : "text-white/60"}`}>Webcam</span>
                </button>
                <div className="w-px h-4 bg-white/10" />
                <button
                  onClick={handleIphone}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                    settings.cameraSource === "iphone"
                      ? "bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 border-[#3b82f6]/30"
                      : "bg-white/5 hover:bg-white/10 border-white/10"
                  }`}
                >
                  <svg className={`w-3.5 h-3.5 ${settings.cameraSource === "iphone" ? "text-[#3b82f6]" : "text-white/60"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <path d="M12 18h.01" />
                  </svg>
                  <span className={`text-xs font-medium ${settings.cameraSource === "iphone" ? "text-[#3b82f6]" : "text-white/60"}`}>iPhone</span>
                </button>
              </div>

              {/* Offline hint — the cinematic overlays still run as a simulated view */}
              {!cameraLive && (
                <button
                  onClick={handleWebcam}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-4 py-2 bg-black/70 hover:bg-black/80 backdrop-blur-md rounded-xl border border-white/10 text-white/70 text-xs font-medium transition-colors"
                >
                  {camera.status === "connecting" ? "Connecting camera…" : "Click to enable camera feed"}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* CENTER PANEL — ATMOSPHERE INTELLIGENCE */}
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="col-span-4 flex flex-col gap-4"
        >
          {/* Large Energy Meter */}
          <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#3b82f6]/10 rounded-full blur-3xl" />

            <div className="relative z-10 flex flex-col items-center">
              <h3 className="text-white/60 text-xs mb-6 tracking-wide">ENVIRONMENT ENERGY</h3>

              {/* Circular Energy Meter */}
              <div className="relative w-48 h-48 mb-4">
                {/* Background ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <motion.circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke={`url(#energyGradient)`}
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 88}`}
                    animate={{
                      strokeDashoffset: 2 * Math.PI * 88 * (1 - energyLevel / 100),
                    }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                  <defs>
                    <linearGradient id="energyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={energyLevel > 70 ? "#f59e0b" : energyLevel > 40 ? "#3b82f6" : "#10b981"} />
                      <stop offset="100%" stopColor={energyLevel > 70 ? "#ef4444" : energyLevel > 40 ? "#8b5cf6" : "#06b6d4"} />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Glow effect */}
                <motion.div
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full blur-xl"
                  style={{
                    background: `radial-gradient(circle, ${
                      energyLevel > 70 ? "#f59e0b" : energyLevel > 40 ? "#3b82f6" : "#10b981"
                    }40, transparent)`,
                  }}
                />

                {/* Center value */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    key={energyLevel.toFixed(0)}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl font-light text-white"
                  >
                    {energyLevel.toFixed(0)}
                  </motion.span>
                  <span className="text-white/40 text-sm mt-1">/ 100</span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Atmosphere State */}
          <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-5 shadow-2xl relative overflow-hidden">
            {/* Dynamic gradient background based on state */}
            <motion.div
              animate={{
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 blur-2xl"
              style={{
                background: `radial-gradient(circle at 30% 50%, ${stateCfg.color}40, ${stateCfg.accent}40, transparent)`,
              }}
            />

            <div className="relative z-10">
              <h3 className="text-white/60 text-xs mb-3 tracking-wide">ATMOSPHERE STATE</h3>

              <motion.div
                key={atmosphereState}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-3"
              >
                <div
                  className="w-3 h-3 rounded-full shadow-lg"
                  style={{
                    backgroundColor: stateCfg.color,
                    boxShadow: `0 0 20px ${stateCfg.color}60`,
                  }}
                />
                <span className="text-3xl text-white font-light">{stateCfg.label}</span>
              </motion.div>
            </div>
          </div>

          {/* AI Interpretation Feed */}
          <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-5 shadow-2xl relative overflow-hidden flex-1">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#8b5cf6]/5 rounded-full blur-3xl" />

            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-white text-sm">AI Interpretation</h3>
              </div>

              {/* Scrollable Feed */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-2" style={{ maxHeight: "200px" }}>
                {feed.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: Math.min(i, 4) * 0.05 }}
                    className="flex items-start gap-3 p-3 bg-black/20 rounded-xl border border-white/5 hover:bg-black/30 transition-colors"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: `0 0 10px ${item.color}60`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs leading-relaxed">{item.text}</p>
                      <span className="text-white/30 text-xs">{relativeTime(item.timestamp, now)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Environmental Metrics */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Crowd Activity", value: metrics.crowdActivity.toFixed(0), unit: "%", color: "#3b82f6", data: [0.3, 0.5, 0.4, 0.7, 0.6, 0.8] },
              { label: "Motion Confidence", value: metrics.motionConfidence.toFixed(0), unit: "%", color: "#10b981", data: [0.6, 0.7, 0.8, 0.85, 0.9, 0.88] },
              { label: "Motion Persistence", value: metrics.motionPersistence.toFixed(0), unit: "%", color: "#f59e0b", data: [0.4, 0.6, 0.5, 0.7, 0.8, 0.7] },
              { label: "Rhythm Stability", value: metrics.rhythmStability.toFixed(0), unit: "%", color: "#8b5cf6", data: [0.7, 0.75, 0.7, 0.8, 0.75, 0.78] },
            ].map((metric, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 * i }}
                className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-xl relative overflow-hidden"
              >
                <div
                  className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20"
                  style={{ backgroundColor: metric.color }}
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/60 text-xs">{metric.label}</span>
                    <div
                      className="w-1.5 h-1.5 rounded-full shadow-lg"
                      style={{
                        backgroundColor: metric.color,
                        boxShadow: `0 0 10px ${metric.color}60`,
                      }}
                    />
                  </div>

                  <p className="text-2xl mb-2" style={{ color: metric.color }}>
                    {metric.value}
                    <span className="text-xs ml-1">{metric.unit}</span>
                  </p>

                  {/* Mini graph */}
                  <div className="flex items-end gap-0.5 h-8">
                    {metric.data.map((height, j) => (
                      <motion.div
                        key={j}
                        initial={{ height: 0 }}
                        animate={{ height: `${height * 100}%` }}
                        transition={{ delay: j * 0.05, duration: 0.3 }}
                        className="flex-1 rounded-sm opacity-60"
                        style={{ backgroundColor: metric.color }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* RIGHT PANEL — AUDIO ORCHESTRATION */}
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="col-span-3 flex flex-col gap-4"
        >
          {/* Current Music Card */}
          <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-gradient-to-b from-[#10b981]/10 to-transparent blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center">
                    <Music className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white text-sm">Now Playing</h3>
                    <p className="text-white/40 text-xs">Auto-Adapting</p>
                  </div>
                </div>

                {/* Playback State */}
                <div className="flex items-center gap-2 px-2 py-1 bg-[#10b981]/20 rounded-lg border border-[#10b981]/30">
                  <div className={`w-1.5 h-1.5 rounded-full bg-[#10b981] ${playbackState === "playing" ? "animate-pulse" : ""}`} />
                  <span className="text-[#10b981] text-xs capitalize">{playbackState}</span>
                </div>
              </div>

              {/* Album Artwork with Glow */}
              <div className="relative mb-4">
                <motion.div
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute -inset-4 rounded-3xl blur-2xl"
                  style={{
                    background: "radial-gradient(circle, #10b98140, #3b82f640, transparent)",
                  }}
                />

                <div className="relative aspect-square bg-gradient-to-br from-[#10b981] via-[#3b82f6] to-[#8b5cf6] rounded-2xl p-1">
                  <div className="w-full h-full bg-[#0a0a12] rounded-xl flex items-center justify-center">
                    <Music className="w-16 h-16 text-white/20" />
                  </div>
                </div>

                {/* Equalizer Bars Overlay */}
                <div className="absolute bottom-3 left-3 right-3 flex items-end gap-1">
                  {audioWaveform.slice(0, 20).map((height, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: `${height * 60}%`,
                      }}
                      transition={{
                        duration: 0.3,
                      }}
                      className="flex-1 bg-gradient-to-t from-white/80 to-white/40 rounded-sm backdrop-blur-sm"
                      style={{ minHeight: "15%", maxHeight: "60%" }}
                    />
                  ))}
                </div>
              </div>

              {/* Track Details */}
              <div className="mb-4">
                <p className="text-white mb-1">{currentTrack?.title ?? "—"}</p>
                <p className="text-white/60 text-sm">{currentTrack?.genre ?? "Awaiting selection"}</p>
              </div>

              {/* Music Info Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                  <p className="text-white/40 text-xs mb-1">BPM Range</p>
                  <p className="text-[#3b82f6]">{(currentBPM - 8).toFixed(0)}-{(currentBPM + 8).toFixed(0)}</p>
                </div>

                <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                  <p className="text-white/40 text-xs mb-1">Transition</p>
                  <p className="text-[#10b981]">{Math.max(6, Math.round(30 - energyLevel / 4))}s</p>
                </div>
              </div>

              {/* Sound: tap-to-enable, then mute + volume */}
              <div className="mb-4">
                <SoundControl />
              </div>

              {/* Waveform Visualization */}
              <div className="h-16 bg-black/30 rounded-xl border border-white/5 p-2 flex items-center justify-between gap-0.5">
                {audioWaveform.slice(0, 50).map((height, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: `${height * 100}%`,
                    }}
                    transition={{
                      duration: 0.3,
                    }}
                    className="flex-1 bg-gradient-to-t from-[#10b981] via-[#3b82f6] to-[#8b5cf6] rounded-sm"
                    style={{ minHeight: "10%" }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Playlist Mapping Section */}
          <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-5 shadow-2xl relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-[#8b5cf6]/5 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h3 className="text-white text-sm mb-4">Playlist Mapping</h3>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: "Ambient", energy: "0-25", color: "#10b981", gradient: "from-[#10b981] to-[#06b6d4]" },
                  { name: "Chill", energy: "25-40", color: "#3b82f6", gradient: "from-[#3b82f6] to-[#06b6d4]" },
                  { name: "Groove", energy: "40-60", color: "#8b5cf6", gradient: "from-[#8b5cf6] to-[#3b82f6]" },
                  { name: "Hype", energy: "60-75", color: "#f59e0b", gradient: "from-[#f59e0b] to-[#3b82f6]" },
                  { name: "Intense", energy: "75-90", color: "#ef4444", gradient: "from-[#ef4444] to-[#f59e0b]" },
                  { name: "Chaotic", energy: "90-100", color: "#ec4899", gradient: "from-[#ec4899] to-[#ef4444]" },
                ].map((playlist, i) => {
                  const isActive = activePlaylist?.name === playlist.name;
                  return (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`group relative bg-black/30 hover:bg-black/40 rounded-xl p-3 border transition-all ${
                        isActive ? "border-white/30 ring-1 ring-white/20" : "border-white/5 hover:border-white/10"
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className={`relative w-full aspect-square bg-gradient-to-br ${playlist.gradient} rounded-lg mb-2 overflow-hidden`}>
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <Music className="w-6 h-6 text-white/60" />
                        </div>

                        {/* Spotify Icon */}
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                          </svg>
                        </div>

                        {/* Glow on hover */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          whileHover={{ opacity: 1 }}
                          className="absolute inset-0 blur-lg"
                          style={{
                            background: `radial-gradient(circle, ${playlist.color}40, transparent)`,
                          }}
                        />
                      </div>

                      {/* Playlist Info */}
                      <div className="text-left">
                        <p className="text-white text-xs mb-1 font-medium">{playlist.name}</p>
                        <div className="flex items-center gap-1">
                          <div
                            className="w-1 h-1 rounded-full"
                            style={{ backgroundColor: playlist.color }}
                          />
                          <span className="text-white/40 text-xs">{playlist.energy}%</span>
                        </div>
                      </div>

                      {/* Interactive indicator */}
                      <div className={`absolute top-2 left-2 w-1.5 h-1.5 rounded-full transition-colors ${isActive ? "bg-white/80" : "bg-white/0 group-hover:bg-white/60"}`} />
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Transition Engine Panel */}
          <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-5 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-48 h-48 bg-[#3b82f6]/5 rounded-full blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-white text-sm">Transition Engine</h3>
              </div>

              {/* Current Rule — live orchestration decision */}
              <div className="bg-black/30 rounded-xl p-3 border border-white/5 mb-3">
                <p className="text-white/40 text-xs mb-2">Current Rule</p>
                <p className="text-white text-xs leading-relaxed">{transition.reason || transitionRule}</p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/20 rounded-lg p-2.5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/40 text-xs">Confidence</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-lg shadow-[#10b981]/50" />
                  </div>
                  <p className="text-[#10b981] text-lg">{confidenceScore.toFixed(0)}%</p>
                </div>

                <div className="bg-black/20 rounded-lg p-2.5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/40 text-xs">Transition</span>
                    <div className="w-1.5 h-1.5 rounded-full shadow-lg" style={{ backgroundColor: phaseColor, boxShadow: `0 0 10px ${phaseColor}80` }} />
                  </div>
                  <p className="text-lg" style={{ color: phaseColor }}>{phaseLabel}</p>
                </div>

                <div className="col-span-2 bg-black/20 rounded-lg p-2.5 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/40 text-xs">{transition.phase === "crossfading" ? "Crossfade" : "Cooldown Timer"}</span>
                    <span className="text-white/60 text-xs font-mono">
                      {transition.phase === "idle" ? `${settings.stateCooldown}s` : `${(transitionRemaining / 1000).toFixed(1)}s`}
                    </span>
                  </div>
                  <div className="h-1 bg-black/30 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: transition.phase === "idle" ? "100%" : `${100 - transitionProgress}%` }}
                      transition={{ duration: 0.4, ease: "linear" }}
                      className="h-full"
                      style={{ background: `linear-gradient(to right, ${phaseColor}, #3b82f6)` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
