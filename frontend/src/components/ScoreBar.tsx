import { METRIC_COLORS } from "../types";

interface ScoreBarProps {
  metric: string;
  label: string;
  value: number;
  history: number[];
  currentIndex: number;
}

export function ScoreBar({
  metric,
  label,
  value,
  history,
  currentIndex,
}: ScoreBarProps) {
  const color = METRIC_COLORS[metric] ?? "#6b7280";
  const pct = Math.round(value * 100);

  const max = Math.max(...history, 0.001);
  const points = history
    .map((v, i) => `${i},${20 - (v / max) * 18}`)
    .join(" ");

  const dotX = currentIndex;
  const dotY = 20 - (history[currentIndex] ?? 0) / max * 18;

  return (
    <div className="space-y-1">
      {/* Label and value */}
      <div className="flex justify-between items-center">
        <span className="text-gray-300 text-xs font-medium">{label}</span>
        <span className="text-xs font-mono" style={{ color }}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      {/* Sparkline */}
      {history.length > 1 && (
        <svg
          viewBox={`0 0 ${history.length} 20`}
          preserveAspectRatio="none"
          className="w-full h-5"
        >
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="0.8"
            strokeOpacity="0.7"
          />
          <circle
            cx={dotX}
            cy={dotY}
            r="1.2"
            fill={color}
          />
        </svg>
      )}
    </div>
  );
}
