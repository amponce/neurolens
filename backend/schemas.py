from __future__ import annotations

from pydantic import BaseModel


class AnalysisStatus(BaseModel):
    id: str
    status: str
    progress: float
    error: str | None = None
    message: str | None = None


class FrameScores(BaseModel):
    time: float
    scores: dict[str, float]
    top_regions: list[str]
    roi_values: dict[str, float]


class AnalysisResult(BaseModel):
    id: str
    status: str
    input_type: str
    duration: float
    frames: list[FrameScores]
    summary: dict[str, float]
    vertex_activations: list[list[float]]
