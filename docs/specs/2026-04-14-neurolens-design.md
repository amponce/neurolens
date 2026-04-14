# NeuroLens — Design Spec

## Overview

NeuroLens is a standalone web app that takes video, audio, or text content and produces an interactive 3D glass brain visualization showing predicted neural activation patterns. Users can compare two pieces of content side-by-side. Built as a prototype to validate the neuromarketing product concept.

## Core Flow

1. User uploads content (video MP4, audio WAV/MP3, or text TXT)
2. FastAPI backend passes input to TRIBE v2 (`TribeModel.predict()`)
3. Raw predictions (n_timesteps x 20,484 vertices) are aggregated via `summarize_by_roi()` into ~180 HCP atlas regions
4. Thin interpretation layer maps ROI groups to 6 business scores
5. React frontend renders interactive glass brain with neural pathways
6. User scrubs timeline, hovers regions, or compares two inputs side-by-side

## Architecture

### Backend (Python, FastAPI)

Thin wrapper around TRIBE v2. Three endpoints:

- `POST /api/analyze` — accepts file upload, returns analysis ID, starts async processing
- `GET /api/analyze/{id}` — returns analysis status and results (poll-based)
- `GET /api/analyze/{id}/frame/{t}` — returns ROI data for a specific timestep

Processing pipeline (all TRIBE v2 functions):
```python
model = TribeModel.from_pretrained("facebook/tribev2")
events = model.get_events_dataframe(video_path=path)
preds, segments = model.predict(events)
roi_scores = summarize_by_roi(preds[t])
top_regions = get_topk_rois(preds[t], k=20)
```

The only new backend logic is `interpret.py` — maps HCP ROI names to business score categories:

| ROI Group | Business Metric |
|---|---|
| V1, V2, V3, V4, MT, FFC | Visual Attention |
| A1, Belt, PBelt, RI | Audio Engagement |
| OFC, 10v, 10r, a24, p32 | Emotional Response |
| PCC, RSC, PHA1-3 | Memorability |
| 44, 45, STSdp, STV, TPOJ1 | Language Processing |
| dlPFC (8C, 46, p9-46v), FEF, IPS1 | Cognitive Load |

Each score: mean activation of the ROI group, normalized 0-1 across the full timeline.

Results stored as JSON on disk (keyed by analysis ID).

### Frontend (React, TypeScript, Vite, Tailwind v4, React Three Fiber)

**Pre-exported brain mesh:** fsaverage5 mesh exported once as GLB via a Python script. Shipped as a static asset — the frontend never touches nilearn/numpy.

**Pages:**

1. **Upload Page** — drag & drop for video/audio/text. Processing progress indicator.
2. **Visualization Page** — glass brain + timeline + metrics panel
3. **Comparison Page** — two glass brains side-by-side with diff metrics

**Glass Brain Component (React Three Fiber):**
- Semi-transparent brain mesh (glass shader with refraction/reflection)
- Vertices colored by activation intensity (cold blue → hot orange/white)
- Smooth rotation, zoom, pan via drei OrbitControls
- Raycasting for hover detection → tooltip with region name + score + interpretation

**Neural Pathways Component:**
- Top 10-20 most active regions rendered as glowing sphere nodes inside the brain
- Particle streams between co-activated regions (using drei/three.js Points or custom shader)
- Node size proportional to activation intensity
- Particles flow along paths, speed reflects activation strength

**Timeline Component:**
- Horizontal scrubber bar
- Colored segments showing overall activation intensity over time
- Draggable playhead — brain updates in real-time as you scrub
- Play/pause to animate through the full timeline

**Metrics Panel:**
- 6 gauge/bar visualizations for the business scores
- Update as timeline scrubs
- Sparkline showing each score over time

**Comparison View:**
- Two glass brains side-by-side
- Synced timelines
- Delta metrics panel ("Content A: +23% more emotional response")

### Mesh Export (one-time script)

Python script that:
1. Loads fsaverage5 mesh via nilearn
2. Gets HCP atlas labels per vertex via `get_hcp_vertex_labels()`
3. Exports as GLB with vertex attributes (position, normal, region_id)
4. Generates a JSON mapping: region_id → region_name → business_category

## Tech Stack

- **Backend:** Python 3.11, FastAPI, TRIBE v2 (existing install at /Users/aponce/projects/tribev2)
- **Frontend:** React 18, TypeScript, Vite, Tailwind v4, React Three Fiber, drei
- **No database** — JSON files on disk
- **No auth** — prototype

## Non-Goals (for prototype)

- User accounts / auth
- Persistent storage / database
- Demographic persona modeling
- Real-time video streaming analysis
- Mobile responsiveness
- Production deployment

## License Note

TRIBE v2 is CC-BY-NC-4.0 (non-commercial). This prototype is for concept validation only. Commercial deployment requires either a Meta license agreement or training an independent model.
