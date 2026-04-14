export interface FrameScores {
  time: number;
  scores: Record<string, number>;
  top_regions: string[];
  roi_values: Record<string, number>;
}

export interface AnalysisResult {
  id: string;
  status: "complete";
  input_type: "video" | "audio" | "text";
  duration: number;
  frames: FrameScores[];
  summary: Record<string, number>;
  vertex_activations: number[][];
}

export interface AnalysisStatus {
  id: string;
  status: "processing" | "error" | "not_found";
  progress: number;
  error?: string;
}

export type AnalysisResponse = AnalysisResult | AnalysisStatus;

export interface BrainMesh {
  positions: number[];
  normals: number[];
  faces: number[];
  regionIds: number[];
  vertexCount: number;
  faceCount: number;
}

export interface RegionInfo {
  name: string;
  category: string;
  centroid: [number, number, number];
}

export interface BrainRegions {
  regions: Record<string, RegionInfo>;
  categories: Record<string, string>;
}

export const METRIC_COLORS: Record<string, string> = {
  visual_attention: "#f59e0b",
  audio_engagement: "#3b82f6",
  emotional_response: "#ef4444",
  memorability: "#8b5cf6",
  language_processing: "#10b981",
  cognitive_load: "#f97316",
};
