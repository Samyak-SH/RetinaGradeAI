"""Single-image DR lesion inference (local).

Usage:
    python infer_image.py <input_image_path> [output_dir]
"""

import os, sys, time, numpy as np, cv2
from PIL import Image
import torch
import segmentation_models_pytorch as smp

# --- model checkpoints -------------------------------------------------------
CK = os.path.dirname(os.path.abspath(__file__))

CKPT = {
    "MA_native": os.path.join(CK, "MA_native_timm-efficientnet-b5.pt"),
    "HE": os.path.join(CK, "HE_timm-efficientnet-b5_best.pt"),
    "EX": os.path.join(CK, "EX_timm-efficientnet-b5_best.pt"),
    "SE": os.path.join(CK, "SE_timm-efficientnet-b5_best.pt"),
    "MA": os.path.join(CK, "MA_timm-efficientnet-b5_best.pt"),
}

# --- config ------------------------------------------------------------------
SIZE = PATCH = 1024
CLAHE_CLIP, CLAHE_TILES = 2.0, (8, 8)
THR = {"MA": 0.35, "HE": 0.5, "EX": 0.5, "SE": 0.5}
TAU_HE = 700

COLORS = {
    "MA": (255, 0, 0),
    "HE-dot": (255, 140, 0),
    "HE-blot": (255, 0, 255),
    "EX": (255, 255, 0),
    "SE": (0, 220, 220)
}

LESION_NAMES = {
    "MA": "Microaneurysms",
    "HE-dot": "Hemorrhages (dot)",
    "HE-blot": "Hemorrhages (blot)",
    "EX": "Hard exudates",
    "SE": "Soft exudates"
}

DEV = "cuda" if torch.cuda.is_available() else "cpu"


# --- preprocessing -----------------------------------------------------------
def _resize_square(a, s, interp):
    h, w = a.shape[:2]
    S = max(h, w)
    pad = np.zeros((S, S, a.shape[2]), a.dtype) if a.ndim == 3 else np.zeros((S, S), a.dtype)
    oy, ox = (S - h) // 2, (S - w) // 2
    pad[oy:oy + h, ox:ox + w] = a
    return cv2.resize(pad, (s, s), interpolation=interp)


def _clahe(img):
    c = cv2.createCLAHE(clipLimit=CLAHE_CLIP, tileGridSize=CLAHE_TILES)
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    lab[:, :, 0] = c.apply(lab[:, :, 0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)


def preprocess(raw):
    """raw RGB -> (clahe_1024, clahe_native_crop)."""
    h, w = raw.shape[:2]
    g = cv2.cvtColor(raw, cv2.COLOR_RGB2GRAY)
    t = max(7, int(g.mean() * 0.10))
    co = np.argwhere(g > t)

    if co.size:
        y0, x0 = co.min(0)
        y1, x1 = co.max(0) + 1
    else:
        y0, x0, y1, x1 = 0, 0, h, w

    crop = raw[y0:y1, x0:x1]
    small = _clahe(_resize_square(crop, SIZE, cv2.INTER_AREA))
    native = _clahe(_resize_square(crop, max(crop.shape[:2]), cv2.INTER_AREA))

    return small, native


# --- model loading -----------------------------------------------------------
def load_model(path):
    m = smp.UnetPlusPlus("timm-efficientnet-b5", encoder_weights=None, in_channels=3, classes=1).to(DEV)
    m.load_state_dict(torch.load(path, map_location=DEV, weights_only=False))
    m.eval()
    return m


# --- whole image inference ---------------------------------------------------
@torch.no_grad()
def predict_whole(model, img, thr):
    t = torch.from_numpy(img).permute(2, 0, 1).float().unsqueeze(0).to(DEV) / 255.0
    return (torch.sigmoid(model(t))[0, 0].cpu().numpy() > thr).astype(np.uint8)


# --- padding -----------------------------------------------------------------
def _pad(a, H, W):
    ph, pw = max(0, H - a.shape[0]), max(0, W - a.shape[1])
    return np.pad(a, ((0, ph), (0, pw), (0, 0))) if a.ndim == 3 else np.pad(a, ((0, ph), (0, pw)))


# --- tiled inference ---------------------------------------------------------
@torch.no_grad()
def predict_tiled(model, img, thr):
    H, W = img.shape[:2]
    padded_H = ((H + PATCH - 1) // PATCH) * PATCH
    padded_W = ((W + PATCH - 1) // PATCH) * PATCH
    imgp = _pad(img, padded_H, padded_W)
    out = np.zeros((H, W), np.float32)

    for y in range(0, imgp.shape[0], PATCH):
        for x in range(0, imgp.shape[1], PATCH):
            tile = imgp[y:y + PATCH, x:x + PATCH]
            t = torch.from_numpy(tile).permute(2, 0, 1).float().unsqueeze(0).to(DEV) / 255.0
            p = torch.sigmoid(model(t))[0, 0].cpu().numpy()
            y_end, x_end = min(y + PATCH, H), min(x + PATCH, W)
            out[y:y_end, x:x_end] = p[:y_end - y, :x_end - x]

    return cv2.resize((out > thr).astype(np.uint8), (SIZE, SIZE), interpolation=cv2.INTER_NEAREST)


# --- split hemorrhages into dots and blots ----------------------------------
def split_he(hm):
    n, lab, st, _ = cv2.connectedComponentsWithStats(hm.astype(np.uint8), 8)
    dot = np.zeros_like(hm)
    blot = np.zeros_like(hm)

    for i in range(1, n):
        area = st[i, cv2.CC_STAT_AREA]
        target = dot if area < TAU_HE else blot
        target[lab == i] = 1

    return dot, blot


# --- count individual lesions -----------------------------------------------
def count_lesions(mask):
    n, _, _, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    return n - 1


def get_lesion_counts(masks):
    counts = {key: count_lesions(mask) for key, mask in masks.items()}
    counts["TOTAL"] = sum(counts.values())
    return counts


# --- add legend and lesion counts --------------------------------------------
def add_legend(image, counts):
    h, w = image.shape[:2]
    legend_width = 420
    padding = 25

    output = np.ones((h, w + legend_width, 3), dtype=np.uint8) * 245
    output[:, :w] = image

    cv2.putText(output, "DR Lesion Detection", (w + padding, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (30, 30, 30), 2, cv2.LINE_AA)

    y = 90

    for key in ["MA", "HE-dot", "HE-blot", "EX", "SE"]:
        color = COLORS[key]
        color_bgr = (color[2], color[1], color[0])

        cv2.rectangle(output, (w + padding, y - 18), (w + padding + 28, y + 10), color_bgr, -1)
        cv2.putText(output, LESION_NAMES[key], (w + padding + 45, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (30, 30, 30), 1, cv2.LINE_AA)

        count_text = f"{counts[key]} lesion" if counts[key] == 1 else f"{counts[key]} lesions"
        cv2.putText(output, count_text, (w + padding + 45, y + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (90, 90, 90), 1, cv2.LINE_AA)

        y += 75

    y += 10

    cv2.line(output, (w + padding, y - 15), (w + legend_width - padding, y - 15), (170, 170, 170), 1)
    cv2.putText(output, f"Total lesions: {counts['TOTAL']}", (w + padding, y + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 2, cv2.LINE_AA)

    y += 80
    cv2.putText(output, f"Device: {DEV}", (w + padding, y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 100, 100), 1, cv2.LINE_AA)

    return output


# --- main inference ----------------------------------------------------------
def run(img_path, out_dir=None):
    print("\nRunning DR lesion detection...")
    print("Device:", DEV)

    raw = np.array(Image.open(img_path).convert("RGB"))
    small, native = preprocess(raw)

    masks = {}

    # MA
    use_native = os.path.exists(CKPT["MA_native"])

    if use_native:
        model = load_model(CKPT["MA_native"])
        masks["MA"] = predict_tiled(model, native, THR["MA"])
        del model
    else:
        model = load_model(CKPT["MA"])
        masks["MA"] = predict_whole(model, small, THR["MA"])
        del model

    # HE
    model = load_model(CKPT["HE"])
    he = predict_whole(model, small, THR["HE"])
    del model

    masks["HE-dot"], masks["HE-blot"] = split_he(he)

    # EX
    model = load_model(CKPT["EX"])
    masks["EX"] = predict_whole(model, small, THR["EX"])
    del model

    # SE
    model = load_model(CKPT["SE"])
    masks["SE"] = predict_whole(model, small, THR["SE"])
    del model

    # Count connected lesion components
    counts = get_lesion_counts(masks)

    # Create colour overlay
    overlay = small.copy().astype(np.float32)

    for key in ["EX", "SE", "HE-blot", "HE-dot", "MA"]:
        mask = masks[key].astype(bool)
        color = np.array(COLORS[key], dtype=np.float32)
        overlay[mask] = 0.45 * overlay[mask] + 0.55 * color

    overlay = np.clip(overlay, 0, 255).astype(np.uint8)

    # Add legend
    final_output = add_legend(overlay, counts)

    # Create output directory
    base = os.path.splitext(os.path.basename(img_path))[0]
    out_dir = out_dir or os.path.join(os.path.dirname(os.path.abspath(img_path)), f"{base}_result_{time.strftime('%Y%m%d_%H%M%S')}")
    os.makedirs(os.path.join(out_dir, "masks"), exist_ok=True)

    # Save combined result
    Image.fromarray(final_output).save(os.path.join(out_dir, "combined_overlay.png"))

    # Save preprocessed input
    Image.fromarray(small).save(os.path.join(out_dir, "input_preprocessed.png"))

    # Save individual masks
    for key, mask in masks.items():
        Image.fromarray((mask * 255).astype(np.uint8)).save(os.path.join(out_dir, "masks", f"{key}.png"))

    # Print results
    print("\nMA path :", "native tiled" if use_native else "whole-image")
    print("\nLesion counts:")

    for key in ["MA", "HE-dot", "HE-blot", "EX", "SE"]:
        print(f"  {LESION_NAMES[key]:25s}: {counts[key]}")

    print(f"  {'TOTAL':25s}: {counts['TOTAL']}")
    print("\nSaved:", out_dir)

    return os.path.join(out_dir, "combined_overlay.png")


# --- command line ------------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python infer_image.py <input_image> [output_dir]")
        sys.exit(1)

    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)