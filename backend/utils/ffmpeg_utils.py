import subprocess
import shutil
import tempfile
import os
from pathlib import Path
from typing import List, Union
import numpy as np
from PIL import Image


def check_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def frames_to_mp4(
    frames: List[Union[Image.Image, np.ndarray]],
    output_path: str,
    fps: int = 12,
) -> None:
    """Convert a list of PIL Images or numpy arrays to an MP4 file via FFmpeg."""
    if not check_ffmpeg():
        raise RuntimeError(
            "FFmpeg not found. Install FFmpeg and add it to your PATH. "
            "Download from https://ffmpeg.org/download.html"
        )

    with tempfile.TemporaryDirectory() as tmp:
        for i, frame in enumerate(frames):
            if isinstance(frame, np.ndarray):
                img = Image.fromarray(frame.astype(np.uint8))
            else:
                img = frame
            # Ensure dimensions are even (required by libx264)
            w, h = img.size
            if w % 2 != 0:
                w -= 1
            if h % 2 != 0:
                h -= 1
            img = img.resize((w, h), Image.LANCZOS)
            img.save(os.path.join(tmp, f"frame_{i:05d}.png"))

        cmd = [
            "ffmpeg",
            "-y",
            "-framerate", str(fps),
            "-i", os.path.join(tmp, "frame_%05d.png"),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", "23",
            "-preset", "fast",
            "-movflags", "+faststart",
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg error:\n{result.stderr}")
