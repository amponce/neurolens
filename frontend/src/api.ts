import type { AnalysisResponse, AnalysisStatus } from "./types";

const BASE = "/api";

export async function uploadForAnalysis(file: File): Promise<AnalysisStatus> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/analyze`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json() as Promise<AnalysisStatus>;
}

export async function pollAnalysis(id: string): Promise<AnalysisResponse> {
  const res = await fetch(`${BASE}/analyze/${id}`);
  if (!res.ok) throw new Error(`Poll failed: ${res.statusText}`);
  return res.json() as Promise<AnalysisResponse>;
}
