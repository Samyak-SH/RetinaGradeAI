"""Single-image DR lesion inference (local).

Usage:
    python infer_image.py <input_image_path> [output_dir]

Feeds the image through all 5 EfficientNet-B5 UNet++ models
(MA native-tiled + HE/EX/SE whole-image, HE split into dot/blot) and writes a
combined colour-coded overlay + per-lesion binary masks next to the input.
"""
import os, sys, time, numpy as np, cv2
from PIL import Image
import torch, segmentation_models_pytorch as smp

# --- model checkpoints -------------------------------------------------------
CK = os.path.dirname(os.path.abspath(__file__))

CKPT = {
    "MA_native": os.path.join(CK, "MA_native_timm-efficientnet-b5.pt"),
    "HE": os.path.join(CK, "HE_timm-efficientnet-b5_best.pt"),
    "EX": os.path.join(CK, "EX_timm-efficientnet-b5_best.pt"),
    "SE": os.path.join(CK, "SE_timm-efficientnet-b5_best.pt"),
    "MA": os.path.join(CK, "MA_timm-efficientnet-b5_best.pt"),
}

# --- config (must match training preprocessing) ------------------------------
SIZE = PATCH = 1024
CLAHE_CLIP, CLAHE_TILES = 2.0, (8, 8)
THR    = {"MA": 0.35, "HE": 0.5, "EX": 0.5, "SE": 0.5}
TAU_HE = 700   # HE component area < TAU_HE -> dot, else blot
COLORS = {"MA": (255, 0, 0), "HE-dot": (255, 140, 0), "HE-blot": (255, 0, 255),
          "EX": (255, 255, 0), "SE": (0, 220, 220)}
DEV = "cuda" if torch.cuda.is_available() else "cpu"


# --- preprocessing (identical to scripts/preprocessing.py) -------------------
def _resize_square(a, s, interp):
    h, w = a.shape[:2]; S = max(h, w)
    pad = np.zeros((S, S, a.shape[2]), a.dtype) if a.ndim == 3 else np.zeros((S, S), a.dtype)
    oy, ox = (S - h) // 2, (S - w) // 2
    pad[oy:oy + h, ox:ox + w] = a
    return cv2.resize(pad, (s, s), interpolation=interp)

def _clahe(img):
    c = cv2.createCLAHE(clipLimit=CLAHE_CLIP, tileGridSize=CLAHE_TILES)
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB); lab[:, :, 0] = c.apply(lab[:, :, 0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

def preprocess(raw):
    """raw RGB -> (clahe_1024, clahe_native_crop)."""
    h, w = raw.shape[:2]
    g = cv2.cvtColor(raw, cv2.COLOR_RGB2GRAY)
    t = max(7, int(g.mean() * 0.10)); co = np.argwhere(g > t)
    if co.size: y0, x0 = co.min(0); y1, x1 = co.max(0) + 1
    else:       y0, x0, y1, x1 = 0, 0, h, w
    crop = raw[y0:y1, x0:x1]
    small  = _clahe(_resize_square(crop, SIZE, cv2.INTER_AREA))
    native = _clahe(_resize_square(crop, max(crop.shape[:2]), cv2.INTER_AREA))
    return small, native


# --- inference ---------------------------------------------------------------
def load_model(path):
    m = smp.UnetPlusPlus("timm-efficientnet-b5", encoder_weights=None, in_channels=3, classes=1).to(DEV)
    m.load_state_dict(torch.load(path, map_location=DEV, weights_only=False)); m.eval()
    return m

@torch.no_grad()
def predict_whole(model, img, thr):
    t = torch.from_numpy(img).permute(2, 0, 1).float().unsqueeze(0).to(DEV) / 255.0
    return (torch.sigmoid(model(t))[0, 0].cpu().numpy() > thr).astype(np.uint8)

def _pad(a, H, W):
    ph, pw = max(0, H - a.shape[0]), max(0, W - a.shape[1])
    return np.pad(a, ((0, ph), (0, pw), (0, 0))) if a.ndim == 3 else np.pad(a, ((0, ph), (0, pw)))

@torch.no_grad()
def predict_tiled(model, img, thr):
    """native-resolution tiled inference; mask resized back to SIZE."""
    H, W = img.shape[:2]
    imgp = _pad(img, ((H + PATCH - 1) // PATCH) * PATCH, ((W + PATCH - 1) // PATCH) * PATCH)
    out = np.zeros((H, W), np.float32)
    for y in range(0, imgp.shape[0], PATCH):
        for x in range(0, imgp.shape[1], PATCH):
            t = torch.from_numpy(imgp[y:y + PATCH, x:x + PATCH]).permute(2, 0, 1).float().unsqueeze(0).to(DEV) / 255.0
            p = torch.sigmoid(model(t))[0, 0].cpu().numpy()
            out[y:min(y + PATCH, H), x:min(x + PATCH, W)] = p[:min(PATCH, H - y), :min(PATCH, W - x)]
    return cv2.resize((out > thr).astype(np.uint8), (SIZE, SIZE), interpolation=cv2.INTER_NEAREST)

def split_he(hm):
    n, lab, st, _ = cv2.connectedComponentsWithStats(hm.astype(np.uint8), 8)
    dot = np.zeros_like(hm); blot = np.zeros_like(hm)
    for i in range(1, n):
        (dot if st[i, cv2.CC_STAT_AREA] < TAU_HE else blot)[lab == i] = 1
    return dot, blot


def run(img_path, out_dir=None):
    raw = np.array(Image.open(img_path).convert("RGB"))
    small, native = preprocess(raw)

    masks = {}
    use_native = os.path.exists(CKPT["MA_native"])
    masks["MA"] = (predict_tiled(load_model(CKPT["MA_native"]), native, THR["MA"])
                   if use_native else predict_whole(load_model(CKPT["MA"]), small, THR["MA"]))
    he = predict_whole(load_model(CKPT["HE"]), small, THR["HE"])
    masks["HE-dot"], masks["HE-blot"] = split_he(he)
    masks["EX"] = predict_whole(load_model(CKPT["EX"]), small, THR["EX"])
    masks["SE"] = predict_whole(load_model(CKPT["SE"]), small, THR["SE"])

    # composite overlay (draw MA last so tiny dots stay visible)
    overlay = small.copy().astype(np.float32)
    for k in ["EX", "SE", "HE-blot", "HE-dot", "MA"]:
        m = masks[k].astype(bool)
        overlay[m] = 0.45 * overlay[m] + 0.55 * np.array(COLORS[k], np.float32)
    overlay = overlay.clip(0, 255).astype(np.uint8)

    counts = {k: int(v.sum()) for k, v in masks.items()}
    base = os.path.splitext(os.path.basename(img_path))[0]
    out_dir = out_dir or os.path.join(os.path.dirname(os.path.abspath(img_path)),
                                      f"{base}_result_{time.strftime('%Y%m%d_%H%M%S')}")
    os.makedirs(os.path.join(out_dir, "masks"), exist_ok=True)
    Image.fromarray(overlay).save(os.path.join(out_dir, "combined_overlay.png"))
    Image.fromarray(small).save(os.path.join(out_dir, "input_preprocessed.png"))
    for k, v in masks.items():
        Image.fromarray((v * 255).astype(np.uint8)).save(os.path.join(out_dir, "masks", f"{k}.png"))

    print("MA path :", "native tiled" if use_native else "whole-image")
    print("counts  :", counts)
    print("saved   :", out_dir)
    return os.path.join(out_dir, "combined_overlay.png")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python infer_image.py <input_image> [output_dir]"); sys.exit(1)
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
