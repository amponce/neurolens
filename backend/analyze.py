"""
Async analysis module wrapping the TRIBE v2 model.

Provides start_analysis() to kick off background processing and
get_analysis_status() / get_analysis_result() to poll progress.
"""

from __future__ import annotations

import json
import logging
import sys
import threading
import uuid
from pathlib import Path

import numpy as np

# Make the tribev2 package importable when running from the repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".." / "tribev2"))

from tribev2.demo_utils import TribeModel  # noqa: E402
from tribev2.utils import (  # noqa: E402
    get_hcp_labels,
    get_topk_rois,
    summarize_by_roi,
)

from backend.interpret import compute_business_scores, normalize_scores_over_timeline
from backend.schemas import AnalysisResult, AnalysisStatus, FrameScores

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent
_UPLOADS_DIR = _BACKEND_DIR / "uploads"
_RESULTS_DIR = _BACKEND_DIR / "results"

# ---------------------------------------------------------------------------
# Global model state
# ---------------------------------------------------------------------------
_model: TribeModel | None = None
_region_names: list[str] = []

# ---------------------------------------------------------------------------
# Extension → input_type mapping
# ---------------------------------------------------------------------------
_VIDEO_EXTENSIONS: frozenset[str] = frozenset({".mp4", ".avi", ".mkv", ".mov", ".webm"})
_AUDIO_EXTENSIONS: frozenset[str] = frozenset({".wav", ".mp3", ".flac", ".ogg"})
_TEXT_EXTENSIONS: frozenset[str] = frozenset({".txt"})


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------


def load_model() -> None:
    """Load the TRIBE v2 model and cache HCP region names.

    Called once at application startup via the FastAPI lifespan handler.
    """
    global _model, _region_names

    logger.info("Loading TRIBE v2 model…")
    cache_dir = _BACKEND_DIR / "cache"
    _model = TribeModel.from_pretrained(
        "facebook/tribev2",
        cache_folder=str(cache_dir),
    )
    logger.info("TRIBE v2 model loaded.")

    # Cache region names used by interpret functions
    labels: dict = get_hcp_labels(mesh="fsaverage5", combine=False, hemi="both")
    _region_names = list(labels.keys())
    logger.info("HCP region names cached (%d regions).", len(_region_names))


# ---------------------------------------------------------------------------
# Status helpers
# ---------------------------------------------------------------------------


def _status_path(analysis_id: str) -> Path:
    return _RESULTS_DIR / analysis_id / "status.json"


def _result_path(analysis_id: str) -> Path:
    return _RESULTS_DIR / analysis_id / "result.json"


def _write_status(analysis_id: str, status: str, progress: float, error: str | None = None) -> None:
    """Persist status to disk as an immutable new file write."""
    status_data = {
        "id": analysis_id,
        "status": status,
        "progress": progress,
        "error": error,
    }
    path = _status_path(analysis_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(status_data), encoding="utf-8")


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------


def start_analysis(file_path: Path) -> str:
    """Kick off background analysis and return the analysis ID.

    Args:
        file_path: Path to the uploaded media file.

    Returns:
        A 12-character hex analysis ID.

    Raises:
        ValueError: If the file extension is not supported.
    """
    suffix = file_path.suffix.lower()
    if suffix in _VIDEO_EXTENSIONS:
        input_type = "video"
    elif suffix in _AUDIO_EXTENSIONS:
        input_type = "audio"
    elif suffix in _TEXT_EXTENSIONS:
        input_type = "text"
    else:
        raise ValueError(f"Unsupported file extension: {suffix!r}")

    analysis_id = uuid.uuid4().hex[:12]
    _write_status(analysis_id, "queued", 0.0)

    thread = threading.Thread(
        target=_run_analysis,
        args=(analysis_id, file_path, input_type),
        daemon=True,
    )
    thread.start()

    return analysis_id


def get_analysis_status(analysis_id: str) -> dict | None:
    """Read and return the status dict for an analysis, or None if not found."""
    path = _status_path(analysis_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def get_analysis_result(analysis_id: str) -> AnalysisResult | None:
    """Read and return the full result for a completed analysis, or None."""
    path = _result_path(analysis_id)
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return AnalysisResult(**data)


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------


def _run_analysis(analysis_id: str, file_path: Path, input_type: str) -> None:
    """Background thread that runs TRIBE v2 inference and stores results."""
    try:
        _write_status(analysis_id, "processing", 0.1)

        # Step 1: Build events dataframe
        kwargs = {f"{input_type}_path": str(file_path)}
        events = _model.get_events_dataframe(**kwargs)

        _write_status(analysis_id, "processing", 0.3)

        # Step 2: Run model prediction
        preds, segments = _model.predict(events, verbose=False)

        _write_status(analysis_id, "processing", 0.7)

        # Step 3: Build per-frame scores
        n_timesteps = preds.shape[0]
        raw_timeline: list[dict[str, float]] = []
        frame_top_regions: list[list[str]] = []
        frame_roi_values: list[dict[str, float]] = []

        for t in range(n_timesteps):
            frame_pred: np.ndarray = preds[t]

            roi_activations: np.ndarray = summarize_by_roi(frame_pred)
            scores: dict[str, float] = compute_business_scores(roi_activations, _region_names)
            top_regions: list[str] = list(get_topk_rois(frame_pred, k=10))

            # Build ROI value dict aligned with region_names
            roi_dict: dict[str, float] = {
                name: float(val)
                for name, val in zip(_region_names, roi_activations)
            }

            raw_timeline.append(scores)
            frame_top_regions.append(top_regions)
            frame_roi_values.append(roi_dict)

        # Step 4: Normalize scores over timeline
        normalized_timeline: list[dict[str, float]] = normalize_scores_over_timeline(raw_timeline)

        # Step 5: Compute summary as mean of normalized scores per metric
        if normalized_timeline:
            metric_keys = list(normalized_timeline[0].keys())
            summary: dict[str, float] = {
                metric: float(np.mean([frame[metric] for frame in normalized_timeline]))
                for metric in metric_keys
            }
        else:
            summary = {}

        # Step 6: Build frame objects
        frames: list[FrameScores] = [
            FrameScores(
                time=float(t),
                scores=normalized_timeline[t],
                top_regions=frame_top_regions[t],
                roi_values=frame_roi_values[t],
            )
            for t in range(n_timesteps)
        ]

        # Step 7: Subsample vertex activations (every 10th vertex)
        vertex_activations: list[list[float]] = preds[:, ::10].tolist()

        # Step 8: Save full activations as .npy
        result_dir = _RESULTS_DIR / analysis_id
        result_dir.mkdir(parents=True, exist_ok=True)
        np.save(str(result_dir / "activations.npy"), preds)

        # Step 9: Build and persist result
        duration = float(n_timesteps)
        result = AnalysisResult(
            id=analysis_id,
            status="complete",
            input_type=input_type,
            duration=duration,
            frames=frames,
            summary=summary,
            vertex_activations=vertex_activations,
        )
        _result_path(analysis_id).write_text(
            result.model_dump_json(), encoding="utf-8"
        )
        _write_status(analysis_id, "complete", 1.0)

    except Exception:
        logger.exception("Analysis %s failed.", analysis_id)
        _write_status(analysis_id, "error", 0.0, error="Analysis failed. See server logs.")
