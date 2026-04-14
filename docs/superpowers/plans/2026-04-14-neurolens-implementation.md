# NeuroLens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that wraps TRIBE v2 to produce interactive 3D glass brain visualizations of neural activation from video/audio/text content, with comparison mode.

**Architecture:** Python FastAPI backend (thin wrapper around TRIBE v2) serves analysis results. React + React Three Fiber frontend renders interactive glass brain with neural pathways, timeline scrubber, and metrics panel. Pre-exported brain mesh shipped as static JSON assets.

**Tech Stack:** Python 3.11, FastAPI, TRIBE v2 (at /Users/aponce/projects/tribev2), React 18, TypeScript, Vite, Tailwind v4, React Three Fiber, drei

**Spec:** `docs/specs/2026-04-14-neurolens-design.md`

---

## File Map

### Backend (`backend/`)

| File | Responsibility |
|---|---|
| `backend/main.py` | FastAPI app, CORS, model loading, endpoint registration |
| `backend/analyze.py` | TRIBE v2 wrapper: file handling, predict(), ROI aggregation |
| `backend/interpret.py` | ROI group → business score mapping + normalization |
| `backend/schemas.py` | Pydantic response models |
| `backend/requirements.txt` | Backend dependencies |
| `tests/test_interpret.py` | Unit tests for interpretation layer |
| `tests/test_analyze.py` | Integration tests for analysis pipeline |

### Mesh Export (`scripts/`)

| File | Responsibility |
|---|---|
| `scripts/export_mesh.py` | One-time: export fsaverage5 mesh + HCP regions to JSON |

### Frontend (`frontend/`)

| File | Responsibility |
|---|---|
| `frontend/src/App.tsx` | Router: Upload, Visualize, Compare pages |
| `frontend/src/api.ts` | Fetch wrapper for backend endpoints |
| `frontend/src/types.ts` | TypeScript types matching backend schemas |
| `frontend/src/pages/UploadPage.tsx` | Drag & drop upload with progress |
| `frontend/src/pages/VisualizePage.tsx` | Brain viewer + timeline + metrics layout |
| `frontend/src/pages/ComparePage.tsx` | Side-by-side two brains + delta metrics |
| `frontend/src/components/GlassBrain.tsx` | R3F: glass brain mesh with activation colors |
| `frontend/src/components/NeuralPathways.tsx` | R3F: glowing nodes + particle streams |
| `frontend/src/components/RegionTooltip.tsx` | Hover tooltip for brain regions |
| `frontend/src/components/Timeline.tsx` | Scrubber bar with play/pause |
| `frontend/src/components/MetricsPanel.tsx` | 6 business score gauges + sparklines |
| `frontend/src/components/ScoreBar.tsx` | Single animated score bar |
| `frontend/src/hooks/useAnalysis.ts` | Poll backend for analysis results |
| `frontend/src/hooks/useBrainMesh.ts` | Load and parse brain mesh JSON |
| `frontend/src/hooks/useTimeline.ts` | Timeline state: current frame, play/pause |
| `frontend/public/brain-mesh.json` | Pre-exported vertex positions + faces |
| `frontend/public/brain-regions.json` | Region ID → name → category mapping |

---

## Task 1: Project Scaffold

**Files:**
- Create: `backend/main.py`, `backend/requirements.txt`, `frontend/` (via Vite), `.gitignore`, `README.md`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/aponce/projects/neurolens
git init
```

- [ ] **Step 2: Create .gitignore**

Create `/Users/aponce/projects/neurolens/.gitignore`:
```
# Python
__pycache__/
*.pyc
.venv/
uploads/
results/

# Node
node_modules/
dist/

# IDE
.vscode/
.idea/

# OS
.DS_Store

# Data
*.mp4
*.wav
*.mp3
*.avi
```

- [ ] **Step 3: Create backend skeleton**

Create `/Users/aponce/projects/neurolens/backend/requirements.txt`:
```
fastapi==0.115.12
uvicorn[standard]==0.34.2
python-multipart==0.0.20
pydantic==2.13.0
```

Create `/Users/aponce/projects/neurolens/backend/main.py`:
```python
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="NeuroLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Scaffold frontend with Vite**

```bash
cd /Users/aponce/projects/neurolens
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install @react-three/fiber @react-three/drei three react-router-dom
npm install -D @types/three tailwindcss @tailwindcss/vite
```

- [ ] **Step 5: Configure Tailwind v4**

Replace contents of `frontend/src/index.css`:
```css
@import "tailwindcss";
```

Add Tailwind plugin to `frontend/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

- [ ] **Step 6: Verify both services start**

Terminal 1:
```bash
cd /Users/aponce/projects/neurolens/backend
PYTHONPATH=/Users/aponce/projects/tribev2 uvicorn main:app --reload --port 8000
```

Terminal 2:
```bash
cd /Users/aponce/projects/neurolens/frontend
npm run dev
```

Verify: `curl http://localhost:8000/api/health` returns `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: project scaffold with FastAPI backend and React frontend"
```

---

## Task 2: Export Brain Mesh

**Files:**
- Create: `scripts/export_mesh.py`, `frontend/public/brain-mesh.json`, `frontend/public/brain-regions.json`

- [ ] **Step 1: Write mesh export script**

Create `/Users/aponce/projects/neurolens/scripts/export_mesh.py`:
```python
"""Export fsaverage5 brain mesh and HCP atlas regions to JSON for the frontend.

Run once:
    cd /Users/aponce/projects/neurolens
    PYTHONPATH=/Users/aponce/projects/tribev2 python scripts/export_mesh.py
"""

import json
import sys
from pathlib import Path

import numpy as np
from nilearn.datasets import fetch_surf_fsaverage

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".." / "tribev2"))
from tribev2.utils import get_hcp_labels, get_hcp_vertex_labels

# Business metric category mapping
ROI_CATEGORIES: dict[str, str] = {
    # Visual Attention
    "V1": "visual_attention", "V2": "visual_attention", "V3": "visual_attention",
    "V4": "visual_attention", "V3A": "visual_attention", "V3B": "visual_attention",
    "V6": "visual_attention", "V6A": "visual_attention", "V7": "visual_attention",
    "V8": "visual_attention", "MT": "visual_attention", "MST": "visual_attention",
    "FST": "visual_attention", "FFC": "visual_attention", "VVC": "visual_attention",
    "VMV1": "visual_attention", "VMV2": "visual_attention", "VMV3": "visual_attention",
    "PIT": "visual_attention",
    # Audio Engagement
    "A1": "audio_engagement", "LBelt": "audio_engagement", "MBelt": "audio_engagement",
    "PBelt": "audio_engagement", "RI": "audio_engagement", "A4": "audio_engagement",
    "A5": "audio_engagement", "STGa": "audio_engagement", "TA2": "audio_engagement",
    # Emotional Response
    "OFC": "emotional_response", "10v": "emotional_response", "10r": "emotional_response",
    "a24": "emotional_response", "p32": "emotional_response", "s32": "emotional_response",
    "25": "emotional_response", "pOFC": "emotional_response", "13l": "emotional_response",
    "10d": "emotional_response", "Ig": "emotional_response",
    # Memorability
    "PCC": "memorability", "RSC": "memorability", "POS1": "memorability",
    "POS2": "memorability", "PreS": "memorability", "H": "memorability",
    "EC": "memorability", "PeEc": "memorability", "PHA1": "memorability",
    "PHA2": "memorability", "PHA3": "memorability",
    # Language Processing
    "44": "language_processing", "45": "language_processing", "47l": "language_processing",
    "TPOJ1": "language_processing", "TPOJ2": "language_processing",
    "TPOJ3": "language_processing", "STV": "language_processing",
    "PSL": "language_processing", "SFL": "language_processing",
    "STSdp": "language_processing", "STSda": "language_processing",
    "STSvp": "language_processing", "STSva": "language_processing",
    # Cognitive Load
    "8C": "cognitive_load", "46": "cognitive_load", "p9-46v": "cognitive_load",
    "8Av": "cognitive_load", "8Ad": "cognitive_load", "FEF": "cognitive_load",
    "IPS1": "cognitive_load", "8BL": "cognitive_load", "9m": "cognitive_load",
    "9p": "cognitive_load", "i6-8": "cognitive_load", "s6-8": "cognitive_load",
}

METRIC_LABELS: dict[str, str] = {
    "visual_attention": "Visual Attention",
    "audio_engagement": "Audio Engagement",
    "emotional_response": "Emotional Response",
    "memorability": "Memorability",
    "language_processing": "Language Processing",
    "cognitive_load": "Cognitive Load",
}


def export_mesh(output_dir: Path) -> None:
    """Export fsaverage5 mesh as JSON with per-vertex region IDs."""
    fsaverage = fetch_surf_fsaverage("fsaverage5")

    from nilearn.surface import load_surf_mesh

    lh = load_surf_mesh(fsaverage["pial_left"])
    rh = load_surf_mesh(fsaverage["pial_right"])

    lh_coords = np.array(lh.coordinates, dtype=np.float32)
    rh_coords = np.array(rh.coordinates, dtype=np.float32)
    lh_faces = np.array(lh.faces, dtype=np.int32)
    rh_faces = np.array(rh.faces, dtype=np.int32)

    # Offset right hemisphere faces by left hemisphere vertex count
    n_left = len(lh_coords)
    rh_faces_offset = rh_faces + n_left

    positions = np.concatenate([lh_coords, rh_coords])
    faces = np.concatenate([lh_faces, rh_faces_offset])

    # Compute vertex normals
    normals = np.zeros_like(positions)
    for tri in faces:
        v0, v1, v2 = positions[tri[0]], positions[tri[1]], positions[tri[2]]
        n = np.cross(v1 - v0, v2 - v0)
        normals[tri[0]] += n
        normals[tri[1]] += n
        normals[tri[2]] += n
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms[norms == 0] = 1
    normals = normals / norms

    # Get per-vertex HCP region labels
    vertex_labels = get_hcp_vertex_labels(mesh="fsaverage5", combine=False)

    # Build region ID map: region_name -> integer ID
    unique_regions = sorted(set(r for r in vertex_labels if r))
    region_to_id = {name: i + 1 for i, name in enumerate(unique_regions)}
    region_to_id[""] = 0  # unlabeled vertices

    region_ids = [region_to_id.get(label, 0) for label in vertex_labels]

    # Compute region centroids (for neural pathway nodes)
    hcp_labels = get_hcp_labels(mesh="fsaverage5", combine=False, hemi="both")
    region_centroids = {}
    for name, vertices in hcp_labels.items():
        if len(vertices) > 0:
            centroid = positions[vertices].mean(axis=0).tolist()
            region_centroids[name] = centroid

    # Save mesh JSON
    mesh_data = {
        "positions": positions.flatten().tolist(),
        "normals": normals.flatten().tolist(),
        "faces": faces.flatten().tolist(),
        "regionIds": region_ids,
        "vertexCount": len(positions),
        "faceCount": len(faces),
    }
    mesh_path = output_dir / "brain-mesh.json"
    with open(mesh_path, "w") as f:
        json.dump(mesh_data, f)
    print(f"Wrote {mesh_path} ({mesh_path.stat().st_size / 1024 / 1024:.1f} MB)")

    # Save regions JSON
    regions_data = {
        "regions": {
            str(rid): {
                "name": name,
                "category": ROI_CATEGORIES.get(name, "other"),
                "centroid": region_centroids.get(name, [0, 0, 0]),
            }
            for name, rid in region_to_id.items()
            if name
        },
        "categories": METRIC_LABELS,
    }
    regions_path = output_dir / "brain-regions.json"
    with open(regions_path, "w") as f:
        json.dump(regions_data, f, indent=2)
    print(f"Wrote {regions_path}")


if __name__ == "__main__":
    output_dir = Path(__file__).resolve().parents[1] / "frontend" / "public"
    output_dir.mkdir(parents=True, exist_ok=True)
    export_mesh(output_dir)
```

- [ ] **Step 2: Run the export**

```bash
cd /Users/aponce/projects/neurolens
PYTHONPATH=/Users/aponce/projects/tribev2 python scripts/export_mesh.py
```

Expected: `brain-mesh.json` (~5-10 MB) and `brain-regions.json` in `frontend/public/`

- [ ] **Step 3: Verify the exported data**

```bash
python -c "
import json
with open('frontend/public/brain-mesh.json') as f:
    d = json.load(f)
print(f'Vertices: {d[\"vertexCount\"]}')
print(f'Faces: {d[\"faceCount\"]}')
print(f'Region IDs unique: {len(set(d[\"regionIds\"]))}')
with open('frontend/public/brain-regions.json') as f:
    r = json.load(f)
print(f'Named regions: {len(r[\"regions\"])}')
print(f'Categories: {list(r[\"categories\"].keys())}')
"
```

Expected: ~20,484 vertices, ~40,960 faces, ~180 regions, 6 categories

- [ ] **Step 4: Commit**

```bash
git add scripts/ frontend/public/brain-mesh.json frontend/public/brain-regions.json
git commit -m "feat: export fsaverage5 brain mesh and HCP region map to JSON"
```

---

## Task 3: Interpretation Layer (TDD)

**Files:**
- Create: `backend/interpret.py`, `backend/schemas.py`, `tests/test_interpret.py`

- [ ] **Step 1: Write failing tests**

Create `/Users/aponce/projects/neurolens/tests/__init__.py` (empty file)

Create `/Users/aponce/projects/neurolens/tests/test_interpret.py`:
```python
import numpy as np
import pytest

from backend.interpret import (
    METRIC_CATEGORIES,
    compute_business_scores,
    normalize_scores_over_timeline,
)


def test_metric_categories_has_all_six():
    expected = {
        "visual_attention",
        "audio_engagement",
        "emotional_response",
        "memorability",
        "language_processing",
        "cognitive_load",
    }
    assert set(METRIC_CATEGORIES.keys()) == expected


def test_compute_business_scores_returns_all_metrics():
    # Fake ROI summary: 180 values (one per region)
    roi_values = np.random.rand(180)
    region_names = [f"region_{i}" for i in range(180)]
    scores = compute_business_scores(roi_values, region_names)
    assert set(scores.keys()) == set(METRIC_CATEGORIES.keys())
    for v in scores.values():
        assert isinstance(v, float)


def test_compute_business_scores_higher_visual_with_visual_activation():
    region_names = ["V1", "V2", "V3", "A1", "OFC", "PCC", "44", "8C"]
    # High activation on visual regions (V1, V2, V3), low elsewhere
    roi_values = np.array([0.9, 0.85, 0.8, 0.1, 0.1, 0.1, 0.1, 0.1])
    scores = compute_business_scores(roi_values, region_names)
    assert scores["visual_attention"] > scores["audio_engagement"]
    assert scores["visual_attention"] > scores["emotional_response"]


def test_normalize_scores_over_timeline():
    timeline = [
        {"visual_attention": 0.2, "audio_engagement": 0.5},
        {"visual_attention": 0.8, "audio_engagement": 1.0},
        {"visual_attention": 0.5, "audio_engagement": 0.75},
    ]
    normalized = normalize_scores_over_timeline(timeline)
    # After normalization, max should be 1.0, min should be 0.0 per metric
    va_values = [frame["visual_attention"] for frame in normalized]
    assert max(va_values) == pytest.approx(1.0)
    assert min(va_values) == pytest.approx(0.0)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/aponce/projects/neurolens
python -m pytest tests/test_interpret.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'backend'`

- [ ] **Step 3: Implement interpret.py**

Create `/Users/aponce/projects/neurolens/backend/__init__.py` (empty file)

Create `/Users/aponce/projects/neurolens/backend/interpret.py`:
```python
"""Map TRIBE v2 ROI activations to business-facing engagement scores."""

from __future__ import annotations

import numpy as np

# ROI name → business metric category
ROI_TO_CATEGORY: dict[str, str] = {
    # Visual Attention
    "V1": "visual_attention", "V2": "visual_attention", "V3": "visual_attention",
    "V4": "visual_attention", "V3A": "visual_attention", "V3B": "visual_attention",
    "V6": "visual_attention", "V6A": "visual_attention", "V7": "visual_attention",
    "V8": "visual_attention", "MT": "visual_attention", "MST": "visual_attention",
    "FST": "visual_attention", "FFC": "visual_attention", "VVC": "visual_attention",
    "VMV1": "visual_attention", "VMV2": "visual_attention", "VMV3": "visual_attention",
    "PIT": "visual_attention",
    # Audio Engagement
    "A1": "audio_engagement", "LBelt": "audio_engagement", "MBelt": "audio_engagement",
    "PBelt": "audio_engagement", "RI": "audio_engagement", "A4": "audio_engagement",
    "A5": "audio_engagement", "STGa": "audio_engagement", "TA2": "audio_engagement",
    # Emotional Response
    "OFC": "emotional_response", "10v": "emotional_response", "10r": "emotional_response",
    "a24": "emotional_response", "p32": "emotional_response", "s32": "emotional_response",
    "25": "emotional_response", "pOFC": "emotional_response", "13l": "emotional_response",
    "10d": "emotional_response", "Ig": "emotional_response",
    # Memorability
    "PCC": "memorability", "RSC": "memorability", "POS1": "memorability",
    "POS2": "memorability", "PreS": "memorability", "H": "memorability",
    "EC": "memorability", "PeEc": "memorability", "PHA1": "memorability",
    "PHA2": "memorability", "PHA3": "memorability",
    # Language Processing
    "44": "language_processing", "45": "language_processing", "47l": "language_processing",
    "TPOJ1": "language_processing", "TPOJ2": "language_processing",
    "TPOJ3": "language_processing", "STV": "language_processing",
    "PSL": "language_processing", "SFL": "language_processing",
    "STSdp": "language_processing", "STSda": "language_processing",
    "STSvp": "language_processing", "STSva": "language_processing",
    # Cognitive Load
    "8C": "cognitive_load", "46": "cognitive_load", "p9-46v": "cognitive_load",
    "8Av": "cognitive_load", "8Ad": "cognitive_load", "FEF": "cognitive_load",
    "IPS1": "cognitive_load", "8BL": "cognitive_load", "9m": "cognitive_load",
    "9p": "cognitive_load", "i6-8": "cognitive_load", "s6-8": "cognitive_load",
}

METRIC_CATEGORIES: dict[str, str] = {
    "visual_attention": "Visual Attention",
    "audio_engagement": "Audio Engagement",
    "emotional_response": "Emotional Response",
    "memorability": "Memorability",
    "language_processing": "Language Processing",
    "cognitive_load": "Cognitive Load",
}


def compute_business_scores(
    roi_values: np.ndarray, region_names: list[str]
) -> dict[str, float]:
    """Compute 6 business scores from per-ROI activation values.

    Groups ROIs by category and returns the mean activation per group.
    Returns 0.0 for categories with no matching ROIs in the input.
    """
    category_sums: dict[str, list[float]] = {k: [] for k in METRIC_CATEGORIES}

    for value, name in zip(roi_values, region_names):
        category = ROI_TO_CATEGORY.get(name)
        if category is not None:
            category_sums[category].append(float(value))

    return {
        category: float(np.mean(values)) if values else 0.0
        for category, values in category_sums.items()
    }


def normalize_scores_over_timeline(
    timeline: list[dict[str, float]],
) -> list[dict[str, float]]:
    """Min-max normalize each metric across all timesteps to [0, 1]."""
    if not timeline:
        return []

    metrics = list(timeline[0].keys())
    result = [dict(frame) for frame in timeline]

    for metric in metrics:
        values = [frame[metric] for frame in timeline]
        vmin, vmax = min(values), max(values)
        spread = vmax - vmin
        for i, frame in enumerate(result):
            result[i][metric] = (frame[metric] - vmin) / spread if spread > 0 else 0.0

    return result
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/aponce/projects/neurolens
python -m pytest tests/test_interpret.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 5: Create schemas.py**

Create `/Users/aponce/projects/neurolens/backend/schemas.py`:
```python
"""Pydantic response models for the NeuroLens API."""

from __future__ import annotations

from pydantic import BaseModel


class AnalysisStatus(BaseModel):
    id: str
    status: str  # "processing" | "complete" | "error"
    progress: float  # 0.0 to 1.0
    error: str | None = None


class FrameScores(BaseModel):
    time: float
    scores: dict[str, float]  # metric_name -> value (0-1)
    top_regions: list[str]
    roi_values: dict[str, float]  # region_name -> raw activation


class AnalysisResult(BaseModel):
    id: str
    status: str
    input_type: str  # "video" | "audio" | "text"
    duration: float  # seconds
    frames: list[FrameScores]
    summary: dict[str, float]  # metric_name -> overall score
    vertex_activations: list[list[float]]  # per-frame, per-vertex activations
```

- [ ] **Step 6: Commit**

```bash
git add backend/ tests/
git commit -m "feat: interpretation layer mapping ROIs to business scores with tests"
```

---

## Task 4: Backend Analysis Endpoints

**Files:**
- Create: `backend/analyze.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write analyze.py**

Create `/Users/aponce/projects/neurolens/backend/analyze.py`:
```python
"""TRIBE v2 analysis wrapper — thin layer around existing functions."""

from __future__ import annotations

import json
import logging
import sys
import uuid
from pathlib import Path
from threading import Thread

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".." / "tribev2"))

from tribev2.demo_utils import TribeModel
from tribev2.utils import get_hcp_labels, get_topk_rois, summarize_by_roi

from backend.interpret import compute_business_scores, normalize_scores_over_timeline
from backend.schemas import AnalysisResult, FrameScores

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(__file__).parent / "uploads"
RESULTS_DIR = Path(__file__).parent / "results"
UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)

# Global model instance — loaded once at startup
_model: TribeModel | None = None
_region_names: list[str] | None = None

INPUT_TYPE_MAP = {
    ".mp4": "video", ".avi": "video", ".mkv": "video", ".mov": "video", ".webm": "video",
    ".wav": "audio", ".mp3": "audio", ".flac": "audio", ".ogg": "audio",
    ".txt": "text",
}


def load_model() -> None:
    """Load TRIBE v2 model and cache HCP region names."""
    global _model, _region_names
    logger.info("Loading TRIBE v2 model...")
    _model = TribeModel.from_pretrained(
        "facebook/tribev2", cache_folder=str(Path(__file__).parent / "cache")
    )
    labels = get_hcp_labels(mesh="fsaverage5", combine=False, hemi="both")
    _region_names = list(labels.keys())
    logger.info("Model loaded. %d HCP regions available.", len(_region_names))


def get_analysis_status(analysis_id: str) -> dict:
    """Read current status from disk."""
    status_path = RESULTS_DIR / analysis_id / "status.json"
    if not status_path.exists():
        return {"id": analysis_id, "status": "not_found", "progress": 0.0}
    with open(status_path) as f:
        return json.load(f)


def get_analysis_result(analysis_id: str) -> AnalysisResult | None:
    """Load completed analysis result from disk."""
    result_path = RESULTS_DIR / analysis_id / "result.json"
    if not result_path.exists():
        return None
    with open(result_path) as f:
        return AnalysisResult(**json.load(f))


def _write_status(analysis_id: str, status: str, progress: float, error: str | None = None) -> None:
    out_dir = RESULTS_DIR / analysis_id
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "status.json", "w") as f:
        json.dump({"id": analysis_id, "status": status, "progress": progress, "error": error}, f)


def _run_analysis(analysis_id: str, file_path: Path, input_type: str) -> None:
    """Run TRIBE v2 analysis in a background thread."""
    try:
        _write_status(analysis_id, "processing", 0.1)

        # Build events from input
        kwargs = {f"{input_type}_path": str(file_path)}
        events = _model.get_events_dataframe(**kwargs)
        _write_status(analysis_id, "processing", 0.3)

        # Run prediction
        preds, segments = _model.predict(events, verbose=False)
        _write_status(analysis_id, "processing", 0.7)

        # Process each timestep
        raw_scores_timeline = []
        frames: list[dict] = []
        for t in range(len(preds)):
            roi_values = summarize_by_roi(preds[t], hemi="both", mesh="fsaverage5")
            scores = compute_business_scores(roi_values, _region_names)
            raw_scores_timeline.append(scores)
            top = get_topk_rois(preds[t], hemi="both", mesh="fsaverage5", k=10)
            frames.append({
                "time": float(t * 2.0),  # TR ~2s
                "scores": scores,
                "top_regions": top.tolist(),
                "roi_values": {name: float(v) for name, v in zip(_region_names, roi_values)},
            })

        # Normalize scores across timeline
        normalized = normalize_scores_over_timeline(raw_scores_timeline)
        for i, norm_scores in enumerate(normalized):
            frames[i]["scores"] = norm_scores

        # Summary: mean of normalized scores
        summary = {}
        for metric in normalized[0]:
            summary[metric] = float(np.mean([f[metric] for f in normalized]))

        # Subsample vertex activations (every 10th vertex for bandwidth)
        vertex_activations = preds[:, ::10].tolist()

        duration = frames[-1]["time"] + 2.0 if frames else 0.0

        result = AnalysisResult(
            id=analysis_id,
            status="complete",
            input_type=input_type,
            duration=duration,
            frames=[FrameScores(**f) for f in frames],
            summary=summary,
            vertex_activations=vertex_activations,
        )

        out_dir = RESULTS_DIR / analysis_id
        with open(out_dir / "result.json", "w") as f:
            f.write(result.model_dump_json())

        # Also save full vertex data for the glass brain (not subsampled)
        np.save(out_dir / "full_activations.npy", preds)

        _write_status(analysis_id, "complete", 1.0)
        logger.info("Analysis %s complete: %d frames", analysis_id, len(frames))

    except Exception as e:
        logger.exception("Analysis %s failed", analysis_id)
        _write_status(analysis_id, "error", 0.0, error=str(e))


def start_analysis(file_path: Path) -> str:
    """Start async analysis and return the analysis ID."""
    analysis_id = uuid.uuid4().hex[:12]
    suffix = file_path.suffix.lower()
    input_type = INPUT_TYPE_MAP.get(suffix)
    if input_type is None:
        raise ValueError(f"Unsupported file type: {suffix}")

    _write_status(analysis_id, "processing", 0.0)
    thread = Thread(target=_run_analysis, args=(analysis_id, file_path, input_type), daemon=True)
    thread.start()
    return analysis_id
```

- [ ] **Step 2: Update main.py with endpoints**

Replace `/Users/aponce/projects/neurolens/backend/main.py`:
```python
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.analyze import (
    UPLOAD_DIR,
    get_analysis_result,
    get_analysis_status,
    load_model,
    start_analysis,
)
from backend.schemas import AnalysisResult, AnalysisStatus

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(title="NeuroLens API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalysisStatus)
async def analyze(file: UploadFile):
    """Upload a file and start analysis."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".mp4", ".avi", ".mkv", ".mov", ".webm", ".wav", ".mp3", ".flac", ".ogg", ".txt"}:
        raise HTTPException(400, f"Unsupported file type: {suffix}")

    file_path = UPLOAD_DIR / f"{file.filename}"
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    analysis_id = start_analysis(file_path)
    return AnalysisStatus(id=analysis_id, status="processing", progress=0.0)


@app.get("/api/analyze/{analysis_id}", response_model=AnalysisResult | AnalysisStatus)
def get_analysis(analysis_id: str):
    """Poll for analysis results."""
    result = get_analysis_result(analysis_id)
    if result is not None:
        return result
    status = get_analysis_status(analysis_id)
    if status["status"] == "not_found":
        raise HTTPException(404, "Analysis not found")
    return AnalysisStatus(**status)
```

- [ ] **Step 3: Verify backend starts and endpoints work**

```bash
cd /Users/aponce/projects/neurolens
PYTHONPATH=/Users/aponce/projects/tribev2:. uvicorn backend.main:app --reload --port 8000
```

Test health: `curl http://localhost:8000/api/health`
Test upload: `curl -X POST http://localhost:8000/api/analyze -F "file=@/path/to/short_clip.mp4"`

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat: FastAPI endpoints wrapping TRIBE v2 analysis pipeline"
```

---

## Task 5: Frontend Types and API Client

**Files:**
- Create: `frontend/src/types.ts`, `frontend/src/api.ts`

- [ ] **Step 1: Create TypeScript types**

Create `/Users/aponce/projects/neurolens/frontend/src/types.ts`:
```typescript
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
```

- [ ] **Step 2: Create API client**

Create `/Users/aponce/projects/neurolens/frontend/src/api.ts`:
```typescript
import type { AnalysisResponse, AnalysisStatus } from "./types";

const BASE = "/api";

export async function uploadForAnalysis(file: File): Promise<AnalysisStatus> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/analyze`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export async function pollAnalysis(id: string): Promise<AnalysisResponse> {
  const res = await fetch(`${BASE}/analyze/${id}`);
  if (!res.ok) throw new Error(`Poll failed: ${res.statusText}`);
  return res.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts
git commit -m "feat: TypeScript types and API client matching backend schemas"
```

---

## Task 6: Frontend Shell — Router, Upload Page, Layout

**Files:**
- Create: `frontend/src/App.tsx`, `frontend/src/pages/UploadPage.tsx`, `frontend/src/pages/VisualizePage.tsx`, `frontend/src/pages/ComparePage.tsx`, `frontend/src/hooks/useAnalysis.ts`

- [ ] **Step 1: Create useAnalysis hook**

Create `/Users/aponce/projects/neurolens/frontend/src/hooks/useAnalysis.ts`:
```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import { pollAnalysis, uploadForAnalysis } from "../api";
import type { AnalysisResult, AnalysisStatus } from "../types";

type State =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "processing"; id: string; progress: number }
  | { phase: "complete"; result: AnalysisResult }
  | { phase: "error"; message: string };

export function useAnalysis() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const upload = useCallback(
    async (file: File) => {
      try {
        setState({ phase: "uploading" });
        const status = await uploadForAnalysis(file);
        setState({ phase: "processing", id: status.id, progress: 0 });

        intervalRef.current = setInterval(async () => {
          try {
            const res = await pollAnalysis(status.id);
            if (res.status === "complete") {
              stopPolling();
              setState({ phase: "complete", result: res as AnalysisResult });
            } else if (res.status === "error") {
              stopPolling();
              setState({
                phase: "error",
                message: (res as AnalysisStatus).error || "Analysis failed",
              });
            } else {
              setState({
                phase: "processing",
                id: status.id,
                progress: (res as AnalysisStatus).progress,
              });
            }
          } catch (e) {
            stopPolling();
            setState({ phase: "error", message: String(e) });
          }
        }, 2000);
      } catch (e) {
        setState({ phase: "error", message: String(e) });
      }
    },
    [stopPolling],
  );

  useEffect(() => stopPolling, [stopPolling]);

  return { state, upload };
}
```

- [ ] **Step 2: Create UploadPage**

Create directories and file `/Users/aponce/projects/neurolens/frontend/src/pages/UploadPage.tsx`:
```tsx
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAnalysis } from "../hooks/useAnalysis";

export function UploadPage() {
  const { state, upload } = useAnalysis();
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);

  // Navigate when analysis completes
  if (state.phase === "complete") {
    // Store result in sessionStorage for the visualize page
    sessionStorage.setItem(
      `analysis:${state.result.id}`,
      JSON.stringify(state.result),
    );
    navigate(`/visualize/${state.result.id}`);
  }

  const handleFile = useCallback(
    (file: File) => {
      upload(file);
    },
    [upload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
        NeuroLens
      </h1>
      <p className="text-gray-400 mb-12 text-lg">
        See how the brain responds to your content
      </p>

      {state.phase === "idle" || state.phase === "error" ? (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-cyan-400 bg-cyan-400/10"
                : "border-gray-700 hover:border-gray-500"
            }`}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".mp4,.avi,.mkv,.mov,.webm,.wav,.mp3,.flac,.ogg,.txt";
              input.onchange = () => {
                const file = input.files?.[0];
                if (file) handleFile(file);
              };
              input.click();
            }}
          >
            <div className="text-4xl mb-4">🧠</div>
            <p className="text-gray-300 text-lg">
              Drop a video, audio, or text file
            </p>
            <p className="text-gray-500 text-sm mt-2">
              MP4, WAV, MP3, TXT supported
            </p>
          </div>
          {state.phase === "error" && (
            <p className="text-red-400 mt-4">{state.message}</p>
          )}
        </>
      ) : (
        <div className="text-center">
          <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-500"
              style={{
                width: `${
                  state.phase === "uploading"
                    ? 5
                    : state.phase === "processing"
                      ? Math.max(state.progress * 100, 10)
                      : 100
                }%`,
              }}
            />
          </div>
          <p className="text-gray-400">
            {state.phase === "uploading"
              ? "Uploading..."
              : "Analyzing brain response..."}
          </p>
        </div>
      )}

      <div className="mt-16 flex gap-8">
        <button
          onClick={() => navigate("/compare")}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          Compare two files →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create VisualizePage placeholder**

Create `/Users/aponce/projects/neurolens/frontend/src/pages/VisualizePage.tsx`:
```tsx
import { useParams } from "react-router-dom";
import type { AnalysisResult } from "../types";

export function VisualizePage() {
  const { id } = useParams<{ id: string }>();
  const stored = sessionStorage.getItem(`analysis:${id}`);
  const result: AnalysisResult | null = stored ? JSON.parse(stored) : null;

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">No analysis data found. Upload a file first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="grid grid-cols-[1fr_300px] grid-rows-[1fr_80px] h-[calc(100vh-2rem)] gap-4">
        {/* Brain viewer - Task 7 */}
        <div className="bg-gray-900 rounded-xl flex items-center justify-center">
          <p className="text-gray-500">Glass Brain (coming next)</p>
        </div>

        {/* Metrics panel - Task 9 */}
        <div className="bg-gray-900 rounded-xl p-4 row-span-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Engagement Scores
          </h2>
          {Object.entries(result.summary).map(([metric, value]) => (
            <div key={metric} className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">{metric.replace(/_/g, " ")}</span>
                <span className="text-gray-400">{(value * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all"
                  style={{ width: `${value * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Timeline - Task 8 */}
        <div className="bg-gray-900 rounded-xl flex items-center justify-center">
          <p className="text-gray-500">Timeline (coming next)</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ComparePage placeholder**

Create `/Users/aponce/projects/neurolens/frontend/src/pages/ComparePage.tsx`:
```tsx
export function ComparePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400">Compare view (coming in Task 11)</p>
    </div>
  );
}
```

- [ ] **Step 5: Wire up App.tsx with router**

Replace `/Users/aponce/projects/neurolens/frontend/src/App.tsx`:
```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ComparePage } from "./pages/ComparePage";
import { UploadPage } from "./pages/UploadPage";
import { VisualizePage } from "./pages/VisualizePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/visualize/:id" element={<VisualizePage />} />
        <Route path="/compare" element={<ComparePage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Clean up default Vite files**

Remove `frontend/src/App.css` (styles are in Tailwind now).
Update `frontend/src/main.tsx` to import `./index.css` only.

- [ ] **Step 7: Verify frontend compiles and renders**

```bash
cd /Users/aponce/projects/neurolens/frontend
npm run dev
```

Open `http://localhost:5173` — should see the NeuroLens upload page with drag & drop zone.

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: frontend shell with upload page, router, and API polling"
```

---

## Task 7: Glass Brain Component

**Files:**
- Create: `frontend/src/components/GlassBrain.tsx`, `frontend/src/hooks/useBrainMesh.ts`

- [ ] **Step 1: Create useBrainMesh hook**

Create `/Users/aponce/projects/neurolens/frontend/src/hooks/useBrainMesh.ts`:
```typescript
import { useEffect, useState } from "react";
import type { BrainMesh, BrainRegions } from "../types";

export function useBrainMesh() {
  const [mesh, setMesh] = useState<BrainMesh | null>(null);
  const [regions, setRegions] = useState<BrainRegions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/brain-mesh.json").then((r) => r.json()),
      fetch("/brain-regions.json").then((r) => r.json()),
    ]).then(([meshData, regionData]) => {
      setMesh(meshData);
      setRegions(regionData);
      setLoading(false);
    });
  }, []);

  return { mesh, regions, loading };
}
```

- [ ] **Step 2: Create GlassBrain component**

Create `/Users/aponce/projects/neurolens/frontend/src/components/GlassBrain.tsx`:
```tsx
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useBrainMesh } from "../hooks/useBrainMesh";
import type { BrainRegions } from "../types";
import { RegionTooltip } from "./RegionTooltip";

// Color map: cold blue → cyan → yellow → hot orange/white
function activationToColor(value: number, target: THREE.Color): THREE.Color {
  const clamped = Math.max(0, Math.min(1, value));
  if (clamped < 0.25) {
    target.setRGB(0.1, 0.1, 0.3 + clamped * 2);
  } else if (clamped < 0.5) {
    const t = (clamped - 0.25) * 4;
    target.setRGB(0.1, 0.2 + t * 0.6, 0.8 - t * 0.2);
  } else if (clamped < 0.75) {
    const t = (clamped - 0.5) * 4;
    target.setRGB(0.1 + t * 0.8, 0.8, 0.6 - t * 0.4);
  } else {
    const t = (clamped - 0.75) * 4;
    target.setRGB(0.9 + t * 0.1, 0.8 - t * 0.4, 0.2 + t * 0.6);
  }
  return target;
}

interface BrainMeshProps {
  activations: number[] | null; // per-vertex activation values
  regions: BrainRegions | null;
  regionIds: number[];
  onHoverRegion: (region: { name: string; category: string; value: number; position: THREE.Vector3 } | null) => void;
}

function BrainSurface({ activations, regions, regionIds, onHoverRegion }: BrainMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { mesh: brainMesh } = useBrainMesh();
  const raycaster = useThree((s) => s.raycaster);

  const geometry = useMemo(() => {
    if (!brainMesh) return null;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(brainMesh.positions);
    const normals = new Float32Array(brainMesh.normals);
    const indices = new Uint32Array(brainMesh.faces);

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    // Initialize vertex colors
    const colors = new Float32Array(brainMesh.vertexCount * 3);
    colors.fill(0.2); // dark gray default
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return geo;
  }, [brainMesh]);

  // Update vertex colors when activations change
  useFrame(() => {
    if (!geometry || !activations) return;
    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;
    const tempColor = new THREE.Color();

    for (let i = 0; i < activations.length; i++) {
      activationToColor(activations[i], tempColor);
      colorAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
    }
    colorAttr.needsUpdate = true;
  });

  const handlePointerMove = useCallback(
    (e: THREE.Event<PointerEvent>) => {
      if (!regions || !brainMesh) return;
      const intersection = (e as unknown as { intersections: THREE.Intersection[] }).intersections?.[0];
      if (!intersection?.face) {
        onHoverRegion(null);
        return;
      }
      const vertexIndex = intersection.face.a;
      const regionId = regionIds[vertexIndex];
      const regionInfo = regions.regions[String(regionId)];
      if (!regionInfo || regionInfo.category === "other") {
        onHoverRegion(null);
        return;
      }
      const activation = activations?.[vertexIndex] ?? 0;
      onHoverRegion({
        name: regionInfo.name,
        category: regions.categories[regionInfo.category] || regionInfo.category,
        value: activation,
        position: intersection.point.clone(),
      });
    },
    [regions, regionIds, activations, brainMesh, onHoverRegion],
  );

  if (!geometry) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onHoverRegion(null)}
    >
      <meshPhysicalMaterial
        vertexColors
        transparent
        opacity={0.6}
        roughness={0.15}
        metalness={0.1}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
        transmission={0.3}
        thickness={2.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface GlassBrainProps {
  activations: number[] | null;
}

export function GlassBrain({ activations }: GlassBrainProps) {
  const { mesh, regions, loading } = useBrainMesh();
  const [hoveredRegion, setHoveredRegion] = useState<{
    name: string;
    category: string;
    value: number;
    position: THREE.Vector3;
  } | null>(null);

  if (loading || !mesh) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        Loading brain mesh...
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [0, 0, 250], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[100, 100, 100]} intensity={0.8} />
        <directionalLight position={[-100, -50, -100]} intensity={0.3} />
        <pointLight position={[0, 200, 0]} intensity={0.5} color="#4fc3f7" />
        <BrainSurface
          activations={activations}
          regions={regions}
          regionIds={mesh.regionIds}
          onHoverRegion={setHoveredRegion}
        />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          minDistance={150}
          maxDistance={400}
        />
      </Canvas>
      {hoveredRegion && (
        <RegionTooltip
          name={hoveredRegion.name}
          category={hoveredRegion.category}
          value={hoveredRegion.value}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create RegionTooltip**

Create `/Users/aponce/projects/neurolens/frontend/src/components/RegionTooltip.tsx`:
```tsx
interface RegionTooltipProps {
  name: string;
  category: string;
  value: number;
}

export function RegionTooltip({ name, category, value }: RegionTooltipProps) {
  return (
    <div className="absolute top-4 left-4 bg-gray-900/90 border border-gray-700 rounded-lg px-4 py-3 pointer-events-none backdrop-blur-sm">
      <p className="text-white font-semibold">{name}</p>
      <p className="text-gray-400 text-sm">{category}</p>
      <p className="text-cyan-400 text-sm mt-1">
        Activation: {(value * 100).toFixed(0)}%
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Wire GlassBrain into VisualizePage**

Update `/Users/aponce/projects/neurolens/frontend/src/pages/VisualizePage.tsx` — replace the brain viewer placeholder with:
```tsx
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { GlassBrain } from "../components/GlassBrain";
import type { AnalysisResult } from "../types";

export function VisualizePage() {
  const { id } = useParams<{ id: string }>();
  const stored = sessionStorage.getItem(`analysis:${id}`);
  const result: AnalysisResult | null = stored ? JSON.parse(stored) : null;
  const [frameIndex, setFrameIndex] = useState(0);

  const activations = useMemo(() => {
    if (!result?.vertex_activations?.[frameIndex]) return null;
    return result.vertex_activations[frameIndex];
  }, [result, frameIndex]);

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">No analysis data found. Upload a file first.</p>
      </div>
    );
  }

  const currentFrame = result.frames[frameIndex];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="grid grid-cols-[1fr_300px] grid-rows-[1fr_80px] h-[calc(100vh-2rem)] gap-4">
        {/* Brain viewer */}
        <div className="bg-gray-900 rounded-xl overflow-hidden">
          <GlassBrain activations={activations} />
        </div>

        {/* Metrics panel */}
        <div className="bg-gray-900 rounded-xl p-4 row-span-2 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Engagement Scores
          </h2>
          {currentFrame &&
            Object.entries(currentFrame.scores).map(([metric, value]) => (
              <div key={metric} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300 capitalize">
                    {metric.replace(/_/g, " ")}
                  </span>
                  <span className="text-gray-400">
                    {(value * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
              </div>
            ))}
          {currentFrame && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Top Regions
              </h3>
              {currentFrame.top_regions.slice(0, 8).map((region) => (
                <p key={region} className="text-gray-300 text-sm">
                  {region}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-gray-900 rounded-xl px-4 flex items-center gap-4">
          <span className="text-gray-500 text-sm w-12">
            {currentFrame ? `${currentFrame.time.toFixed(0)}s` : "0s"}
          </span>
          <input
            type="range"
            min={0}
            max={result.frames.length - 1}
            value={frameIndex}
            onChange={(e) => setFrameIndex(Number(e.target.value))}
            className="flex-1 accent-cyan-500"
          />
          <span className="text-gray-500 text-sm w-12">
            {result.duration.toFixed(0)}s
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify brain renders in browser**

Start frontend dev server, navigate to `/visualize/test` — should see "No analysis data" message.
To test mesh rendering without full pipeline: temporarily load `brain-mesh.json` with null activations.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: glass brain 3D viewer with vertex coloring and hover tooltips"
```

---

## Task 8: Neural Pathways (Glowing Nodes + Particles)

**Files:**
- Create: `frontend/src/components/NeuralPathways.tsx`
- Modify: `frontend/src/components/GlassBrain.tsx`

- [ ] **Step 1: Create NeuralPathways component**

Create `/Users/aponce/projects/neurolens/frontend/src/components/NeuralPathways.tsx`:
```tsx
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { BrainRegions, FrameScores } from "../types";

interface NeuralPathwaysProps {
  regions: BrainRegions;
  frame: FrameScores | null;
}

function GlowingSphere({
  position,
  intensity,
  color,
}: {
  position: [number, number, number];
  intensity: number;
  color: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const scale = 1 + intensity * 3;

  useFrame((_, delta) => {
    if (ref.current) {
      // Gentle pulse
      const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.1 * intensity;
      ref.current.scale.setScalar(scale * pulse);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[1.5, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity * 2}
        transparent
        opacity={0.6 + intensity * 0.4}
      />
    </mesh>
  );
}

function ParticleStream({
  start,
  end,
  intensity,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  intensity: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const particleCount = 20;

  const { positions, geometry } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      pos[i * 3] = start.x + (end.x - start.x) * t;
      pos[i * 3 + 1] = start.y + (end.y - start.y) * t;
      pos[i * 3 + 2] = start.z + (end.z - start.z) * t;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { positions: pos, geometry: geo };
  }, [start, end]);

  useFrame(() => {
    if (!ref.current) return;
    const posAttr = ref.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < particleCount; i++) {
      // Move particles along the path
      let t = ((i / particleCount + Date.now() * 0.0005 * intensity) % 1);
      arr[i * 3] = start.x + (end.x - start.x) * t;
      arr[i * 3 + 1] = start.y + (end.y - start.y) * t;
      arr[i * 3 + 2] = start.z + (end.z - start.z) * t;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={1.5}
        color="#4fc3f7"
        transparent
        opacity={intensity}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export function NeuralPathways({ regions, frame }: NeuralPathwaysProps) {
  const activeNodes = useMemo(() => {
    if (!frame) return [];
    // Get top regions by ROI value
    const entries = Object.entries(frame.roi_values)
      .filter(([name]) => {
        const regionEntry = Object.values(regions.regions).find(
          (r) => r.name === name,
        );
        return regionEntry && regionEntry.category !== "other";
      })
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15);

    return entries.map(([name, value]) => {
      const regionEntry = Object.values(regions.regions).find(
        (r) => r.name === name,
      );
      const maxVal = entries[0]?.[1] || 1;
      return {
        name,
        position: (regionEntry?.centroid || [0, 0, 0]) as [number, number, number],
        intensity: maxVal > 0 ? value / maxVal : 0,
        category: regionEntry?.category || "other",
      };
    });
  }, [frame, regions]);

  const connections = useMemo(() => {
    if (activeNodes.length < 2) return [];
    const conns: { start: THREE.Vector3; end: THREE.Vector3; intensity: number }[] = [];
    // Connect nodes in same category
    for (let i = 0; i < activeNodes.length; i++) {
      for (let j = i + 1; j < activeNodes.length; j++) {
        if (
          activeNodes[i].category === activeNodes[j].category &&
          activeNodes[i].intensity > 0.3 &&
          activeNodes[j].intensity > 0.3
        ) {
          conns.push({
            start: new THREE.Vector3(...activeNodes[i].position),
            end: new THREE.Vector3(...activeNodes[j].position),
            intensity: (activeNodes[i].intensity + activeNodes[j].intensity) / 2,
          });
        }
      }
    }
    return conns.slice(0, 20); // Limit for performance
  }, [activeNodes]);

  const categoryColors: Record<string, string> = {
    visual_attention: "#f59e0b",
    audio_engagement: "#3b82f6",
    emotional_response: "#ef4444",
    memorability: "#8b5cf6",
    language_processing: "#10b981",
    cognitive_load: "#f97316",
  };

  return (
    <group>
      {activeNodes.map((node) => (
        <GlowingSphere
          key={node.name}
          position={node.position}
          intensity={node.intensity}
          color={categoryColors[node.category] || "#4fc3f7"}
        />
      ))}
      {connections.map((conn, i) => (
        <ParticleStream key={i} {...conn} />
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Add NeuralPathways to GlassBrain Canvas**

In `GlassBrain.tsx`, add NeuralPathways inside the Canvas, after BrainSurface:
```tsx
// Add import
import { NeuralPathways } from "./NeuralPathways";

// Add prop
interface GlassBrainProps {
  activations: number[] | null;
  frame?: FrameScores | null;
}

// Inside Canvas, after BrainSurface:
{regions && <NeuralPathways regions={regions} frame={frame ?? null} />}
```

Update `VisualizePage.tsx` to pass `frame` prop:
```tsx
<GlassBrain activations={activations} frame={currentFrame} />
```

- [ ] **Step 3: Verify nodes and particles render**

Open browser — should see glowing spheres inside the brain at active region centroids, with particle streams connecting same-category regions.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: neural pathway nodes with particle streams between co-active regions"
```

---

## Task 9: Timeline with Play/Pause

**Files:**
- Create: `frontend/src/components/Timeline.tsx`, `frontend/src/hooks/useTimeline.ts`

- [ ] **Step 1: Create useTimeline hook**

Create `/Users/aponce/projects/neurolens/frontend/src/hooks/useTimeline.ts`:
```typescript
import { useCallback, useEffect, useRef, useState } from "react";

interface UseTimelineOptions {
  frameCount: number;
  fps?: number;
}

export function useTimeline({ frameCount, fps = 1 }: UseTimelineOptions) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);

  const seek = useCallback(
    (frame: number) => {
      setFrameIndex(Math.max(0, Math.min(frame, frameCount - 1)));
    },
    [frameCount],
  );

  useEffect(() => {
    if (playing && frameCount > 0) {
      intervalRef.current = setInterval(() => {
        setFrameIndex((prev) => {
          const next = prev + 1;
          if (next >= frameCount) {
            setPlaying(false);
            return prev;
          }
          return next;
        });
      }, 1000 / fps);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, frameCount, fps]);

  return { frameIndex, playing, play, pause, toggle, seek };
}
```

- [ ] **Step 2: Create Timeline component**

Create `/Users/aponce/projects/neurolens/frontend/src/components/Timeline.tsx`:
```tsx
import type { FrameScores } from "../types";

interface TimelineProps {
  frames: FrameScores[];
  frameIndex: number;
  playing: boolean;
  onSeek: (frame: number) => void;
  onToggle: () => void;
}

export function Timeline({
  frames,
  frameIndex,
  playing,
  onSeek,
  onToggle,
}: TimelineProps) {
  const currentTime = frames[frameIndex]?.time ?? 0;
  const totalTime = frames.length > 0 ? frames[frames.length - 1].time + 2 : 0;

  // Compute intensity bars for the mini-heatmap
  const intensities = frames.map((f) => {
    const values = Object.values(f.scores);
    return values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  });
  const maxIntensity = Math.max(...intensities, 0.01);

  return (
    <div className="flex items-center gap-3 w-full h-full px-4">
      <button
        onClick={onToggle}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 transition-colors text-white shrink-0"
      >
        {playing ? "⏸" : "▶"}
      </button>

      <span className="text-gray-500 text-sm w-12 text-right shrink-0">
        {currentTime.toFixed(0)}s
      </span>

      <div className="flex-1 relative h-10 flex items-end gap-px">
        {intensities.map((intensity, i) => (
          <div
            key={i}
            className="flex-1 cursor-pointer relative"
            style={{ height: "100%" }}
            onClick={() => onSeek(i)}
          >
            <div
              className={`absolute bottom-0 w-full rounded-sm transition-all ${
                i === frameIndex ? "bg-cyan-400" : "bg-gray-600"
              }`}
              style={{
                height: `${(intensity / maxIntensity) * 100}%`,
                minHeight: "2px",
                opacity: i === frameIndex ? 1 : 0.5 + (intensity / maxIntensity) * 0.5,
              }}
            />
          </div>
        ))}
      </div>

      <span className="text-gray-500 text-sm w-12 shrink-0">
        {totalTime.toFixed(0)}s
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Wire into VisualizePage**

Update `VisualizePage.tsx` to use `useTimeline` and `Timeline`:
```tsx
import { useTimeline } from "../hooks/useTimeline";
import { Timeline } from "../components/Timeline";

// Inside component:
const { frameIndex, playing, toggle, seek } = useTimeline({
  frameCount: result.frames.length,
  fps: 1,
});

// Replace the timeline div:
<div className="bg-gray-900 rounded-xl overflow-hidden">
  <Timeline
    frames={result.frames}
    frameIndex={frameIndex}
    playing={playing}
    onSeek={seek}
    onToggle={toggle}
  />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: timeline scrubber with play/pause and intensity heatmap"
```

---

## Task 10: Metrics Panel with Sparklines

**Files:**
- Create: `frontend/src/components/MetricsPanel.tsx`, `frontend/src/components/ScoreBar.tsx`

- [ ] **Step 1: Create ScoreBar component**

Create `/Users/aponce/projects/neurolens/frontend/src/components/ScoreBar.tsx`:
```tsx
import { METRIC_COLORS } from "../types";

interface ScoreBarProps {
  metric: string;
  label: string;
  value: number;
  history: number[]; // all values across timeline for sparkline
  currentIndex: number;
}

export function ScoreBar({ metric, label, value, history, currentIndex }: ScoreBarProps) {
  const color = METRIC_COLORS[metric] || "#4fc3f7";
  const max = Math.max(...history, 0.01);

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span style={{ color }} className="font-mono">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      {/* Score bar */}
      <div className="h-2 bg-gray-800 rounded-full mb-2">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value * 100}%`, backgroundColor: color }}
        />
      </div>
      {/* Sparkline */}
      <svg viewBox={`0 0 ${history.length} 20`} className="w-full h-5" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1"
          opacity="0.4"
          points={history
            .map((v, i) => `${i},${20 - (v / max) * 18}`)
            .join(" ")}
        />
        {currentIndex < history.length && (
          <circle
            cx={currentIndex}
            cy={20 - (history[currentIndex] / max) * 18}
            r="1.5"
            fill={color}
          />
        )}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Create MetricsPanel component**

Create `/Users/aponce/projects/neurolens/frontend/src/components/MetricsPanel.tsx`:
```tsx
import type { AnalysisResult } from "../types";
import { ScoreBar } from "./ScoreBar";

const METRIC_LABELS: Record<string, string> = {
  visual_attention: "Visual Attention",
  audio_engagement: "Audio Engagement",
  emotional_response: "Emotional Response",
  memorability: "Memorability",
  language_processing: "Language Processing",
  cognitive_load: "Cognitive Load",
};

interface MetricsPanelProps {
  result: AnalysisResult;
  frameIndex: number;
}

export function MetricsPanel({ result, frameIndex }: MetricsPanelProps) {
  const currentFrame = result.frames[frameIndex];
  if (!currentFrame) return null;

  const metrics = Object.keys(METRIC_LABELS);

  return (
    <div className="p-4 overflow-y-auto h-full">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Neural Engagement
      </h2>
      {metrics.map((metric) => (
        <ScoreBar
          key={metric}
          metric={metric}
          label={METRIC_LABELS[metric]}
          value={currentFrame.scores[metric] ?? 0}
          history={result.frames.map((f) => f.scores[metric] ?? 0)}
          currentIndex={frameIndex}
        />
      ))}

      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-2">
        Top Active Regions
      </h3>
      <div className="space-y-1">
        {currentFrame.top_regions.slice(0, 8).map((region) => (
          <div
            key={region}
            className="text-sm text-gray-300 flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {region}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into VisualizePage**

Replace the metrics panel section in `VisualizePage.tsx`:
```tsx
import { MetricsPanel } from "../components/MetricsPanel";

// Replace metrics div:
<div className="bg-gray-900 rounded-xl row-span-2 overflow-hidden">
  <MetricsPanel result={result} frameIndex={frameIndex} />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: metrics panel with animated score bars and sparklines"
```

---

## Task 11: Comparison Page

**Files:**
- Modify: `frontend/src/pages/ComparePage.tsx`

- [ ] **Step 1: Build ComparePage**

Replace `/Users/aponce/projects/neurolens/frontend/src/pages/ComparePage.tsx`:
```tsx
import { useCallback, useMemo, useState } from "react";
import { GlassBrain } from "../components/GlassBrain";
import { Timeline } from "../components/Timeline";
import { useAnalysis } from "../hooks/useAnalysis";
import { useTimeline } from "../hooks/useTimeline";
import type { AnalysisResult } from "../types";

const METRIC_LABELS: Record<string, string> = {
  visual_attention: "Visual Attention",
  audio_engagement: "Audio Engagement",
  emotional_response: "Emotional Response",
  memorability: "Memorability",
  language_processing: "Language Processing",
  cognitive_load: "Cognitive Load",
};

function UploadSlot({
  label,
  result,
  onUpload,
  loading,
}: {
  label: string;
  result: AnalysisResult | null;
  onUpload: (file: File) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 flex items-center justify-center">
        <p className="text-gray-400">Analyzing {label}...</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="border border-green-800 rounded-xl p-3 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="text-gray-300 text-sm">{label}: Ready</span>
      </div>
    );
  }

  return (
    <div
      className="border-2 border-dashed border-gray-700 rounded-xl p-8 flex items-center justify-center cursor-pointer hover:border-gray-500 transition-colors"
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".mp4,.avi,.wav,.mp3,.txt";
        input.onchange = () => {
          const file = input.files?.[0];
          if (file) onUpload(file);
        };
        input.click();
      }}
    >
      <p className="text-gray-500">Upload {label}</p>
    </div>
  );
}

export function ComparePage() {
  const analysisA = useAnalysis();
  const analysisB = useAnalysis();

  const resultA =
    analysisA.state.phase === "complete" ? analysisA.state.result : null;
  const resultB =
    analysisB.state.phase === "complete" ? analysisB.state.result : null;

  const maxFrames = Math.max(
    resultA?.frames.length ?? 0,
    resultB?.frames.length ?? 0,
  );
  const { frameIndex, playing, toggle, seek } = useTimeline({
    frameCount: maxFrames || 1,
  });

  const activationsA = useMemo(
    () => resultA?.vertex_activations?.[frameIndex] ?? null,
    [resultA, frameIndex],
  );
  const activationsB = useMemo(
    () => resultB?.vertex_activations?.[frameIndex] ?? null,
    [resultB, frameIndex],
  );

  const bothReady = resultA && resultB;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <h1 className="text-2xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
        Compare Content
      </h1>

      {/* Upload slots */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <UploadSlot
          label="Content A"
          result={resultA}
          onUpload={analysisA.upload}
          loading={
            analysisA.state.phase === "uploading" ||
            analysisA.state.phase === "processing"
          }
        />
        <UploadSlot
          label="Content B"
          result={resultB}
          onUpload={analysisB.upload}
          loading={
            analysisB.state.phase === "uploading" ||
            analysisB.state.phase === "processing"
          }
        />
      </div>

      {bothReady && (
        <>
          {/* Side-by-side brains */}
          <div className="grid grid-cols-2 gap-4 mb-4" style={{ height: "50vh" }}>
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <GlassBrain
                activations={activationsA}
                frame={resultA.frames[frameIndex] ?? null}
              />
            </div>
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <GlassBrain
                activations={activationsB}
                frame={resultB.frames[frameIndex] ?? null}
              />
            </div>
          </div>

          {/* Delta metrics */}
          <div className="bg-gray-900 rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Comparison: Content A vs B
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(METRIC_LABELS).map(([metric, label]) => {
                const a = resultA.summary[metric] ?? 0;
                const b = resultB.summary[metric] ?? 0;
                const diff = a - b;
                const winner = diff > 0.05 ? "A" : diff < -0.05 ? "B" : "Tie";
                return (
                  <div key={metric} className="text-center">
                    <p className="text-gray-400 text-xs mb-1">{label}</p>
                    <p className="text-lg font-bold">
                      {winner === "A" && (
                        <span className="text-cyan-400">
                          A +{(diff * 100).toFixed(0)}%
                        </span>
                      )}
                      {winner === "B" && (
                        <span className="text-purple-400">
                          B +{(Math.abs(diff) * 100).toFixed(0)}%
                        </span>
                      )}
                      {winner === "Tie" && (
                        <span className="text-gray-500">Even</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shared timeline */}
          <div className="bg-gray-900 rounded-xl h-16">
            <Timeline
              frames={resultA.frames}
              frameIndex={frameIndex}
              playing={playing}
              onSeek={seek}
              onToggle={toggle}
            />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify comparison page**

Navigate to `/compare`, upload two files, verify side-by-side rendering with delta metrics.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ComparePage.tsx
git commit -m "feat: comparison page with side-by-side brain viewers and delta metrics"
```

---

## Task 12: End-to-End Integration Test

**Files:**
- No new files — verify full pipeline

- [ ] **Step 1: Start backend**

```bash
cd /Users/aponce/projects/neurolens
PYTHONPATH=/Users/aponce/projects/tribev2:. uvicorn backend.main:app --port 8000
```

Wait for "Model loaded" log message.

- [ ] **Step 2: Start frontend**

```bash
cd /Users/aponce/projects/neurolens/frontend
npm run dev
```

- [ ] **Step 3: Test upload flow**

1. Open `http://localhost:5173`
2. Upload a short video clip (5-10 seconds MP4)
3. Wait for processing progress bar
4. Verify redirect to visualization page
5. Verify glass brain renders with vertex coloring
6. Verify metrics panel shows 6 scores
7. Scrub timeline — brain colors and metrics should update
8. Hover brain surface — tooltip shows region name

- [ ] **Step 4: Test comparison flow**

1. Navigate to `/compare`
2. Upload two different clips
3. Verify side-by-side brains render
4. Verify delta metrics show differences
5. Scrub shared timeline

- [ ] **Step 5: Test audio and text inputs**

1. Upload a `.wav` or `.mp3` file
2. Upload a `.txt` file
3. Verify both process and render

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: NeuroLens prototype complete — glass brain, neural pathways, comparison mode"
```
