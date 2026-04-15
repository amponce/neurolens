# NeuroLens

**Map how the brain responds to your content.**

NeuroLens takes video, audio, or text and produces an interactive 3D glass brain visualization showing predicted neural activation patterns. Upload content, see which brain regions light up, scrub through the timeline, and compare two pieces of content side-by-side.

Built on [TRIBE v2](https://github.com/facebookresearch/tribev2) (Meta Research) — a foundation model that predicts fMRI brain responses to naturalistic stimuli.

---

## What it does

1. Upload a video, audio file, or text
2. TRIBE v2 predicts brain activation across ~20,000 cortical points
3. Interactive 3D glass brain visualizes the response in real-time
4. Six business metrics: Visual Attention, Audio Engagement, Emotional Response, Memorability, Language Processing, Cognitive Load
5. Compare two pieces of content side-by-side

## Architecture

```
Frontend (React + React Three Fiber)  ←→  Backend (FastAPI + TRIBE v2)
  - Glass brain 3D viewer                   - Wraps TribeModel.predict()
  - Neural pathway particles                - WhisperX speech-to-text
  - Timeline scrubber                       - HCP atlas ROI aggregation
  - Metrics panel                           - Business score interpretation
  - Comparison mode
```

## Performance expectations

| | NVIDIA GPU (RTX 3060+) | Apple Silicon (M-series) | Intel/AMD CPU |
|---|---|---|---|
| 30s audio clip | ~20-30 sec | ~3-5 min | ~8-15 min |
| 2 min video | ~1-2 min | ~8-15 min | Not practical |
| Text (paragraph) | ~15-20 sec | ~2-3 min | ~5-8 min |

**GPU is strongly recommended.** WhisperX (speech-to-text) and TRIBE v2 feature extraction are the bottlenecks.

---

## Setup: NVIDIA GPU PC (Windows/Linux)

### Prerequisites

- Python 3.11+
- Node.js 20+
- NVIDIA GPU with CUDA support (RTX 3060 or better recommended)
- CUDA Toolkit 12.x installed ([download](https://developer.nvidia.com/cuda-downloads))
- Git
- FFmpeg (`sudo apt install ffmpeg` on Linux, or [download](https://ffmpeg.org/download.html) on Windows)

### Step 1: Clone repos

```bash
git clone https://github.com/amponce/neurolens.git
git clone https://github.com/facebookresearch/tribev2.git
```

### Step 2: Set up TRIBE v2

```bash
cd tribev2
python -m venv .venv

# Linux/Mac
source .venv/bin/activate

# Windows
.venv\Scripts\activate

pip install --upgrade pip
pip install -e ".[plotting]"
pip install fastapi uvicorn python-multipart pytest
python -m spacy download en_core_web_sm
```

Verify CUDA is available:

```bash
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}, Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"CPU\"}')"
```

You should see `CUDA: True` and your GPU name.

### Step 3: Export brain mesh (one-time)

```bash
cd ../neurolens
PYTHONPATH=../tribev2 ../tribev2/.venv/bin/python scripts/export_mesh.py
```

This creates `frontend/public/brain-mesh.json` and `frontend/public/brain-regions.json`. Takes ~30 seconds on first run (downloads MNE sample data).

### Step 4: Set up frontend

```bash
cd frontend
npm install
cd ..
```

### Step 5: Run

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd neurolens

# Linux
PYTHONPATH=../tribev2:. ../tribev2/.venv/bin/python -m uvicorn backend.main:app --port 8000

# Windows (PowerShell)
$env:PYTHONPATH = "..\tribev2;."
..\tribev2\.venv\Scripts\python -m uvicorn backend.main:app --port 8000
```

Wait for "TRIBE v2 model loaded" in the logs (~30 sec, downloads model on first run).

**Terminal 2 — Frontend:**
```bash
cd neurolens/frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Setup: MacBook Pro M5 (Apple Silicon)

### Prerequisites

- Python 3.11+ (comes with macOS or install via `brew install python@3.11`)
- Node.js 20+ (`brew install node`)
- Git
- FFmpeg (`brew install ffmpeg`)

### Step 1: Clone repos

```bash
cd ~/projects  # or wherever you keep repos
git clone https://github.com/amponce/neurolens.git
git clone https://github.com/facebookresearch/tribev2.git
```

### Step 2: Set up TRIBE v2

```bash
cd tribev2
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e ".[plotting]"
pip install fastapi uvicorn python-multipart pytest
python -m spacy download en_core_web_sm
```

### Step 3: Patch TRIBE v2 for CPU

TRIBE v2 ships with CUDA defaults. Apply this one-line fix:

```bash
# Fix WhisperX compute type for CPU
sed -i '' 's/compute_type = "float16"/compute_type = "float16" if device == "cuda" else "int8"/' tribev2/eventstransforms.py
```

Verify:

```bash
grep "compute_type" tribev2/eventstransforms.py
```

Should show: `compute_type = "float16" if device == "cuda" else "int8"`

### Step 4: Export brain mesh (one-time)

```bash
cd ../neurolens
PYTHONPATH=../tribev2 ../tribev2/.venv/bin/python scripts/export_mesh.py
```

First run downloads ~1.6 GB of MNE sample data and HCP atlas. Takes 2-5 minutes.

### Step 5: Set up frontend

```bash
cd frontend
npm install
cd ..
```

### Step 6: Run

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd ~/projects/neurolens
PYTHONPATH=../tribev2:. ../tribev2/.venv/bin/python -m uvicorn backend.main:app --port 8000
```

Wait for "TRIBE v2 model loaded" (~30 sec). First analysis downloads WhisperX model (~3 GB, one-time).

**Terminal 2 — Frontend:**
```bash
cd ~/projects/neurolens/frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

### Apple Silicon notes

- Processing is CPU-only (PyTorch MPS is not used by TRIBE v2's dependencies)
- First analysis takes longer due to model downloads (WhisperX, alignment models)
- Short clips (<30s) recommended for reasonable wait times
- Text input is fastest (no video/audio feature extraction)

---

## Usage

### Single analysis

1. Open http://localhost:5173
2. Drop a video (.mp4), audio (.mp3, .wav), or text (.txt) file
3. Wait for processing (see performance table above)
4. Explore the 3D glass brain — rotate, zoom, hover regions
5. Scrub the timeline to see activation change over time
6. Check the metrics panel for engagement scores

### Compare mode

1. Click "or compare two files" on the home page
2. Upload Content A and Content B
3. View side-by-side brain activations
4. Delta metrics show which content performs better per metric

## Project structure

```
neurolens/
  backend/
    main.py          # FastAPI app (3 endpoints)
    analyze.py       # TRIBE v2 wrapper
    interpret.py     # ROI → business scores
    schemas.py       # Pydantic response models
  frontend/
    src/
      components/    # GlassBrain, NeuralPathways, Timeline, MetricsPanel
      pages/         # UploadPage, VisualizePage, ComparePage
      hooks/         # useAnalysis, useBrainMesh, useTimeline
    public/
      brain-mesh.json     # Pre-exported fsaverage5 mesh
      brain-regions.json  # HCP atlas region mapping
  scripts/
    export_mesh.py   # One-time mesh export script
  tests/
    test_interpret.py
```

## License

This prototype uses TRIBE v2 which is licensed under **CC-BY-NC-4.0 (non-commercial)**. Commercial deployment requires either a license from Meta or training an independent model on openly licensed fMRI data.
