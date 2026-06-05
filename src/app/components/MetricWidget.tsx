import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";

interface MetricWidgetProps {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  icon: LucideIcon;
  data?: number[];
  delay?: number;
}

export function MetricWidget({ label, value, unit, color, icon: Icon, data, delay = 0 }: MetricWidgetProps) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay }}
      className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-xl relative overflow-hidden"
    >
      <div
        className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20"
        style={{ backgroundColor: color }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/60 text-xs">{label}</span>
          <div
            className="w-1.5 h-1.5 rounded-full shadow-lg"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 10px ${color}60`,
            }}
          />
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4" style={{ color }} />
          <p className="text-2xl" style={{ color }}>
            {value}
            {unit && <span className="text-xs ml-1">{unit}</span>}
          </p>
        </div>

        {data && (
          <div className="flex items-end gap-0.5 h-8">
            {data.map((height, j) => (
              <motion.div
                key={j}
                initial={{ height: 0 }}
                animate={{ height: `${height * 100}%` }}
                transition={{ delay: j * 0.05, duration: 0.3 }}
                className="flex-1 rounded-sm opacity-60"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
