#!/usr/bin/env python3
"""Run a reproducible shape-only Hunyuan3D-2mv benchmark."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from PIL import Image


MODEL_REPOSITORY = "tencent/Hunyuan3D-2mv"
MODEL_REVISION = "3a761b539b29fe4ff64714813aa9560fd66f5de0"
MODEL_SUBFOLDER = "hunyuan3d-dit-v2-mv"
WEIGHT_FILENAME = "model.fp16.safetensors"
EXPECTED_WEIGHT_SIZE = 4_928_151_562


@dataclass(frozen=True)
class BenchmarkSettings:
    """Serializable shape-generation settings."""

    seed: int
    steps: int
    octree_resolution: int
    chunks: int
    guidance_scale: float
    cpu_offload: bool


def _parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--front", required=True, type=Path)
    parser.add_argument("--left", required=True, type=Path)
    parser.add_argument("--model-root", required=True, type=Path)
    parser.add_argument("--hunyuan-root", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--seed", type=int, default=12345)
    parser.add_argument("--steps", type=int, default=30)
    parser.add_argument("--octree-resolution", type=int, default=256)
    parser.add_argument("--chunks", type=int, default=8000)
    parser.add_argument("--guidance-scale", type=float, default=5.0)
    parser.add_argument("--cpu-offload", action="store_true")
    return parser.parse_args()


def _sha256(path: Path) -> str:
    """Return a streaming SHA-256 digest for a potentially large file."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _validate_settings(settings: BenchmarkSettings) -> None:
    """Reject invalid or unexpectedly expensive benchmark settings."""
    if settings.steps < 1:
        raise ValueError("steps must be positive")
    if not 64 <= settings.octree_resolution <= 512:
        raise ValueError("octree resolution must be between 64 and 512")
    if settings.chunks < 1:
        raise ValueError("chunks must be positive")
    if settings.guidance_scale < 0.0:
        raise ValueError("guidance scale must be non-negative")


def _validate_rgba(path: Path, view_name: str) -> Image.Image:
    """Load a prepared view and ensure it contains useful transparency."""
    if not path.is_file():
        raise FileNotFoundError(f"{view_name} image does not exist: {path}")
    with Image.open(path) as source:
        image = source.convert("RGBA")
    alpha = image.getchannel("A")
    minimum, maximum = alpha.getextrema()
    if minimum == maximum:
        raise ValueError(
            f"{view_name} image must have a non-uniform alpha mask"
        )
    return image


def _model_paths(model_root: Path) -> tuple[Path, Path]:
    """Return and validate the local safe model files."""
    model_dir = model_root / MODEL_REPOSITORY / MODEL_SUBFOLDER
    config_path = model_dir / "config.yaml"
    weight_path = model_dir / WEIGHT_FILENAME
    if not config_path.is_file():
        raise FileNotFoundError(f"model config does not exist: {config_path}")
    if not weight_path.is_file():
        raise FileNotFoundError(
            f"safe model weights do not exist: {weight_path}"
        )
    weight_size = weight_path.stat().st_size
    if weight_size != EXPECTED_WEIGHT_SIZE:
        raise ValueError(
            "safe model weights have an unexpected size: "
            f"{weight_size} != {EXPECTED_WEIGHT_SIZE}"
        )
    return config_path, weight_path


def _git_revision(repository: Path) -> str:
    """Read the checked-out official Hunyuan source revision."""
    result = subprocess.run(
        ["git", "-C", str(repository), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def _package_versions(names: tuple[str, ...]) -> dict[str, str]:
    """Return installed package versions for reproduction metadata."""
    versions: dict[str, str] = {}
    for name in names:
        try:
            versions[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            versions[name] = "not-installed"
    return versions


def _write_metadata(path: Path, metadata: dict[str, Any]) -> None:
    """Write UTF-8 benchmark metadata atomically enough for this local CLI."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def _enable_cpu_offload(pipeline: Any) -> None:
    """Bridge the pinned Hunyuan pipeline to its Diffusers-style offloader.

    The pinned upstream class implements ``enable_model_cpu_offload`` but does
    not expose the ``components`` mapping that its own method reads.  Populate
    only that missing contract locally so the 6 GB development GPU can run the
    model without modifying the vendored Hunyuan checkout.
    """
    if not hasattr(pipeline, "components"):
        pipeline.components = {
            "conditioner": pipeline.conditioner,
            "model": pipeline.model,
            "vae": pipeline.vae,
        }
    pipeline.enable_model_cpu_offload(device="cuda")
    # Upstream __call__ reads ``self.device`` directly (instead of the
    # offload hook's execution device). Keep tensors on CUDA while hooks move
    # each model component between CPU and GPU.
    import torch
    pipeline.device = torch.device("cuda")


def run(args: argparse.Namespace) -> dict[str, Any]:
    """Load Hunyuan3D-2mv, generate one mesh, and record diagnostics."""
    settings = BenchmarkSettings(
        seed=args.seed,
        steps=args.steps,
        octree_resolution=args.octree_resolution,
        chunks=args.chunks,
        guidance_scale=args.guidance_scale,
        cpu_offload=args.cpu_offload,
    )
    _validate_settings(settings)
    hunyuan_root = args.hunyuan_root.resolve()
    if not (hunyuan_root / "hy3dgen").is_dir():
        raise FileNotFoundError(
            f"official Hunyuan source is missing: {hunyuan_root}"
        )
    config_path, weight_path = _model_paths(args.model_root.resolve())
    images = {
        "front": _validate_rgba(args.front, "front"),
        "left": _validate_rgba(args.left, "left"),
    }

    sys.path.insert(0, str(hunyuan_root))
    os.environ["HY3DGEN_MODELS"] = str(args.model_root.resolve())
    import torch
    import trimesh
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is required for this benchmark")

    output_dir = args.out_dir.resolve()
    raw_path = output_dir / "raw" / "model.glb"
    metadata_path = output_dir / "metadata.json"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    input_paths = {
        "front": args.front.resolve(),
        "left": args.left.resolve(),
    }
    metadata: dict[str, Any] = {
        "status": "running",
        "model": {
            "repository": MODEL_REPOSITORY,
            "revision": MODEL_REVISION,
            "subfolder": MODEL_SUBFOLDER,
            "weight_filename": WEIGHT_FILENAME,
            "weight_size": weight_path.stat().st_size,
            "weight_sha256": _sha256(weight_path),
            "config_path": str(config_path),
        },
        "source": {
            "repository": str(hunyuan_root),
            "revision": _git_revision(hunyuan_root),
        },
        "settings": asdict(settings),
        "inputs": {
            name: {
                "path": str(path),
                "sha256": _sha256(path),
            }
            for name, path in input_paths.items()
        },
        "environment": {
            "python": sys.version,
            "packages": _package_versions(
                (
                    "torch",
                    "torchvision",
                    "diffusers",
                    "transformers",
                    "accelerate",
                    "safetensors",
                    "trimesh",
                )
            ),
            "gpu": torch.cuda.get_device_name(0),
            "cuda_runtime": torch.version.cuda,
        },
    }
    _write_metadata(metadata_path, metadata)

    started = time.perf_counter()
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()
    try:
        initial_device = "cpu" if settings.cpu_offload else "cuda"
        pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            MODEL_REPOSITORY,
            subfolder=MODEL_SUBFOLDER,
            variant="fp16",
            use_safetensors=True,
            device=initial_device,
            dtype=torch.float16,
        )
        if settings.cpu_offload:
            _enable_cpu_offload(pipeline)
        generator = torch.Generator(device="cpu").manual_seed(settings.seed)
        generated = pipeline(
            image=images,
            num_inference_steps=settings.steps,
            octree_resolution=settings.octree_resolution,
            num_chunks=settings.chunks,
            guidance_scale=settings.guidance_scale,
            generator=generator,
            output_type="trimesh",
            mc_algo="mc",
        )
        mesh = generated[0]
        if not isinstance(mesh, trimesh.Trimesh):
            raise TypeError(f"unexpected Hunyuan output: {type(mesh)!r}")
        mesh.export(raw_path)
    except torch.cuda.OutOfMemoryError as error:
        metadata["status"] = "cuda_oom"
        metadata["error"] = str(error)
        metadata["runtime_seconds"] = time.perf_counter() - started
        metadata["peak_vram_bytes"] = torch.cuda.max_memory_allocated()
        _write_metadata(metadata_path, metadata)
        raise RuntimeError(
            "Hunyuan benchmark exhausted CUDA memory"
        ) from error

    components = mesh.split(only_watertight=False)
    metadata.update(
        {
            "status": "complete",
            "runtime_seconds": time.perf_counter() - started,
            "peak_vram_bytes": torch.cuda.max_memory_allocated(),
            "peak_reserved_vram_bytes": torch.cuda.max_memory_reserved(),
            "output": {
                "path": str(raw_path),
                "sha256": _sha256(raw_path),
                "vertices": len(mesh.vertices),
                "triangles": len(mesh.faces),
                "components": len(components),
                "watertight": bool(mesh.is_watertight),
                "bounds": mesh.bounds.tolist(),
                "extents": mesh.extents.tolist(),
            },
        }
    )
    _write_metadata(metadata_path, metadata)
    return metadata


def main() -> None:
    """Run the command-line entry point."""
    try:
        metadata = run(_parse_arguments())
    except (
        FileNotFoundError,
        OSError,
        RuntimeError,
        TypeError,
        ValueError,
    ) as error:
        raise SystemExit(f"error: {error}") from error
    print(
        "Hunyuan benchmark complete: "
        f"{metadata['output']['vertices']} vertices, "
        f"{metadata['output']['triangles']} triangles",
        flush=True,
    )


if __name__ == "__main__":
    main()
