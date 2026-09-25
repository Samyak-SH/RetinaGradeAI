"""Checkpoint loading and raw forward passes."""

import os
import threading

import numpy as np
import torch
import segmentation_models_pytorch as smp

from .config import CKPT, KEEP_MODELS_LOADED, PATCH, SIZE, WEIGHTS_DIR

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

_cache = {}
_lock = threading.Lock()


def checkpoint_path(key):
    return os.path.join(WEIGHTS_DIR, CKPT[key])


def has_checkpoint(key):
    return os.path.exists(checkpoint_path(key))


def missing_checkpoints():
    return [key for key in ("MA", "HE", "EX", "SE") if not has_checkpoint(key)]


def _build(path):
    model = smp.UnetPlusPlus(
        "timm-efficientnet-b5", encoder_weights=None, in_channels=3, classes=1
    ).to(DEVICE)
    model.load_state_dict(torch.load(path, map_location=DEVICE, weights_only=False))
    model.eval()
    return model


def get_model(key):
    """Return the model for a class, caching it unless RAM is constrained."""
    if not KEEP_MODELS_LOADED:
        return _build(checkpoint_path(key))

    with _lock:
        if key not in _cache:
            _cache[key] = _build(checkpoint_path(key))
        return _cache[key]


def release(model, key):
    """Drop a model when caching is disabled; a no-op otherwise."""
    if not KEEP_MODELS_LOADED:
        del model
        if DEVICE == "cuda":
            torch.cuda.empty_cache()


@torch.no_grad()
def predict_whole(model, img):
    """Sigmoid probability map for a whole 1024x1024 image."""
    t = torch.from_numpy(img).permute(2, 0, 1).float().unsqueeze(0).to(DEVICE) / 255.0
    return torch.sigmoid(model(t))[0, 0].cpu().numpy()


def _pad(a, height, width):
    ph, pw = max(0, height - a.shape[0]), max(0, width - a.shape[1])
    if a.ndim == 3:
        return np.pad(a, ((0, ph), (0, pw), (0, 0)))
    return np.pad(a, ((0, ph), (0, pw)))


@torch.no_grad()
def predict_tiled(model, img):
    """Probability map at native resolution, stitched from 1024px tiles.

    Used for microaneurysms, which are small enough that downscaling the whole
    fundus to 1024 loses them.
    """
    h, w = img.shape[:2]
    padded_h = ((h + PATCH - 1) // PATCH) * PATCH
    padded_w = ((w + PATCH - 1) // PATCH) * PATCH
    padded = _pad(img, padded_h, padded_w)
    out = np.zeros((h, w), np.float32)

    for y in range(0, padded.shape[0], PATCH):
        for x in range(0, padded.shape[1], PATCH):
            tile = padded[y : y + PATCH, x : x + PATCH]
            t = torch.from_numpy(tile).permute(2, 0, 1).float().unsqueeze(0).to(DEVICE) / 255.0
            prob = torch.sigmoid(model(t))[0, 0].cpu().numpy()
            y_end, x_end = min(y + PATCH, h), min(x + PATCH, w)
            out[y:y_end, x:x_end] = prob[: y_end - y, : x_end - x]

    return out
