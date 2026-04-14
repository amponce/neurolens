import { useCallback, useMemo, useRef } from "react";
import { GlassBrain } from "../components/GlassBrain";
import { Timeline } from "../components/Timeline";
import { useAnalysis } from "../hooks/useAnalysis";
import { useTimeline } from "../hooks/useTimeline";
import type { AnalysisResult } from "../types";

const ACCEPTED_EXTENSIONS =
  ".mp4,.avi,.mkv,.mov,.webm,.wav,.mp3,.flac,.ogg,.txt";

const METRIC_LABELS: Record<string, string> = {
  visual_attention: "Visual Attention",
  audio_engagement: "Audio Engagement",
  emotional_response: "Emotional Response",
  memorability: "Memorability",
  language_processing: "Language Processing",
  cognitive_load: "Cognitive Load",
};

interface DeltaMetric {
  key: string;
  label: string;
  valueA: number;
  valueB: number;
  winner: "A" | "B" | "even";
  percentDiff: number;
}

function computeDeltaMetrics(
  summaryA: Record<string, number>,
  summaryB: Record<string, number>
): DeltaMetric[] {
  return Object.entries(METRIC_LABELS).map(([key, label]) => {
    const valueA = summaryA[key] ?? 0;
    const valueB = summaryB[key] ?? 0;
    const avg = (valueA + valueB) / 2;
    const percentDiff = avg === 0 ? 0 : Math.abs(valueA - valueB) / avg * 100;

    let winner: "A" | "B" | "even";
    if (percentDiff > 5) {
      winner = valueA > valueB ? "A" : "B";
    } else {
      winner = "even";
    }

    return { key, label, valueA, valueB, winner, percentDiff };
  });
}

interface UploadSlotProps {
  label: string;
  state: ReturnType<typeof useAnalysis>["state"];
  upload: ReturnType<typeof useAnalysis>["upload"];
}

function UploadSlot({ label, state, upload }: UploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      void upload(file);
    },
    [upload]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") handleClick();
    },
    [handleClick]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const isProcessing =
    state.phase === "uploading" || state.phase === "processing";
  const isComplete = state.phase === "complete";
  const isError = state.phase === "error";

  if (isComplete) {
    return (
      <div className="rounded-xl border border-green-700 bg-gray-900 px-4 py-3 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
        <span className="text-green-400 text-sm font-medium">
          {label}: Ready
        </span>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
        <span className="text-cyan-400 text-sm font-medium">
          Analyzing {label}…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label} — click or drag and drop`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="rounded-xl border-2 border-dashed border-gray-700 bg-gray-900 hover:border-cyan-600 hover:bg-gray-800 px-4 py-5 text-center cursor-pointer transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleInputChange}
        />
        <p className="text-gray-400 text-sm font-medium">Upload {label}</p>
        <p className="text-gray-600 text-xs mt-1">Click or drag and drop</p>
      </div>

      {isError && (
        <div className="rounded-lg bg-red-950 border border-red-700 px-3 py-2 text-red-400 text-xs">
          {state.message}
        </div>
      )}
    </div>
  );
}

interface DeltaMetricCardProps {
  metric: DeltaMetric;
}

function DeltaMetricCard({ metric }: DeltaMetricCardProps) {
  const { label, winner, percentDiff } = metric;

  const winnerDisplay =
    winner === "even" ? (
      <span className="text-gray-400 text-sm font-semibold">Even</span>
    ) : winner === "A" ? (
      <span className="text-cyan-400 text-sm font-semibold">
        A +{percentDiff.toFixed(1)}%
      </span>
    ) : (
      <span className="text-purple-400 text-sm font-semibold">
        B +{percentDiff.toFixed(1)}%
      </span>
    );

  return (
    <div className="bg-gray-800 rounded-lg p-3 space-y-1">
      <p className="text-gray-400 text-xs">{label}</p>
      {winnerDisplay}
    </div>
  );
}

function extractResult(
  state: ReturnType<typeof useAnalysis>["state"]
): AnalysisResult | null {
  if (state.phase === "complete") return state.result;
  return null;
}

export function ComparePage() {
  const analysisA = useAnalysis();
  const analysisB = useAnalysis();

  const resultA = useMemo(() => extractResult(analysisA.state), [analysisA.state]);
  const resultB = useMemo(() => extractResult(analysisB.state), [analysisB.state]);

  const bothReady = resultA !== null && resultB !== null;

  const frameCount = useMemo(() => {
    if (!resultA || !resultB) return 0;
    return Math.min(resultA.frames.length, resultB.frames.length);
  }, [resultA, resultB]);

  const { frameIndex, playing, toggle, seek } = useTimeline({ frameCount });

  const safeFrameIndex = useMemo(() => {
    if (frameCount === 0) return 0;
    return Math.min(frameIndex, frameCount - 1);
  }, [frameIndex, frameCount]);

  const activationsA = useMemo(
    () => (resultA ? (resultA.vertex_activations[safeFrameIndex] ?? null) : null),
    [resultA, safeFrameIndex]
  );

  const activationsB = useMemo(
    () => (resultB ? (resultB.vertex_activations[safeFrameIndex] ?? null) : null),
    [resultB, safeFrameIndex]
  );

  const frameA = useMemo(
    () => (resultA ? (resultA.frames[safeFrameIndex] ?? null) : null),
    [resultA, safeFrameIndex]
  );

  const frameB = useMemo(
    () => (resultB ? (resultB.frames[safeFrameIndex] ?? null) : null),
    [resultB, safeFrameIndex]
  );

  const deltaMetrics = useMemo(() => {
    if (!resultA || !resultB) return [];
    return computeDeltaMetrics(resultA.summary, resultB.summary);
  }, [resultA, resultB]);

  const timelineFrames = useMemo(() => {
    return resultA ? resultA.frames.slice(0, frameCount) : [];
  }, [resultA, frameCount]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="text-center pt-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          NeuroLens Compare
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload two files to compare brain responses side by side
        </p>
      </div>

      {/* Upload slots */}
      <div className="grid grid-cols-2 gap-4">
        <UploadSlot
          label="Content A"
          state={analysisA.state}
          upload={analysisA.upload}
        />
        <UploadSlot
          label="Content B"
          state={analysisB.state}
          upload={analysisB.upload}
        />
      </div>

      {/* Side-by-side brain viewers — only shown when both ready */}
      {bothReady && (
        <>
          <div className="grid grid-cols-2 gap-4" style={{ height: "50vh" }}>
            {/* Brain A */}
            <div className="bg-gray-900 rounded-xl overflow-hidden relative">
              <span className="absolute top-3 left-3 z-10 text-xs font-semibold text-cyan-400 bg-gray-900/70 px-2 py-0.5 rounded-full">
                Content A
              </span>
              <GlassBrain activations={activationsA} frame={frameA} />
            </div>

            {/* Brain B */}
            <div className="bg-gray-900 rounded-xl overflow-hidden relative">
              <span className="absolute top-3 left-3 z-10 text-xs font-semibold text-purple-400 bg-gray-900/70 px-2 py-0.5 rounded-full">
                Content B
              </span>
              <GlassBrain activations={activationsB} frame={frameB} />
            </div>
          </div>

          {/* Delta metrics panel */}
          <div className="bg-gray-900 rounded-xl p-4 space-y-3">
            <h2 className="text-gray-300 text-sm font-semibold">
              Comparison: Content A vs B
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {deltaMetrics.map((metric) => (
                <DeltaMetricCard key={metric.key} metric={metric} />
              ))}
            </div>
          </div>

          {/* Shared timeline */}
          <div className="bg-gray-900 rounded-xl h-14">
            <Timeline
              frames={timelineFrames}
              frameIndex={safeFrameIndex}
              playing={playing}
              onSeek={seek}
              onToggle={toggle}
            />
          </div>
        </>
      )}
    </div>
  );
}
