import { motion } from "motion/react";
import { Camera, Eye, Sliders, Brain, Palette, Sparkles, Cpu } from "lucide-react";
import { useState } from "react";
import { GlassCard } from "./GlassCard";
import { AnimatedSlider } from "./AnimatedSlider";
import { useAtmosphereStore } from "@/store/useAtmosphereStore";
import {
  getProvider,
  setProvider as persistProvider,
  getApiKey,
  setApiKey,
  getModel,
  setModel,
  DEFAULT_MODEL,
} from "@/services/ai/aiConfig";
import type { AIProvider } from "@/services/ai/aiConfig";

export function Settings() {
  // Camera + engine settings are global so they take effect on the Dashboard
  // and bias the live atmosphere engine immediately.
  const settings = useAtmosphereStore((s) => s.settings);
  const updateSettings = useAtmosphereStore((s) => s.updateSettings);

  const cameraSource = settings.cameraSource;
  const setCameraSource = (v: string) => updateSettings({ cameraSource: v as "webcam" | "iphone" });
  const resolution = settings.resolution;
  const setResolution = (v: string) => updateSettings({ resolution: v as "720p" | "1080p" | "4K" });
  const frameRate = settings.frameRate;
  const setFrameRate = (v: number) => updateSettings({ frameRate: v as 24 | 30 | 60 });
  const showOverlays = settings.showOverlays;
  const setShowOverlays = (v: boolean) => updateSettings({ showOverlays: v });

  const motionThreshold = settings.motionThreshold;
  const setMotionThreshold = (v: number) => updateSettings({ motionThreshold: v });
  const idleTimeout = settings.idleTimeout;
  const setIdleTimeout = (v: number) => updateSettings({ idleTimeout: v });
  const transitionAggressiveness = settings.transitionAggressiveness;
  const setTransitionAggressiveness = (v: number) => updateSettings({ transitionAggressiveness: v });
  const [activitySmoothing, setActivitySmoothing] = useState(40);
  const [motionPersistence, setMotionPersistence] = useState(70);

  const confidenceThreshold = settings.confidenceThreshold;
  const setConfidenceThreshold = (v: number) => updateSettings({ confidenceThreshold: v });
  const stateCooldown = settings.stateCooldown;
  const setStateCooldown = (v: number) => updateSettings({ stateCooldown: v });
  const [environmentalSensitivity, setEnvironmentalSensitivity] = useState(60);
  const [multiPersonWeighting, setMultiPersonWeighting] = useState(75);

  const glowIntensity = settings.glowIntensity;
  const setGlowIntensity = (v: number) => updateSettings({ glowIntensity: v });
  const [overlayDensity, setOverlayDensity] = useState(50);
  const animationIntensity = settings.animationIntensity;
  const setAnimationIntensity = (v: number) => updateSettings({ animationIntensity: v });
  const [compactMode, setCompactMode] = useState(false);

  // ── AI provider (BYO key, stored locally) ──
  const [aiProvider, setAiProvider] = useState<AIProvider>(getProvider());
  const [aiKey, setAiKey] = useState(getApiKey(getProvider()));
  const [aiModel, setAiModel] = useState(getModel(getProvider()));
  const [aiSaved, setAiSaved] = useState(false);

  const onPickProvider = (p: AIProvider) => {
    setAiProvider(p);
    persistProvider(p);
    setAiKey(p === "off" ? "" : getApiKey(p));
    setAiModel(p === "off" ? "" : getModel(p));
  };
  const saveAi = () => {
    if (aiProvider !== "off") {
      setApiKey(aiProvider, aiKey);
      setModel(aiProvider, aiModel || DEFAULT_MODEL[aiProvider]);
    }
    setAiSaved(true);
    window.setTimeout(() => setAiSaved(false), 1500);
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-[#000000] via-[#0a0a12] to-[#000000]">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-semibold bg-gradient-to-r from-white via-[#8b5cf6] to-[#ec4899] bg-clip-text text-transparent mb-2">
          Settings
        </h1>
        <p className="text-white/40">Configure Intelligence Engine</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-6">
        {/* Camera Settings */}
        <GlassCard className="p-6" glowColor="#3b82f6" delay={0.05}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white">Camera Settings</h2>
              <p className="text-white/40 text-sm">Vision input configuration</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Camera Source */}
            <div>
              <label className="text-white/60 text-sm mb-2 block">Camera Source</label>
              <div className="grid grid-cols-2 gap-2">
                {["webcam", "iphone"].map((source) => (
                  <button
                    key={source}
                    onClick={() => setCameraSource(source)}
                    className={`px-4 py-2 rounded-xl text-sm transition-all ${
                      cameraSource === source
                        ? "bg-[#3b82f6]/20 border-[#3b82f6]/30 text-[#3b82f6]"
                        : "bg-black/20 border-white/5 text-white/60 hover:bg-black/30"
                    } border`}
                  >
                    {source === "webcam" ? "Webcam" : "iPhone"}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution */}
            <div>
              <label className="text-white/60 text-sm mb-2 block">Resolution</label>
              <div className="grid grid-cols-3 gap-2">
                {["720p", "1080p", "4K"].map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    className={`px-3 py-2 rounded-lg text-xs transition-all ${
                      resolution === res
                        ? "bg-[#3b82f6]/20 border-[#3b82f6]/30 text-[#3b82f6]"
                        : "bg-black/20 border-white/5 text-white/60"
                    } border`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Rate */}
            <div>
              <label className="text-white/60 text-sm mb-2 block">Frame Rate</label>
              <div className="grid grid-cols-3 gap-2">
                {[24, 30, 60].map((fps) => (
                  <button
                    key={fps}
                    onClick={() => setFrameRate(fps)}
                    className={`px-3 py-2 rounded-lg text-xs transition-all ${
                      frameRate === fps
                        ? "bg-[#3b82f6]/20 border-[#3b82f6]/30 text-[#3b82f6]"
                        : "bg-black/20 border-white/5 text-white/60"
                    } border`}
                  >
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>

            {/* Overlay Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-white text-sm">Show Overlays</p>
                <p className="text-white/40 text-xs">Pose & motion trails</p>
              </div>
              <button
                onClick={() => setShowOverlays(!showOverlays)}
                className={`w-12 h-7 rounded-full transition-all relative ${
                  showOverlays ? "bg-gradient-to-r from-[#3b82f6] to-[#06b6d4]" : "bg-white/10"
                }`}
              >
                <motion.div
                  animate={{ x: showOverlays ? 20 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg"
                />
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Motion Sensitivity */}
        <GlassCard className="p-6" glowColor="#10b981" delay={0.1}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center">
              <Sliders className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white">Motion Sensitivity</h2>
              <p className="text-white/40 text-sm">Detection parameters</p>
            </div>
          </div>

          <div className="space-y-5">
            <AnimatedSlider
              label="Motion Threshold"
              value={motionThreshold}
              onChange={setMotionThreshold}
              color="#10b981"
            />
            <AnimatedSlider
              label="Idle Timeout"
              value={idleTimeout}
              onChange={setIdleTimeout}
              min={5}
              max={120}
              unit="s"
              color="#10b981"
            />
            <AnimatedSlider
              label="Transition Aggressiveness"
              value={transitionAggressiveness}
              onChange={setTransitionAggressiveness}
              color="#10b981"
            />
            <AnimatedSlider
              label="Activity Smoothing"
              value={activitySmoothing}
              onChange={setActivitySmoothing}
              color="#10b981"
            />
            <AnimatedSlider
              label="Motion Persistence"
              value={motionPersistence}
              onChange={setMotionPersistence}
              color="#10b981"
            />
          </div>
        </GlassCard>

        {/* AI Configuration */}
        <GlassCard className="p-6" glowColor="#8b5cf6" delay={0.15}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white">AI Configuration</h2>
              <p className="text-white/40 text-sm">Intelligence parameters</p>
            </div>
          </div>

          <div className="space-y-5">
            <AnimatedSlider
              label="Confidence Threshold"
              value={confidenceThreshold}
              onChange={setConfidenceThreshold}
              color="#8b5cf6"
            />
            <AnimatedSlider
              label="State Transition Cooldown"
              value={stateCooldown}
              onChange={setStateCooldown}
              min={5}
              max={60}
              unit="s"
              color="#8b5cf6"
            />
            <AnimatedSlider
              label="Environmental Sensitivity"
              value={environmentalSensitivity}
              onChange={setEnvironmentalSensitivity}
              color="#8b5cf6"
            />
            <AnimatedSlider
              label="Multi-Person Weighting"
              value={multiPersonWeighting}
              onChange={setMultiPersonWeighting}
              color="#8b5cf6"
            />
          </div>

          {/* LLM provider — augments the rule engine with a richer mood read */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-4 h-4 text-white/60" />
              <h3 className="text-white text-sm">AI Vision Model</h3>
              <span className="text-white/30 text-xs">augments the rules · key stored locally</span>
            </div>

            <div className="flex gap-2 mb-4">
              {(["off", "anthropic", "openai"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => onPickProvider(p)}
                  className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                    aiProvider === p
                      ? "bg-gradient-to-r from-[#8b5cf6]/30 to-[#ec4899]/30 text-white border border-[#8b5cf6]/40"
                      : "bg-black/30 text-white/50 border border-white/10 hover:text-white/80"
                  }`}
                >
                  {p === "off" ? "Off" : p}
                </button>
              ))}
            </div>

            {aiProvider !== "off" && (
              <div className="space-y-3">
                <div>
                  <label className="text-white/50 text-xs">{aiProvider === "openai" ? "OpenAI" : "Anthropic"} API key</label>
                  <input
                    type="password"
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    placeholder={aiProvider === "openai" ? "sk-…" : "sk-ant-…"}
                    spellCheck={false}
                    autoComplete="off"
                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 font-mono focus:outline-none focus:border-[#8b5cf6]/50"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Model</label>
                  <input
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    placeholder={DEFAULT_MODEL[aiProvider]}
                    spellCheck={false}
                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono focus:outline-none focus:border-[#8b5cf6]/50"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={saveAi}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white text-sm"
                  >
                    {aiSaved ? "Saved ✓" : "Save AI settings"}
                  </button>
                  <span className="text-white/30 text-xs">
                    Sends pose/motion summaries (not video) on each transition. Your key stays in this browser.
                  </span>
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Visual Preferences */}
        <GlassCard className="p-6" glowColor="#f59e0b" delay={0.2}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#ef4444] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white">Visual Preferences</h2>
              <p className="text-white/40 text-sm">UI appearance</p>
            </div>
          </div>

          <div className="space-y-5">
            <AnimatedSlider
              label="Glow Intensity"
              value={glowIntensity}
              onChange={setGlowIntensity}
              color="#f59e0b"
            />
            <AnimatedSlider
              label="Overlay Density"
              value={overlayDensity}
              onChange={setOverlayDensity}
              color="#f59e0b"
            />
            <AnimatedSlider
              label="Animation Intensity"
              value={animationIntensity}
              onChange={setAnimationIntensity}
              color="#f59e0b"
            />

            {/* Compact Mode Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-white text-sm">Compact Mode</p>
                <p className="text-white/40 text-xs">Dense information display</p>
              </div>
              <button
                onClick={() => setCompactMode(!compactMode)}
                className={`w-12 h-7 rounded-full transition-all relative ${
                  compactMode ? "bg-gradient-to-r from-[#f59e0b] to-[#ef4444]" : "bg-white/10"
                }`}
              >
                <motion.div
                  animate={{ x: compactMode ? 20 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg"
                />
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
