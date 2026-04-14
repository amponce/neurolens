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
    <div className="space-y-1.5">
      {/* Label and value */}
      <div className="flex justify-between items-center">
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
            color,
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="score-track" style={{ height: 6 }}>
        <div
          className="score-fill"
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            "--bar-color": color,
          } as React.CSSProperties}
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
            strokeOpacity="0.5"
          />
          <circle
            cx={dotX}
            cy={dotY}
            r="1.2"
            fill={color}
            style={{ filter: `drop-shadow(0 0 2px ${color})` }}
          />
        </svg>
      )}
    </div>
  );
}
