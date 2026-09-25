import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

const uploadDir = process.env.UPLOAD_DIR || path.resolve('uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `scan-${stamp}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!/^image\//.test(file.mimetype)) return cb(new Error('only image uploads are allowed'));
  cb(null, true);
}

export const uploadScan = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

export { uploadDir };
