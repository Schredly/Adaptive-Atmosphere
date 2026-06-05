import { motion } from "motion/react";
import { Activity, Zap, Target, TrendingUp, Play, Square, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { useAtmosphereStore } from "@/store/useAtmosphereStore";
import { VideoAnalysisPanel } from "./vision/VideoAnalysisPanel";

export function TestMode() {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [motionPoints, setMotionPoints] = useState<{ x: number; y: number; id: number }[]>([]);
  const [detectionCount, setDetectionCount] = useState(0);
  const [responseTime, setResponseTime] = useState(0);
  const [energyLevel, setEnergyLevel] = useState(0);

  // Live system signals from the running engine.
  const cameraConnected = useAtmosphereStore((s) => s.cameraConnected);
  const liveEnergy = useAtmosphereStore((s) => s.motionEnergyScore);
  const liveSource = useAtmosphereStore((s) => s.motionSource);

  useEffect(() => {
    if (isTestRunning) {
      const interval = setInterval(() => {
        setResponseTime((prev) => Math.min(100, prev + Math.random() * 15));
        setEnergyLevel((prev) => Math.min(100, prev + Math.random() * 8));
      }, 100);

      const motionInterval = setInterval(() => {
        const newPoint = {
          x: Math.random() * 100,
          y: Math.random() * 100,
          id: Date.now(),
        };
        setMotionPoints((prev) => [...prev.slice(-10), newPoint]);
        setDetectionCount((prev) => prev + 1);
      }, 500);

      return () => {
        clearInterval(interval);
        clearInterval(motionInterval);
      };
    }
  }, [isTestRunning]);

  const handleStart = () => {
    setIsTestRunning(true);
  };

  const handleStop = () => {
    setIsTestRunning(false);
  };

  const handleReset = () => {
    setIsTestRunning(false);
    setMotionPoints([]);
    setDetectionCount(0);
    setResponseTime(0);
    setEnergyLevel(0);
  };

  const metrics = [
    { label: "Detections", value: detectionCount, color: "#3b82f6", icon: Target },
    { label: "Response Time", value: `${responseTime.toFixed(0)}ms`, color: "#10b981", icon: Zap },
    { label: "Energy", value: `${(isTestRunning ? energyLevel : liveEnergy).toFixed(0)}%`, color: "#f59e0b", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-[#000000] via-[#0a0a12] to-[#000000]">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-semibold bg-gradient-to-r from-white via-[#f59e0b] to-[#ef4444] bg-clip-text text-transparent mb-2">
          Test Mode
        </h1>
        <p className="text-white/40">Real-time motion detection testing</p>
      </motion.div>

      <div className="grid grid-cols-4 gap-6">
        {/* Uploaded Video Analysis */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="col-span-4"
        >
          <VideoAnalysisPanel />
        </motion.div>

        {/* Motion Tracking Canvas */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="col-span-3 bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#3b82f6]/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl text-white">Motion Tracking Canvas</h2>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isTestRunning ? "bg-[#10b981] animate-pulse" : "bg-white/20"
                      } shadow-lg shadow-[#10b981]/50`}
                    />
                    <span
                      className={`text-sm ${
                        isTestRunning ? "text-[#10b981]" : "text-white/40"
                      }`}
                    >
                      {isTestRunning ? "Active" : "Idle"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleReset}
                  disabled={!isTestRunning && detectionCount === 0}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-white flex items-center gap-2 border border-white/10"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </motion.button>

                {!isTestRunning ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStart}
                    className="px-6 py-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] rounded-xl text-white flex items-center gap-2 shadow-lg shadow-[#10b981]/20"
                  >
                    <Play className="w-4 h-4" />
                    Start Test
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStop}
                    className="px-6 py-2 bg-gradient-to-r from-[#ef4444] to-[#dc2626] rounded-xl text-white flex items-center gap-2 shadow-lg shadow-[#ef4444]/20"
                  >
                    <Square className="w-4 h-4" />
                    Stop Test
                  </motion.button>
                )}
              </div>
            </div>

            {/* Tracking Canvas */}
            <div className="relative h-[500px] bg-black/30 rounded-2xl border border-white/5 overflow-hidden">
              {/* Grid Background */}
              <div className="absolute inset-0 opacity-10">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={`h-${i}`}
                    className="absolute w-full border-t border-[#3b82f6]/30"
                    style={{ top: `${i * 10}%` }}
                  />
                ))}
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={`v-${i}`}
                    className="absolute h-full border-l border-[#3b82f6]/30"
                    style={{ left: `${i * 10}%` }}
                  />
                ))}
              </div>

              {/* Motion Points */}
              {motionPoints.map((point, index) => (
                <motion.div
                  key={point.id}
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{
                    scale: [1, 2, 0],
                    opacity: [1, 0.5, 0],
                  }}
                  transition={{ duration: 2 }}
                  className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                  }}
                >
                  <div className="w-full h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] shadow-lg shadow-[#3b82f6]/50" />
                  {/* Trail effect */}
                  <motion.div
                    animate={{ scale: [1, 3], opacity: [0.5, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-[#3b82f6]"
                  />
                </motion.div>
              ))}

              {/* Center Crosshair */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-16 h-16 rounded-full border-2 border-[#3b82f6]/30" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-[#3b82f6]/50" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#3b82f6] shadow-lg shadow-[#3b82f6]/50" />
              </div>

              {/* Corner Indicators */}
              {["top-left", "top-right", "bottom-left", "bottom-right"].map((corner) => {
                const positions = {
                  "top-left": "top-4 left-4",
                  "top-right": "top-4 right-4",
                  "bottom-left": "bottom-4 left-4",
                  "bottom-right": "bottom-4 right-4",
                };
                return (
                  <div
                    key={corner}
                    className={`absolute ${positions[corner as keyof typeof positions]} w-6 h-6`}
                  >
                    <div className="w-full h-full border-l-2 border-t-2 border-[#3b82f6]/40" />
                  </div>
                );
              })}

              {/* Idle State */}
              {!isTestRunning && detectionCount === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                      <Activity className="w-12 h-12 text-white/20" />
                    </div>
                    <p className="text-white/40">Start test to begin motion tracking</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Metrics Panel */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="col-span-1 space-y-6"
        >
          {/* Real-time Metrics */}
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={index}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 * index }}
                className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl relative overflow-hidden"
              >
                <div
                  className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20"
                  style={{ backgroundColor: metric.color }}
                />

                <div className="relative z-10">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background: `linear-gradient(135deg, ${metric.color}, ${metric.color}dd)`,
                    }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>

                  <p className="text-white/60 text-sm mb-2">{metric.label}</p>
                  <p
                    className="text-3xl font-light"
                    style={{ color: metric.color }}
                  >
                    {metric.value}
                  </p>
                </div>
              </motion.div>
            );
          })}

          {/* System Status */}
          <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl">
            <h3 className="text-white mb-4">System Status</h3>

            <div className="space-y-3">
              {[
                { label: "Camera", status: cameraConnected ? "Online" : "Offline", color: cameraConnected ? "#10b981" : "#6b7280" },
                { label: "AI Model", status: liveSource === "live" ? "Live Pose" : "Simulation", color: "#3b82f6" },
                { label: "Processing", status: isTestRunning ? "Active" : "Idle", color: isTestRunning ? "#f59e0b" : "#6b7280" },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shadow-lg"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: `0 0 10px ${item.color}40`,
                      }}
                    />
                    <span className="text-sm" style={{ color: item.color }}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Test Log */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="col-span-4 bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-[#8b5cf6]/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <h2 className="text-xl text-white mb-6">Activity Log</h2>

            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total Sessions", value: "342", change: "+12%" },
                { label: "Avg Accuracy", value: "94.2%", change: "+2.1%" },
                { label: "Peak Performance", value: "18ms", change: "-5ms" },
                { label: "Uptime", value: "99.8%", change: "+0.2%" },
              ].map((stat, index) => (
                <div
                  key={index}
                  className="p-4 bg-black/20 rounded-xl border border-white/5"
                >
                  <p className="text-white/40 text-xs mb-2">{stat.label}</p>
                  <p className="text-2xl text-white mb-1">{stat.value}</p>
                  <p className="text-xs text-[#10b981]">{stat.change}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
