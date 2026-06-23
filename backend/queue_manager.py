"""
Simple in-memory job queue with a single background worker thread.
Workers call the model manager; jobs track status + progress.
"""
import queue
import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional


@dataclass
class Job:
    job_id: str
    prompt: str
    duration: float
    fps: int
    resolution: int
    seed: Optional[int]
    status: str = "queued"       # queued | processing | completed | failed
    progress: float = 0.0
    video_url: Optional[str] = None
    error: Optional[str] = None
    settings_adjusted: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


class JobQueue:
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._queue: queue.Queue = queue.Queue()
        self._worker = threading.Thread(target=self._run_worker, daemon=True)
        self._worker.start()

    def submit(self, job: Job) -> None:
        self._jobs[job.job_id] = job
        self._queue.put(job.job_id)

    def get(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def _run_worker(self) -> None:
        from models.model_manager import generate_video

        while True:
            job_id = self._queue.get()
            job = self._jobs.get(job_id)
            if job is None:
                self._queue.task_done()
                continue

            job.status = "processing"
            job.progress = 0.0

            def progress_cb(step: int, total: int) -> None:
                job.progress = round((step / total) * 100, 1)

            try:
                video_url, settings_note = generate_video(
                    prompt=job.prompt,
                    duration=job.duration,
                    fps=job.fps,
                    resolution=job.resolution,
                    seed=job.seed,
                    job_id=job_id,
                    progress_callback=progress_cb,
                )
                job.video_url = video_url
                job.settings_adjusted = settings_note
                job.status = "completed"
                job.progress = 100.0
            except Exception as exc:
                job.status = "failed"
                job.error = str(exc)
            finally:
                self._queue.task_done()


job_queue = JobQueue()
