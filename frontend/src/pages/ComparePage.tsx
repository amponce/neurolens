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

// Drifting space particles — copied from UploadPage for consistent starfield
const DRIFT_PARTICLES = [
  { left: "8%", top: "85%", delay: "0s", duration: "25s", size: 2, color: "#00e5ff" },
  { left: "22%", top: "90%", delay: "4s", duration: "32s", size: 1.5, color: "#7c4dff" },
  { left: "38%", top: "75%", delay: "8s", duration: "28s", size: 3, color: "#00e5ff" },
  { left: "55%", top: "88%", delay: "2s", duration: "35s", size: 1, color: "#ffab40" },
  { left: "70%", top: "80%", delay: "6s", duration: "22s", size: 2.5, color: "#7c4dff" },
  { left: "85%", top: "92%", delay: "10s", duration: "30s", size: 1.5, color: "#00e5ff" },
  { left: "15%", top: "70%", delay: "12s", duration: "40s", size: 1, color: "#ffab40" },
  { left: "48%", top: "95%", delay: "15s", duration: "26s", size: 2, color: "#7c4dff" },
] as const;

// Fixed twinkling stars — copied from UploadPage for consistent starfield
const STAR_CONFIGS = [
  { left: "5%", top: "12%", delay: "0s", duration: "4s", size: 1.5 },
  { left: "18%", top: "8%", delay: "1.2s", duration: "3s", size: 1 },
  { left: "32%", top: "20%", delay: "2.5s", duration: "5s", size: 2 },
  { left: "52%", top: "5%", delay: "0.8s", duration: "3.5s", size: 1 },
  { left: "67%", top: "15%", delay: "3s", duration: "4.5s", size: 1.5 },
  { left: "78%", top: "22%", delay: "1.5s", duration: "3s", size: 1 },
  { left: "90%", top: "10%", delay: "4s", duration: "5.5s", size: 2 },
  { left: "42%", top: "3%", delay: "2s", duration: "4s", size: 1 },
  { left: "8%", top: "35%", delay: "3.5s", duration: "3.5s", size: 1 },
  { left: "95%", top: "30%", delay: "0.5s", duration: "4.5s", size: 1.5 },
  { left: "60%", top: "40%", delay: "2.8s", duration: "3s", size: 1 },
  { left: "25%", top: "45%", delay: "1s", duration: "5s", size: 1 },
] as const;

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

function OrbitalLoader() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
      <div
        className="absolute rounded-full"
        style={{ width: 6, height: 6, background: "#00e5ff", boxShadow: "0 0 10px #00e5ff" }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 28, height: 28,
          border: "1px solid #00e5ff",
          animation: "spin 1.2s linear infinite",
          borderTopColor: "transparent", borderRightColor: "transparent",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 50, height: 50,
          border: "1px solid #7c4dff",
          animation: "spin 2.4s linear infinite reverse",
          borderTopColor: "transparent", borderLeftColor: "transparent",
        }}
      />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
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
      <div
        className="relative glass-panel"
        style={{
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          background: "rgba(16, 185, 129, 0.06)",
          border: "1px solid rgba(16, 185, 129, 0.25)",
        }}
      >
        <span
          style={{
            width: 8, height: 8,
            borderRadius: "50%",
            background: "#10b981",
            boxShadow: "0 0 8px #10b981",
            flexShrink: 0,
          }}
        />
        <span
          className="data-readout"
          style={{ color: "#10b981", fontSize: "0.8125rem", fontWeight: 600 }}
        >
          {label} — READY
        </span>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div
        className="relative glass-panel pulse-border"
        style={{
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
          border: "1px solid rgba(0,229,255,0.3)",
          boxShadow: "0 0 30px rgba(0,229,255,0.06)",
        }}
      >
        <OrbitalLoader />
        <span
          className="data-readout"
          style={{ color: "var(--color-cyan)", fontSize: "0.75rem", letterSpacing: "0.08em" }}
        >
          ANALYZING {label.toUpperCase()}…
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
        className="relative glass-panel"
        style={{
          padding: "2rem 1.5rem",
          textAlign: "center",
          cursor: "pointer",
          border: "1px dashed rgba(0,229,255,0.2)",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,229,255,0.4)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 20px rgba(0,229,255,0.06)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,229,255,0.2)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleInputChange}
        />
        <p
          className="data-readout"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            color: "var(--color-text)",
            fontSize: "0.9375rem",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--color-text-muted)",
            fontSize: "0.75rem",
            marginTop: "0.375rem",
            letterSpacing: "0.03em",
          }}
        >
          Click or drag and drop
        </p>
      </div>

      {isError && (
        <div
          className="glass-panel-warm"
          style={{
            padding: "0.625rem 0.875rem",
            color: "var(--color-amber)",
            fontSize: "0.75rem",
            fontFamily: "var(--font-body)",
          }}
        >
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

  const winnerColor =
    winner === "even" ? "var(--color-text-muted)" :
    winner === "A" ? "var(--color-cyan)" : "#a78bfa";

  const winnerText =
    winner === "even" ? "EVEN" :
    winner === "A" ? `A  +${percentDiff.toFixed(1)}%` : `B  +${percentDiff.toFixed(1)}%`;

  return (
    <div
      className="relative glass-panel"
      style={{ padding: "0.875rem 1rem" }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.625rem",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--color-text-muted)",
          marginBottom: "0.375rem",
        }}
      >
        {label}
      </p>
      <p
        className="data-readout"
        style={{
          fontSize: "0.875rem",
          fontWeight: 700,
          color: winnerColor,
          textShadow: winner !== "even" ? `0 0 8px ${winnerColor}` : "none",
        }}
      >
        {winnerText}
      </p>
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
    <div
      className="grain relative min-h-screen flex flex-col gap-4 p-4 overflow-hidden"
      style={{ background: "var(--color-void)" }}
    >
      {/* Minority Report grid + glows */}
      <div className="mr-grid" />
      <div className="mr-glow" style={{ top: "15%", left: "20%", width: 500, height: 500, background: "rgba(0, 229, 255, 0.05)" }} />
      <div className="mr-glow" style={{ top: "55%", right: "15%", width: 400, height: 400, background: "rgba(124, 77, 255, 0.04)" }} />

      {/* Twinkling stars */}
      {STAR_CONFIGS.map((s, i) => (
        <div
          key={`star-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            background: "#fff",
            animation: `twinkle ${s.duration} ${s.delay} ease-in-out infinite`,
          }}
        />
      ))}

      {/* Drifting space particles */}
      {DRIFT_PARTICLES.map((p, i) => (
        <div
          key={`drift-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animation: `space-drift ${p.duration} ${p.delay} ease-in-out infinite`,
            opacity: 0,
          }}
        />
      ))}

      {/* Nebula glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "30%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 700, height: 700,
          background: "radial-gradient(ellipse, rgba(124,77,255,0.04) 0%, rgba(0,229,255,0.02) 40%, transparent 70%)",
          animation: "nebula-pulse 14s ease-in-out infinite",
        }}
      />

      {/* All content above background layers */}
      <div className="relative z-10 flex flex-col gap-4">
        {/* Header */}
        <div className="text-center pt-2 fade-in">
          <h1
            className="gradient-text hud-header uppercase"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
              letterSpacing: "0.14em",
              display: "inline-block",
            }}
          >
            NEUROLENS
          </h1>
          <p
            className="data-readout fade-in fade-in-delay-1"
            style={{
              color: "var(--color-text-muted)",
              fontSize: "0.8125rem",
              marginTop: "0.375rem",
            }}
          >
            Comparative neural response analysis
          </p>
        </div>

        {/* Upload slots */}
        <div className="grid grid-cols-2 gap-4 fade-in fade-in-delay-1">
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
            <div className="grid grid-cols-2 gap-4 fade-in" style={{ height: "50vh" }}>
              {/* Brain A */}
              <div className="relative glass-panel overflow-hidden" style={{ borderRadius: 16 }}>
                <span
                  className="absolute top-3 left-3 z-10 glass-panel data-readout"
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    color: "var(--color-cyan)",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    padding: "0.25rem 0.625rem",
                    borderRadius: 6,
                  }}
                >
                  ◈ CONTENT A
                </span>
                <GlassBrain activations={activationsA} frame={frameA} />
              </div>

              {/* Brain B */}
              <div className="relative glass-panel overflow-hidden" style={{ borderRadius: 16 }}>
                <span
                  className="absolute top-3 left-3 z-10 glass-panel data-readout"
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    color: "#a78bfa",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    padding: "0.25rem 0.625rem",
                    borderRadius: 6,
                    border: "1px solid rgba(167,139,250,0.2)",
                    background: "rgba(167,139,250,0.04)",
                  }}
                >
                  ◈ CONTENT B
                </span>
                <GlassBrain activations={activationsB} frame={frameB} />
              </div>
            </div>

            {/* Delta metrics panel */}
            <div className="relative glass-panel fade-in fade-in-delay-1" style={{ padding: "1.25rem" }}>
              <h2
                className="hud-header data-readout"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "var(--color-text-muted)",
                  marginBottom: "1rem",
                }}
              >
                ⬡ Differential Analysis — A vs B
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {deltaMetrics.map((metric) => (
                  <DeltaMetricCard key={metric.key} metric={metric} />
                ))}
              </div>
            </div>

            {/* Shared timeline */}
            <div
              className="relative glass-panel fade-in fade-in-delay-2"
              style={{ height: "3.5rem", borderRadius: 16 }}
            >
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
    </div>
  );
}
