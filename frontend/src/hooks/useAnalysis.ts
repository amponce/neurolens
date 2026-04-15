import { useCallback, useEffect, useRef, useState } from "react";
import { pollAnalysis, uploadForAnalysis } from "../api";
import type { AnalysisResult } from "../types";

type AnalysisState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "processing"; progress: number; message?: string }
  | { phase: "complete"; result: AnalysisResult }
  | { phase: "error"; message: string };

export interface UseAnalysisReturn {
  state: AnalysisState;
  upload: (file: File) => Promise<void>;
}

export function useAnalysis(): UseAnalysisReturn {
  const [state, setState] = useState<AnalysisState>({ phase: "idle" });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return clearPolling;
  }, [clearPolling]);

  const upload = useCallback(
    async (file: File) => {
      setState({ phase: "uploading" });

      let analysisId: string;
      try {
        const status = await uploadForAnalysis(file);
        analysisId = status.id;
        setState({ phase: "processing", progress: status.progress ?? 0 });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        setState({ phase: "error", message });
        return;
      }

      clearPolling();

      intervalRef.current = setInterval(async () => {
        try {
          const response = await pollAnalysis(analysisId);

          if (response.status === "complete") {
            clearPolling();
            setState({ phase: "complete", result: response });
          } else if (response.status === "error") {
            clearPolling();
            setState({
              phase: "error",
              message: response.error ?? "Analysis failed",
            });
          } else if (response.status === "not_found") {
            clearPolling();
            setState({ phase: "error", message: "Analysis not found" });
          } else {
            setState({ phase: "processing", progress: response.progress, message: response.message });
          }
        } catch (err: unknown) {
          clearPolling();
          const message =
            err instanceof Error ? err.message : "Polling failed";
          setState({ phase: "error", message });
        }
      }, 2000);
    },
    [clearPolling]
  );

  return { state, upload };
}
