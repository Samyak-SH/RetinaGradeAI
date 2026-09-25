"""Runtime configuration for the DR lesion service.

Values mirror infer_image.py so the service reproduces the original results.
"""

import os

WEIGHTS_DIR = os.environ.get("WEIGHTS_PATH", "/app/weights")

CKPT = {
    "MA_native": "MA_native_timm-efficientnet-b5.pt",
    "MA": "MA_timm-efficientnet-b5_best.pt",
    "HE": "HE_timm-efficientnet-b5_best.pt",
    "EX": "EX_timm-efficientnet-b5_best.pt",
    "SE": "SE_timm-efficientnet-b5_best.pt",
}

SIZE = PATCH = 1024
CLAHE_CLIP, CLAHE_TILES = 2.0, (8, 8)

# Per-class sigmoid thresholds.
THR = {"MA": 0.35, "HE": 0.5, "EX": 0.5, "SE": 0.5}

# Connected components larger than this are blot rather than dot hemorrhages.
TAU_HE = 700

# Minimum component area, in pixels, for a blob to count as a lesion. The default
# of 1 keeps every connected component, matching the counts infer_image.py
# reports. Raise it to suppress single-pixel segmentation speckle.
MIN_LESION_AREA = int(os.environ.get("MIN_LESION_AREA", "1"))

# The native-resolution tiled path for MA is accurate but slow on CPU.
USE_MA_NATIVE = os.environ.get("USE_MA_NATIVE", "1") not in ("0", "false", "False")

# Keeping every model resident avoids reloading ~120MB per class on each request,
# at the cost of roughly 600MB of RAM.
KEEP_MODELS_LOADED = os.environ.get("KEEP_MODELS_LOADED", "1") not in ("0", "false", "False")

CLASSES = ["MA", "HE-dot", "HE-blot", "EX", "SE"]

COLORS = {
    "MA": (255, 0, 0),
    "HE-dot": (255, 140, 0),
    "HE-blot": (255, 0, 255),
    "EX": (255, 255, 0),
    "SE": (0, 220, 220),
}

LESION_NAMES = {
    "MA": "Microaneurysms",
    "HE-dot": "Hemorrhages (dot)",
    "HE-blot": "Hemorrhages (blot)",
    "EX": "Hard exudates",
    "SE": "Soft exudates",
}
