# Diabetic Retinopathy Lesion Detection

A diabetic retinopathy lesion detection project using Python, PyTorch, and a Node.js backend.

## Requirements

- Python 3.11
- Node.js
- NVIDIA GPU with CUDA support (recommended)
- Git

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd major-project-phir-se
```

### 2. Create Python virtual environment

```bash
py -3.11 -m venv .venv
```

Activate it on Windows:

```powershell
.venv\Scripts\activate
```

### 3. Install Python dependencies

```bash
python -m pip install -r requirements.txt
```

### 4. Add the model files

Place the trained `.pt` model files in the project root:

```text
EX_timm-efficientnet-b5_best.pt
HE_timm-efficientnet-b5_best.pt
MA_timm-efficientnet-b5_best.pt
SE_timm-efficientnet-b5_best.pt
```

The model files are not included in the Git repository.

### 5. Install Node.js dependencies

Open a terminal in the `server` directory:

```bash
cd server
npm install
```

### 6. Start the server

From the `server` directory:

```bash
node index.js
```

The server will start at:

```text
http://localhost:3000
```

### 7. Open the application

Open the following in your browser:

```text
http://localhost:3000
```

Upload a retinal image and click **Run Detection**.

The processed image will be displayed after inference is completed.

## Notes

- Python 3.11 is recommended.
- An NVIDIA GPU is recommended for faster inference.
- The `.pt` model files must be placed in the project root.
