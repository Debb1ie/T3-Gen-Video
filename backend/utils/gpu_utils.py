import torch
from typing import Dict, Any


def get_vram_gb() -> float:
    if not torch.cuda.is_available():
        return 0.0
    props = torch.cuda.get_device_properties(0)
    return props.total_memory / (1024 ** 3)


def get_free_vram_gb() -> float:
    if not torch.cuda.is_available():
        return 0.0
    free, _ = torch.cuda.mem_get_info(0)
    return free / (1024 ** 3)


def get_gpu_info() -> Dict[str, Any]:
    if not torch.cuda.is_available():
        return {
            "has_gpu": False,
            "device": "cpu",
            "vram_gb": 0.0,
            "free_vram_gb": 0.0,
            "gpu_name": "CPU only (No CUDA GPU detected)",
            "cuda_version": None,
            "warning": "No GPU detected. Generation will be extremely slow on CPU.",
        }

    props = torch.cuda.get_device_properties(0)
    vram_gb = props.total_memory / (1024 ** 3)
    free_gb = get_free_vram_gb()

    return {
        "has_gpu": True,
        "device": "cuda",
        "vram_gb": round(vram_gb, 2),
        "free_vram_gb": round(free_gb, 2),
        "gpu_name": props.name,
        "cuda_version": torch.version.cuda,
        "warning": None,
    }


def select_model_and_resolution(
    requested_resolution: int,
    vram_gb: float,
) -> tuple[str, int]:
    """Return (model_type, adjusted_resolution) based on available VRAM."""
    if vram_gb >= 8:
        # Enough for Wan2.1-1.3B at 512p; try it
        return "wan", min(requested_resolution, 512)
    elif vram_gb >= 4:
        # Use LTX-Video with capped resolution
        return "ltx", min(requested_resolution, 512)
    else:
        # Very low VRAM or CPU — LTX at 256p
        return "ltx", 256
