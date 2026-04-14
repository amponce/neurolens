import { useMemo } from "react";
import { useParams } from "react-router-dom";
import type { AnalysisResult } from "../types";
import { GlassBrain } from "../components/GlassBrain";
import { Timeline } from "../components/Timeline";
import { MetricsPanel } from "../components/MetricsPanel";
import { useTimeline } from "../hooks/useTimeline";

function loadResult(id: string): AnalysisResult | null {
  try {
    const raw = sessionStorage.getItem(`analysis:${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as AnalysisResult;
  } catch {
    return null;
  }
}

export function VisualizePage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        No analysis ID provided.
      </div>
    );
  }

  const result = loadResult(id);

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Analysis not found in session. Please upload a file first.
      </div>
    );
  }

  return <VisualizeLayout result={result} />;
}

interface VisualizeLayoutProps {
  result: AnalysisResult;
}

function VisualizeLayout({ result }: VisualizeLayoutProps) {
  const { frameIndex, playing, toggle, seek } = useTimeline({
    frameCount: result.frames.length,
    fps: 1,
  });

  const activations = useMemo(
    () =>
      result.vertex_activations.length > 0
        ? (result.vertex_activations[frameIndex] ?? null)
        : null,
    [result.vertex_activations, frameIndex],
  );

  const currentFrame = result.frames[frameIndex] ?? null;

  return (
    <div
      className="bg-gray-950 text-white"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        gridTemplateRows: "1fr 80px",
        height: "100vh",
        width: "100vw",
      }}
    >
      {/* Top-left: Brain viewer */}
      <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
        <GlassBrain activations={activations} frame={currentFrame} />
      </div>

      {/* Right sidebar — spans both rows */}
      <div
        className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800"
        style={{ gridRow: "1 / 3" }}
      >
        <MetricsPanel result={result} frameIndex={frameIndex} />
      </div>

      {/* Bottom-left: Timeline */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <Timeline
          frames={result.frames}
          frameIndex={frameIndex}
          playing={playing}
          onSeek={seek}
          onToggle={toggle}
        />
      </div>
    </div>
  );
}
