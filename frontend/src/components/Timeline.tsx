import type { FrameScores } from "../types";

interface TimelineProps {
  frames: FrameScores[];
  frameIndex: number;
  playing: boolean;
  onSeek: (frame: number) => void;
  onToggle: () => void;
}

function getMeanScore(frame: FrameScores): number {
  const values = Object.values(frame.scores);
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function Timeline({
  frames,
  frameIndex,
  playing,
  onSeek,
  onToggle,
}: TimelineProps) {
  const totalSeconds = frames.length;
  const currentSeconds = frames[frameIndex]?.time ?? frameIndex;

  const scores = frames.map(getMeanScore);
  const maxScore = Math.max(...scores, 0.001);

  return (
    <div
      className="w-full h-full flex items-center gap-3"
      style={{ padding: "0 1rem" }}
    >
      {/* Play/pause button */}
      <button
        onClick={onToggle}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "1px solid var(--color-border)",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          cursor: "pointer",
          color: "var(--color-text)",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.borderColor = "var(--color-cyan)";
          btn.style.boxShadow = "0 0 10px rgba(0,229,255,0.2)";
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.borderColor = "var(--color-border)";
          btn.style.boxShadow = "none";
        }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="1" y="1" width="4" height="10" rx="1" />
            <rect x="7" y="1" width="4" height="10" rx="1" />
          </svg>
        ) : (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <polygon points="2,1 11,6 2,11" />
          </svg>
        )}
      </button>

      {/* Current time label */}
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.6875rem",
          color: "var(--color-text-muted)",
          fontVariantNumeric: "tabular-nums",
          width: "1.75rem",
          flexShrink: 0,
          textAlign: "right",
        }}
      >
        {Math.round(currentSeconds)}s
      </span>

      {/* Mini intensity heatmap */}
      <div className="flex-1 flex items-end gap-px" style={{ height: 32 }}>
        {frames.map((frame, i) => {
          const intensity = scores[i] / maxScore;
          const isActive = i === frameIndex;
          const barHeight = Math.max(4, Math.round(intensity * 28));

          return (
            <button
              key={frame.time}
              onClick={() => onSeek(i)}
              className="flex-1 flex items-end"
              style={{ height: 32, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
              aria-label={`Seek to frame ${i}`}
            >
              <div
                style={{
                  width: "100%",
                  borderRadius: 2,
                  height: barHeight,
                  backgroundColor: isActive
                    ? "var(--color-cyan)"
                    : `var(--color-surface-light)`,
                  opacity: isActive ? 1 : 0.3 + intensity * 0.7,
                  boxShadow: isActive ? "0 0 6px var(--color-cyan-dim)" : "none",
                  transition: "background-color 0.15s, box-shadow 0.15s",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Total time label */}
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.6875rem",
          color: "var(--color-text-muted)",
          fontVariantNumeric: "tabular-nums",
          width: "1.75rem",
          flexShrink: 0,
        }}
      >
        {totalSeconds}s
      </span>
    </div>
  );
}
