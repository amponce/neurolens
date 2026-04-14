import type { AnalysisResult } from "../types";
import { ScoreBar } from "./ScoreBar";

interface MetricsPanelProps {
  result: AnalysisResult;
  frameIndex: number;
}

const METRIC_ORDER = [
  "visual_attention",
  "audio_engagement",
  "emotional_response",
  "memorability",
  "language_processing",
  "cognitive_load",
] as const;

const METRIC_LABELS: Record<string, string> = {
  visual_attention: "Visual Attention",
  audio_engagement: "Audio Engagement",
  emotional_response: "Emotional Response",
  memorability: "Memorability",
  language_processing: "Language Processing",
  cognitive_load: "Cognitive Load",
};

export function MetricsPanel({ result, frameIndex }: MetricsPanelProps) {
  const currentFrame = result.frames[frameIndex] ?? null;

  const topRegions = currentFrame?.top_regions.slice(0, 8) ?? [];

  return (
    <div className="p-4 overflow-y-auto h-full space-y-5">
      {/* Header */}
      <h2 className="text-gray-400 text-sm uppercase tracking-wider">
        Neural Engagement
      </h2>

      {/* Score bars */}
      <div className="space-y-4">
        {METRIC_ORDER.map((metric) => {
          const history = result.frames.map(
            (f) => f.scores[metric] ?? 0,
          );
          const value = currentFrame?.scores[metric] ?? result.summary[metric] ?? 0;

          return (
            <ScoreBar
              key={metric}
              metric={metric}
              label={METRIC_LABELS[metric] ?? metric}
              value={value}
              history={history}
              currentIndex={frameIndex}
            />
          );
        })}
      </div>

      {/* Top active regions */}
      {topRegions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-gray-400 text-xs uppercase tracking-wider">
            Top Active Regions
          </h3>
          <ul className="space-y-1">
            {topRegions.map((region) => (
              <li key={region} className="flex items-center gap-2 text-xs text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                {region}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
