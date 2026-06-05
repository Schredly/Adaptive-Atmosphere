import { motion } from "motion/react";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  delay?: number;
}

export function GlassCard({ children, className = "", glowColor = "#3b82f6", delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay }}
      className={`bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden ${className}`}
    >
      <div
        className="absolute -top-10 -right-10 w-64 h-64 rounded-full blur-3xl opacity-10"
        style={{ backgroundColor: glowColor }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
