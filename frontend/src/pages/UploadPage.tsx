import { useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAnalysis } from "../hooks/useAnalysis";
import type { AnalysisResult } from "../types";

const ACCEPTED_EXTENSIONS =
  ".mp4,.avi,.mkv,.mov,.webm,.wav,.mp3,.flac,.ogg,.txt";

interface SampleExperiment {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  glowColor: string;
  samplePath: string;
  fileName: string;
}

const SAMPLE_EXPERIMENTS: SampleExperiment[] = [
  {
    id: "talk-vs-no-talk",
    title: "Talk vs No Talk",
    description: "Speech engagement versus silence — how the brain lights up when language is present",
    icon: "\u{1F399}",
    color: "#7dd3fc",
    glowColor: "rgba(125, 211, 252, 0.15)",
    samplePath: "/samples/talk-vs-no-talk.txt",
    fileName: "talk-vs-no-talk.txt",
  },
  {
    id: "emotional-vs-neutral",
    title: "Emotional vs Neutral",
    description: "Deep emotional narrative contrasted with dry factual reporting",
    icon: "\u{1F9E0}",
    color: "#a78bfa",
    glowColor: "rgba(167, 139, 250, 0.15)",
    samplePath: "/samples/emotional-vs-neutral.txt",
    fileName: "emotional-vs-neutral.txt",
  },
  {
    id: "visual-scene",
    title: "Visual Scene Description",
    description: "A vivid, cinematic description that activates the brain's visual imagery areas",
    icon: "\u{1F3DE}",
    color: "#fbbf24",
    glowColor: "rgba(251, 191, 36, 0.15)",
    samplePath: "/samples/visual-scene-description.txt",
    fileName: "visual-scene-description.txt",
  },
];

function storeResult(result: AnalysisResult): void {
  try {
    sessionStorage.setItem(`analysis:${result.id}`, JSON.stringify(result));
  } catch {
    // Storage quota exceeded — continue without caching
  }
}

// Drifting space particles — slow, varied sizes and colors
const DRIFT_PARTICLES = [
  { left: "8%", top: "85%", delay: "0s", duration: "25s", size: 2, color: "#7dd3fc" },
  { left: "22%", top: "90%", delay: "4s", duration: "32s", size: 1.5, color: "#a78bfa" },
  { left: "38%", top: "75%", delay: "8s", duration: "28s", size: 2.5, color: "#7dd3fc" },
  { left: "55%", top: "88%", delay: "2s", duration: "35s", size: 1, color: "#fbbf24" },
  { left: "70%", top: "80%", delay: "6s", duration: "22s", size: 2, color: "#a78bfa" },
  { left: "85%", top: "92%", delay: "10s", duration: "30s", size: 1.5, color: "#7dd3fc" },
  { left: "15%", top: "70%", delay: "12s", duration: "40s", size: 1, color: "#fbbf24" },
  { left: "48%", top: "95%", delay: "15s", duration: "26s", size: 1.5, color: "#a78bfa" },
] as const;

// Fixed twinkling stars
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

function NeuralIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Central node */}
      <circle cx="28" cy="28" r="4" fill="#a78bfa" opacity="0.9" />

      {/* Outer ring */}
      <circle cx="28" cy="28" r="14" stroke="#a78bfa" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.25" />

      {/* Connection nodes */}
      <circle cx="28" cy="14" r="2.5" fill="#7dd3fc" opacity="0.7" />
      <circle cx="41" cy="21" r="2.5" fill="#fbbf24" opacity="0.7" />
      <circle cx="41" cy="35" r="2.5" fill="#7dd3fc" opacity="0.7" />
      <circle cx="28" cy="42" r="2.5" fill="#a78bfa" opacity="0.7" />
      <circle cx="15" cy="35" r="2.5" fill="#fbbf24" opacity="0.7" />
      <circle cx="15" cy="21" r="2.5" fill="#7dd3fc" opacity="0.7" />

      {/* Connection lines */}
      <line x1="28" y1="24" x2="28" y2="16.5" stroke="#7dd3fc" strokeWidth="0.8" opacity="0.35" />
      <line x1="31.5" y1="26" x2="38.5" y2="22.5" stroke="#fbbf24" strokeWidth="0.8" opacity="0.35" />
      <line x1="31.5" y1="30" x2="38.5" y2="33.5" stroke="#7dd3fc" strokeWidth="0.8" opacity="0.35" />
      <line x1="28" y1="32" x2="28" y2="39.5" stroke="#a78bfa" strokeWidth="0.8" opacity="0.35" />
      <line x1="24.5" y1="30" x2="17.5" y2="33.5" stroke="#fbbf24" strokeWidth="0.8" opacity="0.35" />
      <line x1="24.5" y1="26" x2="17.5" y2="22.5" stroke="#7dd3fc" strokeWidth="0.8" opacity="0.35" />

      {/* Cross connections */}
      <line x1="28" y1="14" x2="41" y2="21" stroke="#a78bfa" strokeWidth="0.5" opacity="0.15" />
      <line x1="41" y1="35" x2="28" y2="42" stroke="#fbbf24" strokeWidth="0.5" opacity="0.15" />
      <line x1="15" y1="21" x2="28" y2="42" stroke="#7dd3fc" strokeWidth="0.5" opacity="0.15" />
    </svg>
  );
}

function OrbitalLoader() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      {/* Center dot */}
      <div
        className="absolute rounded-full"
        style={{ width: 6, height: 6, background: "#a78bfa", boxShadow: "0 0 10px #a78bfa" }}
      />

      {/* Ring 1 — fast */}
      <div
        className="absolute rounded-full"
        style={{
          width: 40,
          height: 40,
          borderColor: "#7dd3fc",
          borderWidth: 1,
          borderStyle: "solid",
          animation: "spin 1.2s linear infinite",
          opacity: 0.7,
          borderTopColor: "transparent",
          borderRightColor: "transparent",
        }}
      />

      {/* Ring 2 — medium */}
      <div
        className="absolute rounded-full"
        style={{
          width: 72,
          height: 72,
          border: "1px solid #a78bfa",
          animation: "spin 2.4s linear infinite reverse",
          opacity: 0.5,
          borderTopColor: "transparent",
          borderLeftColor: "transparent",
        }}
      />

      {/* Ring 3 — slow */}
      <div
        className="absolute rounded-full"
        style={{
          width: 108,
          height: 108,
          border: "1px solid #fbbf24",
          animation: "spin 4s linear infinite",
          opacity: 0.3,
          borderBottomColor: "transparent",
          borderRightColor: "transparent",
        }}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export function UploadPage() {
  const navigate = useNavigate();
  const { state, upload } = useAnalysis();
  const inputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);

  const handleFile = useCallback(
    async (file: File) => {
      await upload(file);
    },
    [upload]
  );

  // Watch for completion and navigate
  if (state.phase === "complete") {
    storeResult(state.result);
    navigate(`/visualize/${state.result.id}`);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDraggingRef.current = false;
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const handleZoneClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleSampleExperiment = useCallback(
    async (experiment: SampleExperiment) => {
      if (state.phase === "uploading" || state.phase === "processing") return;
      try {
        const response = await fetch(experiment.samplePath);
        if (!response.ok) throw new Error("Failed to load sample");
        const text = await response.text();
        const file = new File([text], experiment.fileName, { type: "text/plain" });
        await handleFile(file);
      } catch (err) {
        console.error("Failed to load sample experiment:", err);
      }
    },
    [handleFile, state.phase]
  );

  const isActive =
    state.phase === "uploading" || state.phase === "processing";

  const progress =
    state.phase === "uploading"
      ? 5
      : state.phase === "processing"
      ? state.progress
      : 0;

  return (
    <div
      className="grain relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden"
      style={{ background: "var(--color-void)" }}
    >
      {/* Minority Report grid floor */}
      <div className="mr-grid" />

      {/* Ambient glow spots */}
      <div className="mr-glow" style={{ top: "15%", left: "20%", width: 600, height: 600, background: "rgba(167, 139, 250, 0.07)" }} />
      <div className="mr-glow" style={{ top: "45%", right: "10%", width: 500, height: 500, background: "rgba(125, 211, 252, 0.05)" }} />
      <div className="mr-glow" style={{ bottom: "5%", left: "35%", width: 700, height: 400, background: "rgba(251, 191, 36, 0.03)" }} />

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

      {/* Nebula glow — large slow-breathing ambient light */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "25%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 800,
          height: 800,
          background: "radial-gradient(ellipse, rgba(124,77,255,0.05) 0%, rgba(0,229,255,0.03) 40%, transparent 70%)",
          animation: "nebula-pulse 12s ease-in-out infinite",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: "60%",
          left: "30%",
          transform: "translate(-50%, -50%)",
          width: 500,
          height: 500,
          background: "radial-gradient(ellipse, rgba(0,229,255,0.04) 0%, transparent 60%)",
          animation: "nebula-pulse 18s 3s ease-in-out infinite",
        }}
      />

      <div className="w-full max-w-2xl space-y-8 relative z-10">
        {/* Title */}
        <div className="text-center space-y-3 fade-in">
          <h1
            className="gradient-text uppercase"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(2rem, 5vw, 3.2rem)",
              letterSpacing: "0.12em",
            }}
          >
            NeuroLens
          </h1>
          <p
            className="fade-in fade-in-delay-1"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--color-text-muted)",
              fontSize: "1rem",
              letterSpacing: "0.02em",
            }}
          >
            Map how the brain responds to your content
          </p>
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload file — click or drag and drop"
          onClick={isActive ? undefined : handleZoneClick}
          onKeyDown={(e) => {
            if (!isActive && (e.key === "Enter" || e.key === " ")) handleZoneClick();
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="fade-in fade-in-delay-2 glass-panel"
          style={{
            padding: "3rem 2.5rem",
            textAlign: "center",
            cursor: isActive ? "default" : "pointer",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            disabled={isActive}
            onChange={handleInputChange}
          />

          {!isActive && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <NeuralIcon />
              </div>
              <div className="space-y-1">
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    fontSize: "1.125rem",
                  }}
                >
                  Drop your content here
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    color: "var(--color-text-muted)",
                    fontSize: "0.8125rem",
                  }}
                >
                  Video, audio, or text
                </p>
              </div>
            </div>
          )}

          {isActive && (
            <div className="space-y-5 flex flex-col items-center">
              <div className="pulse-border">
                <OrbitalLoader />
              </div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  color: "var(--color-cyan)",
                  fontSize: "0.9375rem",
                  letterSpacing: "0.05em",
                }}
              >
                {state.phase === "uploading"
                  ? "Mapping neural response..."
                  : state.phase === "processing" && state.message
                  ? `${state.message} ${progress}%`
                  : `Mapping neural response... ${progress}%`}
              </p>
            </div>
          )}
        </div>

        {/* Error message */}
        {state.phase === "error" && (
          <div
            className="fade-in rounded-xl px-4 py-3 text-sm"
            style={{
              background: "rgba(255,171,64,0.08)",
              border: "1px solid rgba(255,171,64,0.3)",
              color: "var(--color-amber)",
              fontFamily: "var(--font-body)",
            }}
          >
            {state.message}
          </div>
        )}

        {/* Compare link */}
        <div className="text-center fade-in fade-in-delay-3">
          <Link
            to="/compare"
            className="inline-flex items-center gap-2 transition-colors"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--color-text-muted)",
              fontSize: "0.875rem",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-cyan)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-text-muted)";
            }}
          >
            <span>or compare two files</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Explore Examples */}
        {!isActive && (
          <div className="fade-in fade-in-delay-4 space-y-4">
            <div className="text-center">
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  color: "var(--color-text-muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Explore Examples
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SAMPLE_EXPERIMENTS.map((experiment) => (
                <button
                  key={experiment.id}
                  type="button"
                  onClick={() => void handleSampleExperiment(experiment)}
                  className="glass-panel text-left transition-all duration-200"
                  style={{
                    padding: "1rem",
                    cursor: "pointer",
                    border: `1px solid rgba(255, 255, 255, 0.06)`,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = experiment.color;
                    el.style.boxShadow = `0 0 4px ${experiment.glowColor}, 0 0 20px ${experiment.glowColor}, inset 0 0 30px ${experiment.glowColor}`;
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = "rgba(255, 255, 255, 0.06)";
                    el.style.boxShadow = "";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{experiment.icon}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        fontSize: "0.8125rem",
                        color: experiment.color,
                      }}
                    >
                      {experiment.title}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "0.6875rem",
                      color: "var(--color-text-muted)",
                      lineHeight: 1.4,
                      margin: 0,
                    }}
                  >
                    {experiment.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
