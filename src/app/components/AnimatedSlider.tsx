import { motion } from "motion/react";

interface AnimatedSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  color?: string;
}

export function AnimatedSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  unit = "%",
  color = "#3b82f6",
}: AnimatedSliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-white/80 text-sm">{label}</label>
        <span className="font-mono text-sm" style={{ color }}>
          {value}
          {unit}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-black/30 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-all
            hover:[&::-webkit-slider-thumb]:scale-110"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${
              ((value - min) / (max - min)) * 100
            }%, rgba(0,0,0,0.3) ${((value - min) / (max - min)) * 100}%, rgba(0,0,0,0.3) 100%)`,
          }}
        />
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            background: linear-gradient(135deg, ${color}, ${color}dd);
            box-shadow: 0 0 20px ${color}60;
          }
        `}</style>
      </div>
      <div className="flex justify-between text-xs text-white/40 mt-1">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}
