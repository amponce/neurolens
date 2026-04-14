import { useState } from "react";
import { useParams } from "react-router-dom";
import { METRIC_COLORS } from "../types";
import type { AnalysisResult } from "../types";

function loadResult(id: string): AnalysisResult | null {
  try {
    const raw = sessionStorage.getItem(`analysis:${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as AnalysisResult;
  } catch {
    return null;
  }
}

interface ScoreBarProps {
  label: string;
  value: number;
  color: string;
}

function ScoreBar({ label, value, color }: ScoreBarProps) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-gray-300 text-sm font-medium">{label}</span>
        <span className="text-gray-400 text-xs">{pct}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function VisualizePage() {
  const { id } = useParams<{ id: string }>();
  const [frameIndex] = useState(0);

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

  void frameIndex; // reserved for timeline integration

  const summaryEntries = Object.entries(result.summary);

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
      {/* Top-left: Brain viewer placeholder */}
      <div className="bg-gray-900 flex items-center justify-center border-b border-r border-gray-800">
        <p className="text-gray-500 text-lg font-medium">
          Glass Brain (coming next)
        </p>
      </div>

      {/* Right sidebar — spans both rows */}
      <div
        className="bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto"
        style={{ gridRow: "1 / 3" }}
      >
        <h2 className="text-gray-200 font-semibold text-sm uppercase tracking-widest mb-4">
          Engagement Scores
        </h2>
        <div className="space-y-4">
          {summaryEntries.length > 0 ? (
            summaryEntries.map(([metric, value]) => (
              <ScoreBar
                key={metric}
                label={metric.replace(/_/g, " ")}
                value={value}
                color={METRIC_COLORS[metric] ?? "#6b7280"}
              />
            ))
          ) : (
            <p className="text-gray-500 text-sm">No summary data available.</p>
          )}
        </div>
      </div>

      {/* Bottom: Timeline placeholder */}
      <div className="bg-gray-900 border-t border-gray-800 flex items-center justify-center">
        <p className="text-gray-500 text-sm font-medium">
          Timeline (coming next)
        </p>
      </div>
    </div>
  );
}
