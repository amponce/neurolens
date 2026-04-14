import { useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAnalysis } from "../hooks/useAnalysis";
import type { AnalysisResult } from "../types";

const ACCEPTED_EXTENSIONS =
  ".mp4,.avi,.mkv,.mov,.webm,.wav,.mp3,.flac,.ogg,.txt";

function storeResult(result: AnalysisResult): void {
  try {
    sessionStorage.setItem(`analysis:${result.id}`, JSON.stringify(result));
  } catch {
    // Storage quota exceeded — continue without caching
  }
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

  const isActive =
    state.phase === "uploading" || state.phase === "processing";

  const progress =
    state.phase === "uploading"
      ? 5
      : state.phase === "processing"
      ? state.progress
      : 0;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            NeuroLens
          </h1>
          <p className="text-gray-400 text-lg">
            See how the brain responds to your content
          </p>
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload file — click or drag and drop"
          onClick={handleZoneClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleZoneClick();
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={[
            "rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors",
            isActive
              ? "border-cyan-500 bg-gray-900 cursor-not-allowed"
              : "border-gray-700 bg-gray-900 hover:border-cyan-600 hover:bg-gray-800",
          ].join(" ")}
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
            <div className="space-y-3">
              <div className="text-4xl">📂</div>
              <p className="text-gray-300 font-medium">
                Drop a file here, or click to browse
              </p>
              <p className="text-gray-500 text-sm">
                Video, audio, or text — MP4, AVI, MKV, MOV, WEBM, WAV, MP3,
                FLAC, OGG, TXT
              </p>
            </div>
          )}

          {isActive && (
            <div className="space-y-4">
              <p className="text-cyan-400 font-medium">
                {state.phase === "uploading"
                  ? "Uploading…"
                  : `Analyzing… ${progress}%`}
              </p>
              {/* Progress bar */}
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {state.phase === "error" && (
          <div className="rounded-lg bg-red-950 border border-red-700 px-4 py-3 text-red-400 text-sm">
            {state.message}
          </div>
        )}

        {/* Compare link */}
        <div className="text-center">
          <Link
            to="/compare"
            className="text-gray-500 hover:text-cyan-400 text-sm transition-colors"
          >
            Compare two analyses →
          </Link>
        </div>
      </div>
    </div>
  );
}
