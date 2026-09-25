# RetinaGrade — DR Lesion Dashboard

A doctor-facing dashboard for diabetic retinopathy lesion detection. Doctors sign
up, create patient records, upload retinal fundus images, and read a per-scan
report showing every detected lesion with its type, count and location.

The detection model is the UNet++ / `timm-efficientnet-b5` segmentation stack from
[Samyak-SH/RetinaGradeAI](https://github.com/Samyak-SH/RetinaGradeAI), wrapped in a
Python service.

## Architecture

Four containers, started by a single compose file:

| Service | Stack | Port | Role |
| --- | --- | --- | --- |
| `client` | Vite + React, served by nginx | 3000 | Dashboard UI; proxies `/api` and `/uploads` to the API |
| `api` | Node.js + Express (MVC) | internal | Auth, patients, scans; calls the model service |
| `model` | Python + FastAPI + PyTorch | internal | Runs the four segmentation models, returns lesion JSON |
| `mongo` | MongoDB 7 | internal | Persistence |

Only the client is published on the host. Persistent state lives in two named
volumes: `mongo-data` (database) and `uploads` (scan images and overlays).

```
browser → client:80 ─┬→ /api/*     → api:5000 ─┬→ mongo:27017
                     └→ /uploads/* → api:5000  └→ model:8000
```

## The model

Five lesion classes are detected by four checkpoints:

| Class | Lesion | Threshold |
| --- | --- | --- |
| `MA` | Microaneurysms | 0.35 |
| `HE-dot` / `HE-blot` | Hemorrhages, split by component area (τ = 700 px) | 0.50 |
| `EX` | Hard exudates | 0.50 |
| `SE` | Soft exudates | 0.50 |

Each image is cropped to the fundus circle, padded square, resized to 1024×1024
and CLAHE-equalised, matching `infer_image.py`. Every segmentation mask is then
split into connected components, and each component becomes one lesion record
with a normalised bounding box, a centroid, an area, a mean-probability
confidence, and a clock-position description of where it sits.

### Weights

The `.pt` checkpoints are not in version control. Place them in
`model-service/weights/` before starting:

```
model-service/weights/
├── MA_timm-efficientnet-b5_best.pt
├── HE_timm-efficientnet-b5_best.pt
├── EX_timm-efficientnet-b5_best.pt
├── SE_timm-efficientnet-b5_best.pt
└── MA_native_timm-efficientnet-b5.pt   (optional)
```

If `MA_native_...pt` is present, microaneurysms use the native-resolution tiled
path. That path is accurate but slow on CPU; set `USE_MA_NATIVE=0` in the compose
environment to fall back to the whole-image path.

## Running it

```bash
cp .env.example .env          # then set a real JWT_SECRET
docker compose up --build
```

Open <http://localhost:3000>, create an account, and add a patient.

First build pulls the CPU PyTorch wheels, so expect it to take a while. The model
container loads all checkpoints at startup — `docker compose logs -f model` will
show `loaded MA`, `loaded HE`, and so on before it is ready.

### Performance note

There is no GPU inside the containers, so inference runs on CPU: four UNet++
EfficientNet-B5 forward passes at 1024×1024. Expect tens of seconds per scan, and
several minutes if the native tiled MA path is enabled on a large image. The
API's timeout is 10 minutes (`MODEL_TIMEOUT_MS`).

## Local development

Run the services individually without Docker:

```bash
# model
cd model-service && pip install -r requirements.txt && uvicorn app.main:app --port 8000

# api
cd api && cp .env.example .env && npm install && npm run dev

# client — Vite proxies /api and /uploads to localhost:5000
cd client && npm install && npm run dev
```

## API

All routes except signup and login require `Authorization: Bearer <jwt>`.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Create a doctor account, returns a JWT |
| `POST` | `/api/auth/login` | Sign in, returns a JWT |
| `GET` | `/api/auth/me` | Current doctor |
| `GET` | `/api/patients?search=` | List/search own patients by name |
| `POST` | `/api/patients` | Create a patient |
| `GET` | `/api/patients/:id` | Patient plus full scan history |
| `PUT`/`DELETE` | `/api/patients/:id` | Update or delete (deleting removes their scans) |
| `GET` | `/api/patients/:id/scans` | Scans for a patient |
| `POST` | `/api/patients/:id/scans` | Upload an image (`image` field) and run detection |
| `GET`/`DELETE` | `/api/scans/:id` | Read or delete one scan report |

Every query is scoped to the authenticated doctor, so one account cannot read
another's records.

## Project layout

```
client/                 Vite + React dashboard
  src/pages/            Login, Signup, Dashboard, PatientDetail, ScanReport
  src/components/       LesionViewer (hover magnifier), ScanUpload, forms
api/                    Express API, MVC
  src/models/           User, Patient, Scan (Mongoose)
  src/controllers/      auth, patient, scan
  src/routes/           route tables
  src/middleware/       JWT auth, multer upload, error handling
model-service/          FastAPI wrapper around the DR models
  app/preprocess.py     fundus crop + CLAHE, ported from infer_image.py
  app/models.py         checkpoint loading, whole-image and tiled inference
  app/lesions.py        connected components → per-lesion boxes and locations
  app/inference.py      pipeline orchestration and overlay rendering
```
