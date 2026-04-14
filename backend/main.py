"""
FastAPI application entry point for NeuroLens.

Exposes the TRIBE v2 analysis pipeline via a JSON REST API.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.analyze import (
    get_analysis_result,
    get_analysis_status,
    load_model,
    start_analysis,
)
from backend.schemas import AnalysisResult, AnalysisStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supported upload extensions
# ---------------------------------------------------------------------------
_ALLOWED_EXTENSIONS: frozenset[str] = frozenset(
    {".mp4", ".avi", ".mkv", ".mov", ".webm", ".wav", ".mp3", ".flac", ".ogg", ".txt"}
)

_UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"

# ---------------------------------------------------------------------------
# Lifespan: load model before serving requests
# ---------------------------------------------------------------------------


@asynccontextmanager
async def _lifespan(app: FastAPI):  # noqa: ARG001
    load_model()
    yield


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(title="NeuroLens API", lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health")
def health() -> dict:
    """Liveness check."""
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalysisStatus)
async def analyze(file: UploadFile) -> AnalysisStatus:
    """Accept a media file upload and begin analysis.

    Returns an AnalysisStatus with ``status="queued"`` and the analysis ID
    that can be polled via ``GET /api/analyze/{analysis_id}``.

    Raises:
        400: If the uploaded file has an unsupported extension.
    """
    filename = file.filename or ""
    suffix = Path(filename).suffix.lower()
    if suffix not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type {suffix!r}. Allowed: {sorted(_ALLOWED_EXTENSIONS)}",
        )

    _UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    dest = _UPLOADS_DIR / filename
    contents = await file.read()
    dest.write_bytes(contents)

    analysis_id = start_analysis(dest)

    return AnalysisStatus(id=analysis_id, status="queued", progress=0.0)


@app.get("/api/analyze/{analysis_id}", response_model=AnalysisResult | AnalysisStatus)
def analysis_status(analysis_id: str) -> AnalysisResult | AnalysisStatus:
    """Poll an analysis by ID.

    Returns:
        AnalysisResult when the analysis is complete.
        AnalysisStatus (with progress) while still running.

    Raises:
        404: If the analysis ID is not found.
    """
    status_data = get_analysis_status(analysis_id)
    if status_data is None:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id!r} not found.")

    if status_data.get("status") == "complete":
        result = get_analysis_result(analysis_id)
        if result is not None:
            return result

    return AnalysisStatus(**status_data)
