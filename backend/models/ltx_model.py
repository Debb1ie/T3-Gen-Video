"""
LTX-Video model loader and inference wrapper.
Lighter fallback (~4–6 GB VRAM). Uses bfloat16 on CUDA.
"""
import torch
from typing import Callable, List
from PIL import Image


# LTX-Video supported resolutions (width x height)
LTX_RESOLUTIONS = {
    256: (256, 256),
    512: (512, 512),
    768: (768, 512),
}


def _adjust_num_frames_ltx(num_frames: int) -> int:
    """LTX-Video requires (num_frames - 1) % 8 == 0, minimum 9."""
    if num_frames < 9:
        return 9
    remainder = (num_frames - 1) % 8
    if remainder == 0:
        return num_frames
    return num_frames + (8 - remainder)


def load_ltx_model():
    from diffusers import LtxVideoPipeline
    from utils.gpu_utils import get_vram_gb

    model_id = "Lightricks/LTX-Video"
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.bfloat16 if device == "cuda" else torch.float32

    print(f"[LTX-Video] Loading model {model_id} on {device} ({dtype})...")

    pipe = LtxVideoPipeline.from_pretrained(model_id, torch_dtype=dtype)

    if device == "cuda":
        vram = get_vram_gb()
        if vram < 8:
            print("[LTX-Video] Low VRAM: enabling attention slicing + CPU offload")
            pipe.enable_attention_slicing()
            pipe.enable_model_cpu_offload()
        else:
            pipe = pipe.to(device)
    else:
        pipe = pipe.to(device)

    print("[LTX-Video] Model loaded.")
    return pipe


def generate_with_ltx(
    model,
    prompt: str,
    num_frames: int,
    fps: int,
    resolution: int,
    seed: int,
    progress_callback: Callable[[int, int], None],
) -> List[Image.Image]:
    num_frames = _adjust_num_frames_ltx(num_frames)
    width, height = LTX_RESOLUTIONS.get(resolution, (512, 512))

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
        guidance_scale=3.0,
        generator=generator,
        callback_on_step_end=_cb,
        callback_on_step_end_tensor_inputs=["latents"],
    )
    return output.frames[0]
