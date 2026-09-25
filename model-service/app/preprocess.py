"""Fundus preprocessing, ported from infer_image.py so results stay identical."""

import cv2
import numpy as np

from .config import CLAHE_CLIP, CLAHE_TILES, SIZE


def _resize_square(a, s, interp):
    """Pad to a centred square, then resize, so aspect ratio is preserved."""
    h, w = a.shape[:2]
    side = max(h, w)
    pad = (
        np.zeros((side, side, a.shape[2]), a.dtype)
        if a.ndim == 3
        else np.zeros((side, side), a.dtype)
    )
    oy, ox = (side - h) // 2, (side - w) // 2
    pad[oy : oy + h, ox : ox + w] = a
    return cv2.resize(pad, (s, s), interpolation=interp)


def _clahe(img):
    """Contrast-limited equalisation on L only, so colour is left alone."""
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP, tileGridSize=CLAHE_TILES)
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)


def preprocess(raw):
    """raw RGB -> (clahe_1024, clahe_native_crop).

    The fundus circle is cropped out of the black border first, using a
    brightness threshold derived from the image's own mean.
    """
    h, w = raw.shape[:2]
    gray = cv2.cvtColor(raw, cv2.COLOR_RGB2GRAY)
    thresh = max(7, int(gray.mean() * 0.10))
    coords = np.argwhere(gray > thresh)

    if coords.size:
        y0, x0 = coords.min(0)
        y1, x1 = coords.max(0) + 1
    else:
        y0, x0, y1, x1 = 0, 0, h, w

    crop = raw[y0:y1, x0:x1]
    small = _clahe(_resize_square(crop, SIZE, cv2.INTER_AREA))
    native = _clahe(_resize_square(crop, max(crop.shape[:2]), cv2.INTER_AREA))

    return small, native
