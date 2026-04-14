import type { AnalysisResult } from "../types";
import { METRIC_COLORS } from "../types";
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
    <div
      className="overflow-y-auto h-full"
      style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      {/* Header */}
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "0.6875rem",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--color-text-muted)",
          margin: 0,
        }}
      >
        Neural Engagement
      </h2>

      {/* Score bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
        <>
          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--color-border)" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "0.6875rem",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--color-text-muted)",
                margin: 0,
              }}
            >
              Top Active Regions
            </h3>

            {/* Region pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {topRegions.map((region, i) => {
                const metricKey = METRIC_ORDER[i % METRIC_ORDER.length];
                const dotColor = METRIC_COLORS[metricKey] ?? "#00e5ff";

                return (
                  <span
                    key={region}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3125rem",
                      padding: "0.1875rem 0.5625rem",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--color-border)",
                      fontFamily: "var(--font-body)",
                      fontSize: "0.6875rem",
                      color: "var(--color-text)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: dotColor,
                        flexShrink: 0,
                        boxShadow: `0 0 4px ${dotColor}`,
                      }}
                    />
                    {region}
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
