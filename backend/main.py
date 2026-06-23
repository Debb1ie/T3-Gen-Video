"""
Gen Vid – FastAPI backend
Endpoints:
  POST /generate-video     → submit a generation job
  GET  /status/{job_id}    → poll job progress
  GET  /videos/{filename}  → serve generated video (static)
  GET  /gallery            → list all generated videos
  GET  /gpu-info           → GPU status
  GET  /health             → health check
"""
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator

from queue_manager import job_queue, Job
from utils.gpu_utils import get_gpu_info

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent.parent
OUTPUTS_DIR = BASE_DIR / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Gen Vid API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/videos", StaticFiles(directory=str(OUTPUTS_DIR)), name="videos")

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
VALID_FPS = {8, 12, 16, 24}
VALID_RESOLUTIONS = {256, 512, 768}
MAX_DURATION = 15.0
MIN_DURATION = 1.0


class GenerateRequest(BaseModel):
    prompt: str
    duration: float = 5.0
    fps: int = 12
    resolution: int = 512
    seed: Optional[int] = None

    @field_validator("duration")
    @classmethod
    def clamp_duration(cls, v: float) -> float:
        return max(MIN_DURATION, min(v, MAX_DURATION))

    @field_validator("fps")
    @classmethod
    def validate_fps(cls, v: int) -> int:
        if v not in VALID_FPS:
            return 12
        return v

    @field_validator("resolution")
    @classmethod
    def validate_resolution(cls, v: int) -> int:
        if v not in VALID_RESOLUTIONS:
            return 512
        return v

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Prompt cannot be empty")
        return v


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup() -> None:
    info = get_gpu_info()
    if info["has_gpu"]:
        print(f"[GPU] {info['gpu_name']} | {info['vram_gb']} GB VRAM | CUDA {info['cuda_version']}")
    else:
        print("[WARNING] No GPU detected — generation will be very slow on CPU.")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/gpu-info")
async def gpu_info():
    return get_gpu_info()


@app.post("/generate-video", status_code=202)
async def generate_video(req: GenerateRequest):
    # Double-enforce the 15-second maximum at the HTTP layer
    if req.duration > MAX_DURATION:
        req.duration = MAX_DURATION

    job_id = str(uuid.uuid4())
    job = Job(
        job_id=job_id,
        prompt=req.prompt,
        duration=req.duration,
        fps=req.fps,
        resolution=req.resolution,
        seed=req.seed,
    )
    job_queue.submit(job)

    return {
        "job_id": job_id,
        "status": "queued",
        "capped_duration": req.duration,
    }


@app.get("/status/{job_id}")
async def get_status(job_id: str):
    job = job_queue.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job_id,
        "status": job.status,
        "progress": job.progress,
        "video_url": job.video_url,
        "error": job.error,
        "settings_adjusted": job.settings_adjusted,
        "created_at": job.created_at,
    }


@app.get("/gallery")
async def gallery():
    videos = []
    for f in sorted(OUTPUTS_DIR.glob("*.mp4"), key=lambda x: x.stat().st_ctime, reverse=True):
        stat = f.stat()
        videos.append({
            "filename": f.name,
            "url": f"/videos/{f.name}",
            "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "size_bytes": stat.st_size,
        })
    return {"videos": videos, "count": len(videos)}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
