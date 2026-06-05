import { motion } from "motion/react";
import { Upload, Play, Pause, Film, Brain } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { poseService } from "@/services/vision/poseService";
import { MotionAnalysisEngine } from "@/services/vision/motionAnalysisEngine";
import { visionBus } from "@/services/vision/visionBus";
import { read } from "@/services/atmosphere/atmosphereEngine";
import { ATMOSPHERE_CONFIG } from "@/types/atmosphere";
import type { AtmosphereState } from "@/types/atmosphere";
import type { ActivityPatterns, MotionAnalysis, MotionSample } from "@/types/motion";
import { NO_PATTERNS } from "@/types/motion";
import { PoseOverlay } from "./PoseOverlay";

/**
 * VideoAnalysisPanel — upload an MP4 and run the real computer-vision pipeline
 * over recorded footage.
 *
 * Plays the file, runs MediaPipe Pose + motionAnalysisEngine on each frame,
 * draws the cinematic PoseOverlay, and records an atmosphere timeline you can
 * scrub. Self-contained: it drives the visionBus (for the overlay) and its own
 * local readouts without touching the global store, so it never fights the live
 * Dashboard engine.
 */

interface TimelineSample {
  /** video time, seconds */
  time: number;
  energy: number;
  velocity: number;
  subjects: number;
  state: AtmosphereState;
  color: string;
}

type Status = "empty" | "loading" | "ready" | "playing" | "paused";

// requestVideoFrameCallback isn't in every TS lib version.
type RVFCVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function analysisToSample(a: MotionAnalysis): MotionSample {
  return {
    t: Date.now(),
    energy: a.energy,
    intensity: a.velocity,
    subjects: a.subjects,
    confidence: a.confidence,
    source: "live",
    velocity: a.velocity,
    persistence: a.persistence,
    rhythmConsistency: a.rhythmConsistency,
    volatility: a.volatility,
    direction: a.direction,
    patterns: a.patterns,
  };
}

function fmt(t: number): string {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoAnalysisPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzerRef = useRef(new MotionAnalysisEngine());
  const rafRef = useRef<number | null>(null);
  const rvfcRef = useRef<number | null>(null);
  const lastRecordRef = useRef(-1);
  const urlRef = useRef<string | null>(null);

  const [status, setStatus] = useState<Status>("empty");
  const [fileName, setFileName] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [timeline, setTimeline] = useState<TimelineSample[]>([]);
  const [energy, setEnergy] = useState(0);
  const [state, setState] = useState<AtmosphereState>("idle");
  const [patterns, setPatterns] = useState<ActivityPatterns>(NO_PATTERNS);
  const [modelError, setModelError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const stateCfg = ATMOSPHERE_CONFIG[state];

  // Process a single detected frame: overlay + readouts + timeline record.
  const processFrame = (video: HTMLVideoElement) => {
    const frame = poseService.detect(video, video.currentTime * 1000, false);
    if (!frame) return;
    const a = analyzerRef.current.ingest(frame);
    visionBus.publish(frame, a, video.videoWidth, video.videoHeight);

    const sample = analysisToSample(a);
    const { state: s } = read(sample);
    setEnergy(a.energy);
    setState(s);
    setPatterns(a.patterns);

    // Record at ~10Hz of video time.
    const vt = video.currentTime;
    if (vt - lastRecordRef.current >= 0.1 || lastRecordRef.current < 0) {
      lastRecordRef.current = vt;
      const entry: TimelineSample = {
        time: vt,
        energy: a.energy,
        velocity: a.velocity,
        subjects: a.subjects,
        state: s,
        color: ATMOSPHERE_CONFIG[s].color,
      };
      setTimeline((prev) => {
        // Keep one entry per 0.1s bucket, ordered by time.
        const bucket = Math.round(vt * 10);
        const filtered = prev.filter((p) => Math.round(p.time * 10) !== bucket);
        const next = [...filtered, entry].sort((x, y) => x.time - y.time);
        return next;
      });
    }
    setCurrentTime(vt);
  };

  // Playback-driven analysis loop (prefers requestVideoFrameCallback).
  const startLoop = () => {
    const video = videoRef.current as RVFCVideo | null;
    if (!video) return;

    if (typeof video.requestVideoFrameCallback === "function") {
      const tick = () => {
        if (video.paused || video.ended) return;
        processFrame(video);
        rvfcRef.current = video.requestVideoFrameCallback!(tick);
      };
      rvfcRef.current = video.requestVideoFrameCallback(tick);
    } else {
      const tick = () => {
        if (video.paused || video.ended) return;
        processFrame(video);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const stopLoop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const video = videoRef.current as RVFCVideo | null;
    if (video && rvfcRef.current !== null && typeof video.cancelVideoFrameCallback === "function") {
      video.cancelVideoFrameCallback(rvfcRef.current);
    }
    rvfcRef.current = null;
  };

  const handleFile = async (file: File) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setFileName(file.name);
    setTimeline([]);
    lastRecordRef.current = -1;
    analyzerRef.current.reset();
    poseService.resetClock();
    setStatus("loading");
    setModelError(null);
    setFileError(null);

    const video = videoRef.current;
    if (video) {
      video.src = url;
      video.load();
    }

    try {
      await poseService.start();
      setStatus("ready");
    } catch (err) {
      setModelError(err instanceof Error ? err.message : "Pose model unavailable.");
      setStatus("ready"); // still allow playback without analysis
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  const seek = (time: number) => {
    const video = videoRef.current;
    if (!video || !isFinite(duration) || duration === 0) return;
    video.currentTime = Math.max(0, Math.min(duration, time));
  };

  // Wire native video events.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onMeta = () => setDuration(video.duration || 0);
    const onPlay = () => {
      setStatus("playing");
      poseService.resetClock();
      startLoop();
    };
    const onPause = () => {
      stopLoop();
      setStatus((s) => (s === "empty" || s === "loading" ? s : "paused"));
    };
    const onEnded = () => {
      stopLoop();
      setStatus("paused");
    };
    const onSeeked = () => {
      // Refresh the overlay + readouts to the seeked frame when paused.
      if (video.paused && poseService.ready) {
        poseService.resetClock();
        processFrame(video);
      }
    };
    const onTime = () => setCurrentTime(video.currentTime);
    const onError = () => {
      // Most common cause: an iPhone .mov encoded with HEVC/H.265, which Chrome
      // and Firefox can't decode (Safari can). Container is fine — codec isn't.
      stopLoop();
      setFileError(
        "This video couldn't be decoded. iPhone .mov files are often HEVC/H.265 — open the app in Safari, or convert the clip to H.264 MP4.",
      );
      setStatus("ready");
    };

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopLoop();
      visionBus.clear();
      poseService.resetClock();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasVideo = status !== "empty" && status !== "loading";
  const analysing = status === "playing";
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const activeChips = [
    patterns.highIntensity && { label: "High Intensity", color: "#ef4444" },
    patterns.repetitive && { label: "Focused Reps", color: "#8b5cf6" },
    patterns.synchronized && { label: "In Sync", color: "#10b981" },
    patterns.erratic && { label: "Erratic Spike", color: "#f59e0b" },
  ].filter(Boolean) as { label: string; color: string }[];

  return (
    <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#3b82f6]/5 rounded-full blur-3xl" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center">
              <Film className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl text-white">Video Analysis</h2>
              <p className="text-white/40 text-sm">MP4 · MOV · WebM · replay analysis · scrub the atmosphere timeline</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.mov,.m4v,.webm,.ogv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] rounded-xl text-white flex items-center gap-2 shadow-lg shadow-[#3b82f6]/20"
          >
            <Upload className="w-4 h-4" />
            {hasVideo ? "Replace Video" : "Upload Video"}
          </motion.button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Video + overlay */}
          <div className="col-span-2">
            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/5">
              <video
                ref={videoRef}
                playsInline
                className="absolute inset-0 w-full h-full object-cover z-0"
              />
              <PoseOverlay active={hasVideo && poseService.ready} className="absolute inset-0 w-full h-full z-10 pointer-events-none" />

              {/* Empty state */}
              {!hasVideo && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 text-white/40 hover:text-white/70 transition-colors"
                >
                  <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                    {status === "loading" ? (
                      <Brain className="w-10 h-10 text-[#3b82f6] animate-pulse" />
                    ) : (
                      <Upload className="w-10 h-10" />
                    )}
                  </div>
                  <p>{status === "loading" ? "Loading pose model…" : "Upload a video to analyze · MP4, MOV, WebM"}</p>
                </button>
              )}

              {/* Live badges */}
              {hasVideo && (
                <div className="absolute top-4 left-4 z-30 flex flex-col gap-2">
                  <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                    <div className={`w-1.5 h-1.5 rounded-full ${analysing ? "bg-red-500 animate-pulse" : "bg-white/30"}`} />
                    <span className="text-white/60 text-xs font-mono">{analysing ? "ANALYZING" : "PAUSED"}</span>
                  </div>
                  {activeChips.map((c) => (
                    <div key={c.label} className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border" style={{ borderColor: `${c.color}55` }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color, boxShadow: `0 0 10px ${c.color}` }} />
                      <span className="text-xs font-medium" style={{ color: c.color }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {modelError && hasVideo && !fileError && (
                <div className="absolute bottom-16 left-4 right-4 z-30 text-amber-300/80 text-xs bg-black/70 px-3 py-1.5 rounded-lg border border-amber-500/30">
                  {modelError} Playback continues without skeleton tracking.
                </div>
              )}

              {fileError && (
                <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 z-40 text-red-200 text-sm bg-black/85 px-4 py-3 rounded-xl border border-red-500/40 text-center">
                  {fileError}
                </div>
              )}

              {/* Transport */}
              {hasVideo && (
                <div className="absolute bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-[#3b82f6]/30 flex-shrink-0"
                    >
                      {analysing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
                    </button>
                    <span className="text-white/60 text-xs font-mono w-10">{fmt(currentTime)}</span>
                    <input
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.05}
                      value={currentTime}
                      onChange={(e) => seek(Number(e.target.value))}
                      className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                    <span className="text-white/40 text-xs font-mono w-10">{fmt(duration)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live readout */}
          <div className="col-span-1 space-y-4">
            <div className="bg-black/20 rounded-2xl border border-white/5 p-5 relative overflow-hidden">
              <div className="absolute inset-0 blur-2xl opacity-40" style={{ background: `radial-gradient(circle at 50% 30%, ${stateCfg.color}40, transparent)` }} />
              <div className="relative z-10">
                <p className="text-white/40 text-xs mb-1">ENERGY</p>
                <p className="text-5xl font-light text-white mb-3">{energy.toFixed(0)}<span className="text-white/30 text-lg"> / 100</span></p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stateCfg.color, boxShadow: `0 0 16px ${stateCfg.color}` }} />
                  <span className="text-2xl text-white font-light">{stateCfg.label}</span>
                </div>
              </div>
            </div>

            <div className="bg-black/20 rounded-2xl border border-white/5 p-5">
              <p className="text-white/40 text-xs mb-3">SESSION</p>
              <div className="space-y-2 text-sm">
                <Row label="Source" value={fileName || "—"} mono />
                <Row label="Duration" value={fmt(duration)} mono />
                <Row label="Samples" value={String(timeline.length)} mono />
                <Row label="Model" value={poseService.ready ? "Pose · Ready" : "Loading"} mono />
              </div>
            </div>
          </div>
        </div>

        {/* Atmosphere timeline */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/60 text-sm">Atmosphere Timeline</p>
            <p className="text-white/30 text-xs">click to scrub · color = state · height = energy</p>
          </div>
          <Timeline timeline={timeline} duration={duration} progress={progress} onSeek={seek} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/40">{label}</span>
      <span className={`text-white/80 truncate max-w-[60%] ${mono ? "font-mono text-xs" : ""}`} title={value}>{value}</span>
    </div>
  );
}

function Timeline({
  timeline,
  duration,
  progress,
  onSeek,
}: {
  timeline: TimelineSample[];
  duration: number;
  progress: number;
  onSeek: (time: number) => void;
}) {
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    onSeek(frac * duration);
  };

  return (
    <div
      onClick={onClick}
      className="relative h-28 bg-black/30 rounded-2xl border border-white/5 overflow-hidden cursor-pointer"
    >
      {/* gridlines */}
      {[25, 50, 75].map((p) => (
        <div key={p} className="absolute left-0 right-0 border-t border-white/5" style={{ bottom: `${p}%` }} />
      ))}

      {timeline.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
          Press play to build the atmosphere timeline
        </div>
      ) : (
        timeline.map((s, i) => (
          <div
            key={i}
            className="absolute bottom-0 w-[3px] rounded-t-sm"
            style={{
              left: `${duration > 0 ? (s.time / duration) * 100 : 0}%`,
              height: `${Math.max(2, s.energy)}%`,
              backgroundColor: s.color,
              opacity: 0.85,
            }}
          />
        ))
      )}

      {/* playhead */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.6)]" style={{ left: `${progress}%` }} />
    </div>
  );
}
