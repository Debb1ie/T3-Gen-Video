"""
Wan2.1-T2V-1.3B model loader and inference wrapper.
Requires ~8 GB VRAM. Uses attention slicing + CPU offload when < 10 GB VRAM.
"""
import torch
from typing import Callable, List, Optional
from PIL import Image


# Wan2.1 works best with these specific resolutions
WAN_RESOLUTIONS = {
    256: (480, 480),
    512: (480, 480),
    768: (624, 624),
}


def _adjust_num_frames_wan(num_frames: int) -> int:
    """Wan2.1 requires (num_frames - 1) % 4 == 0, min 5."""
    if num_frames < 5:
        return 5
    remainder = (num_frames - 1) % 4
    if remainder == 0:
        return num_frames
    return num_frames + (4 - remainder)


def load_wan_model():
    from diffusers import WanPipeline
    from utils.gpu_utils import get_vram_gb

    model_id = "Wan-AI/Wan2.1-T2V-1.3B"
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32

    print(f"[Wan2.1] Loading model {model_id} on {device} ({dtype})...")

    pipe = WanPipeline.from_pretrained(model_id, torch_dtype=dtype)

    if device == "cuda":
        vram = get_vram_gb()
        if vram < 10:
            print("[Wan2.1] Low VRAM: enabling attention slicing + CPU offload")
            pipe.enable_attention_slicing()
            pipe.enable_model_cpu_offload()
        else:
            pipe = pipe.to(device)
    else:
        pipe = pipe.to(device)

    print("[Wan2.1] Model loaded.")
    return pipe


def generate_with_wan(
    model,
    prompt: str,
    num_frames: int,
    fps: int,
    resolution: int,
    seed: int,
    progress_callback: Callable[[int, int], None],
) -> List[Image.Image]:
    num_frames = _adjust_num_frames_wan(num_frames)
    height, width = WAN_RESOLUTIONS.get(resolution, (480, 480))

    generator = torch.Generator(
        device="cuda" if torch.cuda.is_available() else "cpu"
    ).manual_seed(seed)

    total_steps = 50
    step_counter = [0]

    def _cb(pipe, step: int, timestep, cb_kwargs: dict) -> dict:
        step_counter[0] = step + 1
        progress_callback(step_counter[0], total_steps)
        return cb_kwargs

    output = model(
        prompt=prompt,
        num_frames=num_frames,
        height=height,
        width=width,
        num_inference_steps=total_steps,
        guidance_scale=5.0,
        generator=generator,
        callback_on_step_end=_cb,
        callback_on_step_end_tensor_inputs=["latents"],
    )
    return output.frames[0]
