"""Turn binary lesion masks into individual, locatable lesion records."""

import math

import cv2
import numpy as np

from .config import MIN_LESION_AREA, SIZE, TAU_HE


def split_he(mask):
    """Separate hemorrhages into dot and blot by connected-component area."""
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    dot = np.zeros_like(mask)
    blot = np.zeros_like(mask)

    for i in range(1, n):
        target = dot if stats[i, cv2.CC_STAT_AREA] < TAU_HE else blot
        target[labels == i] = 1

    return dot, blot


def describe_region(cx, cy):
    """Describe a point as a clock position and eccentricity ring.

    The reference is the centre of the cropped fundus, not the fovea, because
    laterality and disc position are not known from the image alone.
    """
    dx = cx - 0.5
    dy = 0.5 - cy  # screen y grows downward; flip so "up" is positive
    radius = math.hypot(dx, dy) / 0.5

    if radius < 0.02:
        return "central"

    # 12 o'clock is straight up, hours increase clockwise.
    angle = (90 - math.degrees(math.atan2(dy, dx))) % 360
    hour = int(round(angle / 30)) or 12

    if radius < 0.33:
        ring = "central"
    elif radius < 0.66:
        ring = "mid-periphery"
    else:
        ring = "periphery"

    return f"{hour} o'clock, {ring}"


def extract(mask, prob, label):
    """One record per connected component, with its box, size and confidence."""
    n, labels, stats, centroids = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    out = []

    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < MIN_LESION_AREA:
            continue

        x = int(stats[i, cv2.CC_STAT_LEFT])
        y = int(stats[i, cv2.CC_STAT_TOP])
        w = int(stats[i, cv2.CC_STAT_WIDTH])
        h = int(stats[i, cv2.CC_STAT_HEIGHT])

        # Mean sigmoid output over the component is a reasonable per-lesion
        # confidence for a segmentation model that has no detection head.
        component = labels[y : y + h, x : x + w] == i
        confidence = float(prob[y : y + h, x : x + w][component].mean())

        cx = float(centroids[i][0]) / SIZE
        cy = float(centroids[i][1]) / SIZE

        out.append(
            {
                "label": label,
                "confidence": round(confidence, 4),
                "bbox": {
                    "x": round(x / SIZE, 6),
                    "y": round(y / SIZE, 6),
                    "w": round(w / SIZE, 6),
                    "h": round(h / SIZE, 6),
                },
                "centroid": {"x": round(cx, 6), "y": round(cy, 6)},
                "region": describe_region(cx, cy),
                "area_px": area,
            }
        )

    # Largest first so the most clinically obvious lesions head the report.
    out.sort(key=lambda l: l["area_px"], reverse=True)
    return out
