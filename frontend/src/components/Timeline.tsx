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
    <div className="w-full h-full flex items-center gap-3 px-4">
      {/* Play/pause button */}
      <button
        onClick={onToggle}
        className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center flex-shrink-0 transition-colors"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          /* Pause icon */
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="currentColor"
            className="text-white"
          >
            <rect x="2" y="1" width="4" height="12" rx="1" />
            <rect x="8" y="1" width="4" height="12" rx="1" />
          </svg>
        ) : (
          /* Play icon */
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="currentColor"
            className="text-white"
          >
            <polygon points="2,1 12,7 2,13" />
          </svg>
        )}
      </button>

      {/* Current time label */}
      <span className="text-gray-400 text-xs font-mono w-6 flex-shrink-0 text-right">
        {Math.round(currentSeconds)}s
      </span>

      {/* Mini intensity heatmap */}
      <div className="flex-1 flex items-end gap-px h-8">
        {frames.map((frame, i) => {
          const intensity = scores[i] / maxScore;
          const isActive = i === frameIndex;
          const barHeight = Math.max(4, Math.round(intensity * 28));

          return (
            <button
              key={frame.time}
              onClick={() => onSeek(i)}
              className="flex-1 flex items-end group"
              style={{ height: 32 }}
              aria-label={`Seek to frame ${i}`}
            >
              <div
                className="w-full rounded-sm transition-colors"
                style={{
                  height: barHeight,
                  backgroundColor: isActive
                    ? "#22d3ee"
                    : `rgba(75, 85, 99, ${0.3 + intensity * 0.7})`,
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Total time label */}
      <span className="text-gray-500 text-xs font-mono w-6 flex-shrink-0">
        {totalSeconds}s
      </span>
    </div>
  );
}
