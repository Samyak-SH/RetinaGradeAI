"""End-to-end DR lesion inference: image bytes in, structured report out."""

import io
import time

import cv2
import numpy as np
from PIL import Image

from . import models
from .config import (
    CLASSES,
    COLORS,
    LESION_NAMES,
    SIZE,
    THR,
    USE_MA_NATIVE,
)
from .lesions import extract, split_he
from .preprocess import preprocess

MODEL_NAME = "UNet++ / timm-efficientnet-b5 (MA, HE, EX, SE)"


def _to_png_bytes(array):
    buf = io.BytesIO()
    Image.fromarray(array).save(buf, format="PNG")
    return buf.getvalue()


def _overlay(small, masks):
    """Blend each lesion class over the preprocessed image in its own colour."""
    out = small.copy().astype(np.float32)

    # Painted largest-class-first so small lesions stay visible on top.
    for key in ["EX", "SE", "HE-blot", "HE-dot", "MA"]:
        mask = masks[key].astype(bool)
        colour = np.array(COLORS[key], dtype=np.float32)
        out[mask] = 0.45 * out[mask] + 0.55 * colour

    return np.clip(out, 0, 255).astype(np.uint8)


def _summary(counts):
    present = [f"{counts[k]} {LESION_NAMES[k].lower()}" for k in CLASSES if counts[k]]
    if not present:
        return "No diabetic retinopathy lesions were detected in this image."
    return f"Detected {counts['TOTAL']} lesions: " + ", ".join(present) + "."


def run(image_bytes):
    started = time.perf_counter()

    raw = np.array(Image.open(io.BytesIO(image_bytes)).convert("RGB"))
    small, native = preprocess(raw)

    masks = {}
    probs = {}

    # --- microaneurysms ------------------------------------------------------
    use_native = USE_MA_NATIVE and models.has_checkpoint("MA_native")
    ma_key = "MA_native" if use_native else "MA"
    model = models.get_model(ma_key)

    if use_native:
        prob_native = models.predict_tiled(model, native)
        # Threshold at native resolution, then downsample the mask, matching
        # infer_image.py exactly. The probability map is resized separately and
        # used only to score each lesion.
        masks["MA"] = cv2.resize(
            (prob_native > THR["MA"]).astype(np.uint8), (SIZE, SIZE), interpolation=cv2.INTER_NEAREST
        )
        probs["MA"] = cv2.resize(prob_native, (SIZE, SIZE), interpolation=cv2.INTER_LINEAR)
    else:
        probs["MA"] = models.predict_whole(model, small)
        masks["MA"] = (probs["MA"] > THR["MA"]).astype(np.uint8)

    models.release(model, ma_key)

    # --- hemorrhages ---------------------------------------------------------
    model = models.get_model("HE")
    he_prob = models.predict_whole(model, small)
    models.release(model, "HE")

    he_mask = (he_prob > THR["HE"]).astype(np.uint8)
    masks["HE-dot"], masks["HE-blot"] = split_he(he_mask)
    probs["HE-dot"] = probs["HE-blot"] = he_prob

    # --- exudates ------------------------------------------------------------
    for key in ("EX", "SE"):
        model = models.get_model(key)
        probs[key] = models.predict_whole(model, small)
        models.release(model, key)
        masks[key] = (probs[key] > THR[key]).astype(np.uint8)

    # --- per-lesion records --------------------------------------------------
    lesions = []
    counts = {}

    for key in CLASSES:
        found = extract(masks[key], probs[key], key)
        counts[key] = len(found)
        lesions.extend(found)

    counts["TOTAL"] = sum(counts[k] for k in CLASSES)
    lesions.sort(key=lambda l: l["area_px"], reverse=True)

    return {
        "model_name": MODEL_NAME,
        "device": models.DEVICE,
        "ma_path": "native tiled" if use_native else "whole-image",
        "inference_ms": round((time.perf_counter() - started) * 1000, 1),
        "image": {"width": SIZE, "height": SIZE},
        "counts": counts,
        "lesion_names": LESION_NAMES,
        "colors": {k: "#%02x%02x%02x" % COLORS[k] for k in CLASSES},
        "lesions": lesions,
        "summary": _summary(counts),
        "preprocessed_png": _to_png_bytes(small),
        "overlay_png": _to_png_bytes(_overlay(small, masks)),
    }
