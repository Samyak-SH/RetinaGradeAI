"""FastAPI wrapper around the DR lesion detection pipeline."""

import base64
import logging

from fastapi import FastAPI, File, HTTPException, UploadFile

from . import models
from .config import KEEP_MODELS_LOADED, USE_MA_NATIVE
from .inference import MODEL_NAME, run

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("model-service")

app = FastAPI(title="DR Lesion Detection", version="1.0.0")


@app.on_event("startup")
def warm_up():
    missing = models.missing_checkpoints()
    if missing:
        log.warning("missing checkpoints: %s — /predict will fail until they are mounted", missing)
        return

    log.info("device=%s ma_native=%s", models.DEVICE, models.has_checkpoint("MA_native"))

    if KEEP_MODELS_LOADED:
        # Pay the load cost at boot rather than on the doctor's first upload.
        for key in ("MA_native", "MA", "HE", "EX", "SE"):
            if key == "MA_native" and not (USE_MA_NATIVE and models.has_checkpoint(key)):
                continue
            if key == "MA" and USE_MA_NATIVE and models.has_checkpoint("MA_native"):
                continue
            models.get_model(key)
            log.info("loaded %s", key)


@app.get("/health")
def health():
    missing = models.missing_checkpoints()
    return {
        "status": "ok" if not missing else "degraded",
        "device": models.DEVICE,
        "model": MODEL_NAME,
        "missing_checkpoints": missing,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    missing = models.missing_checkpoints()
    if missing:
        raise HTTPException(503, f"model weights not mounted: {', '.join(missing)}")

    data = await file.read()
    if not data:
        raise HTTPException(400, "empty upload")

    try:
        result = run(data)
    except Exception as err:  # surfaced to the API so the doctor sees a reason
        log.exception("inference failed")
        raise HTTPException(500, f"inference failed: {err}") from err

    log.info(
        "%s -> %d lesions in %.0f ms", file.filename, result["counts"]["TOTAL"], result["inference_ms"]
    )

    # Images travel as base64 so the whole report is one JSON response; the API
    # writes them back out as files.
    result["overlay_png_base64"] = base64.b64encode(result.pop("overlay_png")).decode()
    result["preprocessed_png_base64"] = base64.b64encode(result.pop("preprocessed_png")).decode()

    return result
