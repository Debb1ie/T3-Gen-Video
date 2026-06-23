# Gen Vid — Local AI Video Generator

Generate short videos from text prompts using open-source AI models. Runs **fully offline** after initial model download.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 + React 19 + Tailwind CSS |
| Backend | Python FastAPI + Uvicorn |
| Primary AI | Wan2.1-T2V-1.3B (≥8 GB VRAM) |
| Fallback AI | LTX-Video (≥4 GB VRAM) |
| Video assembly | FFmpeg |
| Inference | PyTorch + Diffusers |

## Requirements

### System

| Requirement | Minimum | Recommended |
|---|---|---|
| OS | Windows 10/11 64-bit | Windows 11 |
| GPU | 8 GB VRAM (NVIDIA) | 12 GB VRAM |
| RAM | 16 GB | 32 GB |
| Storage | 30 GB free (models) | 50 GB |
| Python | 3.10+ | 3.11 |
| Node.js | 18+ | 20 LTS |
| FFmpeg | Required | Required |

> **CPU fallback**: Works without a GPU but video generation will take **hours**, not seconds.

---

## Installation

### Step 1 — Prerequisites

1. **Python 3.10+** → https://python.org/downloads
   - Check "Add Python to PATH" during install
2. **Node.js 20 LTS** → https://nodejs.org
3. **FFmpeg** → https://ffmpeg.org/download.html
   - Download the Windows build, extract it, and add the `bin/` folder to your system PATH
   - Test: open a terminal and run `ffmpeg -version`
4. **CUDA Toolkit** (for NVIDIA GPU) → https://developer.nvidia.com/cuda-downloads
   - Install CUDA 12.1 or 11.8

### Step 2 — Run Setup

Double-click `setup.bat` or run in a terminal:

```bat
setup.bat
```

This will:
- Create a Python virtual environment (`venv/`)
- Install PyTorch with CUDA support
- Install all backend Python packages
- Install all frontend npm packages

> **CUDA version**: The setup script installs PyTorch with CUDA 12.1.
> If you have CUDA 11.8, edit `setup.bat` and change `cu121` → `cu118`.
> For CPU-only, change to `--index-url https://download.pytorch.org/whl/cpu`.

---

## Running the App

Open **two terminal windows**:

**Terminal 1 — Backend:**
```bat
start_backend.bat
```

**Terminal 2 — Frontend:**
```bat
start_frontend.bat
```

Then open **http://localhost:3000** in your browser.

---

## First Run

On the first generation, the AI models will be downloaded automatically from HuggingFace:

| Model | Size | Notes |
|---|---|---|
| Wan2.1-T2V-1.3B | ~6 GB | Primary model |
| LTX-Video | ~5 GB | Auto-used if Wan fails |

Models are cached in `~/.cache/huggingface/hub/` and only downloaded once.

---

## Project Structure

```
Gen Vid/
├── backend/
│   ├── main.py              # FastAPI app + routes
│   ├── queue_manager.py     # In-memory job queue
│   ├── requirements.txt
│   ├── models/
│   │   ├── model_manager.py # Model loading + fallback logic
│   │   ├── wan_model.py     # Wan2.1 pipeline wrapper
│   │   └── ltx_model.py     # LTX-Video pipeline wrapper
│   └── utils/
│       ├── ffmpeg_utils.py  # Frame → MP4 assembly
│       └── gpu_utils.py     # CUDA detection + VRAM info
├── frontend/
│   ├── app/
│   │   ├── layout.tsx       # Root layout + navbar
│   │   ├── page.tsx         # Home (generator)
│   │   └── gallery/
│   │       └── page.tsx     # Gallery page
│   ├── components/
│   │   ├── VideoGenerator.tsx  # Main generator UI
│   │   └── Gallery.tsx         # Video gallery grid
│   ├── lib/
│   │   └── api.ts           # API client functions
│   └── .env.local           # API URL config
├── outputs/                 # Generated MP4 files
├── setup.bat                # One-click setup
├── start_backend.bat        # Start FastAPI server
└── start_frontend.bat       # Start Next.js dev server
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/generate-video` | Submit a generation job |
| `GET` | `/status/{job_id}` | Poll job progress (0–100%) |
| `GET` | `/videos/{filename}` | Serve generated MP4 |
| `GET` | `/gallery` | List all generated videos |
| `GET` | `/gpu-info` | Current GPU status |
| `GET` | `/health` | Health check |

### POST /generate-video

```json
{
  "prompt": "A cat walking in a sunlit garden",
  "duration": 5,
  "fps": 12,
  "resolution": 512,
  "seed": 42
}
```

**Limits enforced by backend:**
- `duration`: 1–15 seconds (hard capped, never exceeds 15s)
- `fps`: 8, 12, 16, or 24
- `resolution`: 256, 512, or 768

---

## Video Duration Limits

| Setting | Value |
|---|---|
| Minimum | 1 second |
| Default | 5 seconds |
| Maximum | **15 seconds** |

Requesting >15 seconds is silently capped to 15s **both in the UI and on the backend**. The UI shows a warning when the cap is applied.

---

## Model Selection Logic

```
VRAM ≥ 8 GB  →  Try Wan2.1-1.3B
               ↓ (if OOM or load error)
VRAM ≥ 4 GB  →  Use LTX-Video
               ↓ (if still failing)
              Error (insufficient VRAM)

Resolution is auto-scaled down if VRAM is insufficient.
```

---

## VRAM Optimizations

Both models use these optimizations automatically when VRAM is limited:
- **Attention slicing** — reduces peak memory by processing attention in chunks
- **CPU offloading** — moves inactive model layers to RAM during inference

---

## Troubleshooting

**"FFmpeg not found"**
→ Install FFmpeg and ensure the `bin/` folder is in your system PATH.

**"CUDA out of memory"**
→ The system automatically retries with LTX-Video at 256p. If it still fails, reduce resolution or close other GPU-heavy applications.

**Models downloading slowly**
→ Normal on first run. HuggingFace downloads can be slow; models are cached for subsequent runs.

**Backend won't start**
→ Make sure the virtual environment is activated: `call venv\Scripts\activate.bat`

**Frontend 404 / can't reach backend**
→ Ensure the backend is running on port 8000. Check `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000`.

---

## License

All components are open-source:
- **Wan2.1**: Apache 2.0
- **LTX-Video**: Apache 2.0  
- **Diffusers**: Apache 2.0
- **FastAPI**: MIT
- **Next.js**: MIT
