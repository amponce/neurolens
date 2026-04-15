import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AnalysisResult } from "../types";
import { pollAnalysis } from "../api";
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

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--color-void)", color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
    >
      {message}
    </div>
  );
}

export function VisualizePage() {
  const { id } = useParams<{ id: string }>();
  const [fetchedResult, setFetchedResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionResult = id ? loadResult(id) : null;

  useEffect(() => {
    if (!id || sessionResult) return;
    setLoading(true);
    pollAnalysis(id)
      .then((res) => {
        if (res.status === "complete") {
          setFetchedResult(res as AnalysisResult);
        } else {
          setError("Analysis is still processing. Please wait.");
        }
      })
      .catch(() => setError("Failed to load analysis."))
      .finally(() => setLoading(false));
  }, [id, sessionResult]);

  if (!id) {
    return <EmptyState message="No analysis ID provided." />;
  }

  const result = sessionResult ?? fetchedResult;

  if (loading) {
    return <EmptyState message="Loading analysis..." />;
  }

  if (!result) {
    return <EmptyState message={error ?? "Analysis not found. Please upload a file first."} />;
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

  const filename = currentFrame
    ? `${result.input_type.toUpperCase()} · ${result.duration}s`
    : result.input_type.toUpperCase();

  return (
    <div
      className="grain fade-in relative"
      style={{
        background: "var(--color-void)",
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        gridTemplateRows: "44px 1fr 72px",
        height: "100vh",
        width: "100vw",
        gap: 6,
        padding: 6,
      }}
    >
      {/* Background */}
      <div className="mr-grid" />
      <div className="mr-glow" style={{ top: "20%", left: "10%", width: 500, height: 500, background: "rgba(167, 139, 250, 0.06)" }} />
      <div className="mr-glow" style={{ top: "55%", right: "5%", width: 400, height: 400, background: "rgba(125, 211, 252, 0.04)" }} />
      {/* Header bar — spans full width */}
      <div
        className="relative glass-panel fade-in"
        style={{
          gridColumn: "1 / 3",
          gridRow: "1",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: "1.25rem",
          paddingRight: "1.25rem",
        }}
      >
        {/* Logo */}
        <span
          className="gradient-text data-readout"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "0.875rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          NEUROLENS
        </span>

        {/* Filename */}
        <span
          className="data-readout"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "var(--color-text-muted)",
          }}
        >
          {filename}
        </span>

        {/* New Analysis link */}
        <Link
          to="/"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "var(--color-text-muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-cyan)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-text-muted)";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 6h10M6 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          New Analysis
        </Link>
      </div>

      {/* Brain viewer */}
      <div
        className="relative glass-panel fade-in fade-in-delay-1"
        style={{ gridColumn: "1", gridRow: "2", overflow: "hidden", borderRadius: 16 }}
      >
        <GlassBrain activations={activations} frame={currentFrame} />
      </div>

      {/* Right sidebar — spans rows 2 and 3 */}
      <div
        className="relative glass-panel fade-in fade-in-delay-2"
        style={{ gridColumn: "2", gridRow: "2 / 4", overflow: "hidden", borderRadius: 16 }}
      >
        <MetricsPanel result={result} frameIndex={frameIndex} />
      </div>

      {/* Timeline */}
      <div
        className="relative glass-panel fade-in fade-in-delay-3"
        style={{ gridColumn: "1", gridRow: "3", borderRadius: 16 }}
      >
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
