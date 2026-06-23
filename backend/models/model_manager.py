"""
Manages AI model loading with automatic fallback:
  Wan2.1-1.3B (primary, >=8GB VRAM) → LTX-Video (fallback, >=4GB VRAM)
"""
import time
import random
from pathlib import Path
from typing import Callable, Optional, Tuple

BASE_DIR = Path(__file__).parent.parent.parent
OUTPUTS_DIR = BASE_DIR / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

_loaded_model = None
_loaded_model_type: Optional[str] = None


def _get_or_load_model(model_type: str):
    global _loaded_model, _loaded_model_type

    if _loaded_model is not None and _loaded_model_type == model_type:
        return _loaded_model

    # Unload previous model to free memory
    if _loaded_model is not None:
        import torch, gc
        del _loaded_model
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    if model_type == "wan":
        from models.wan_model import load_wan_model
        _loaded_model = load_wan_model()
    else:
        from models.ltx_model import load_ltx_model
        _loaded_model = load_ltx_model()

    _loaded_model_type = model_type
    return _loaded_model


def generate_video(
    prompt: str,
    duration: float,
    fps: int,
    resolution: int,
    seed: Optional[int],
    job_id: str,
    progress_callback: Callable[[int, int], None],
) -> Tuple[str, Optional[str]]:
    # Hard-enforce 15s max on the backend
    duration = min(max(duration, 1.0), 15.0)

    from utils.gpu_utils import get_gpu_info, select_model_and_resolution
    from utils.ffmpeg_utils import frames_to_mp4

    gpu = get_gpu_info()
    vram_gb = gpu["vram_gb"]

    actual_seed = seed if seed is not None else random.randint(0, 2**31 - 1)
    settings_note: Optional[str] = None

    model_type, actual_resolution = select_model_and_resolution(resolution, vram_gb)

    if actual_resolution != resolution:
        settings_note = (
            f"Resolution auto-adjusted from {resolution}p to {actual_resolution}p "
            f"(available VRAM: {vram_gb:.1f} GB)"
        )

    # Try primary model, fall back on OOM
    try:
        model = _get_or_load_model(model_type)
    except Exception as e:
        fallback = "ltx" if model_type == "wan" else "wan"
        print(f"[ModelManager] {model_type} failed ({e}), trying {fallback}")
        try:
            model = _get_or_load_model(fallback)
            model_type = fallback
            settings_note = f"Auto-switched to {'LTX-Video' if fallback == 'ltx' else 'Wan2.1'} due to model load error."
        except Exception as e2:
            raise RuntimeError(f"Both models failed to load: {e2}") from e2

    num_frames = int(duration * fps)

    try:
        if model_type == "wan":
            from models.wan_model import generate_with_wan
            frames = generate_with_wan(
                model=model,
                prompt=prompt,
                num_frames=num_frames,
                fps=fps,
                resolution=actual_resolution,
                seed=actual_seed,
                progress_callback=progress_callback,
            )
        else:
            from models.ltx_model import generate_with_ltx
            frames = generate_with_ltx(
                model=model,
                prompt=prompt,
                num_frames=num_frames,
                fps=fps,
                resolution=actual_resolution,
                seed=actual_seed,
                progress_callback=progress_callback,
            )
    except RuntimeError as oom_err:
        # Catch CUDA OOM and retry with LTX at lower res
        if "out of memory" in str(oom_err).lower() and model_type == "wan":
            import torch, gc
            gc.collect()
            torch.cuda.empty_cache()
            print("[ModelManager] CUDA OOM — falling back to LTX-Video at 256p")
            model = _get_or_load_model("ltx")
            model_type = "ltx"
            actual_resolution = 256
            settings_note = "Switched to LTX-Video at 256p due to insufficient VRAM."
            from models.ltx_model import generate_with_ltx
            frames = generate_with_ltx(
                model=model,
                prompt=prompt,
                num_frames=num_frames,
                fps=fps,
                resolution=actual_resolution,
                seed=actual_seed,
                progress_callback=progress_callback,
            )
        else:
            raise

    timestamp = int(time.time())
    filename = f"video_{timestamp}_{actual_seed}.mp4"
    output_path = OUTPUTS_DIR / filename

    frames_to_mp4(frames, str(output_path), fps=fps)

    video_url = f"/videos/{filename}"
    return video_url, settings_note
