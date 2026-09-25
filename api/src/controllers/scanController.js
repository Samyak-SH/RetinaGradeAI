import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import FormData from 'form-data';
import Patient from '../models/Patient.js';
import Scan from '../models/Scan.js';
import { uploadDir } from '../middleware/upload.js';

const MODEL_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000';

function countByLabel(lesions) {
  return lesions.reduce((acc, l) => {
    acc[l.label] = (acc[l.label] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Write a base64 PNG from the model out as a real file, so the client streams it
 * like any other upload instead of carrying megabytes inside the JSON record.
 */
function saveImage(base64, prefix, scanFilename) {
  if (!base64) return '';
  const name = `${prefix}-${path.parse(scanFilename).name}.png`;
  fs.writeFileSync(path.join(uploadDir, name), Buffer.from(base64, 'base64'));
  return name;
}

export async function createScan(req, res) {
  const patient = await Patient.findOne({ _id: req.params.patientId, doctor: req.user._id });
  if (!patient) return res.status(404).json({ message: 'patient not found' });
  if (!req.file) return res.status(400).json({ message: 'a lesion image file is required' });

  const scan = await Scan.create({
    patient: patient._id,
    doctor: req.user._id,
    inputImage: req.file.filename,
    status: 'pending',
  });

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path), req.file.originalname);

    const { data } = await axios.post(`${MODEL_URL}/predict`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      // CPU inference across four segmentation models is not quick.
      timeout: Number(process.env.MODEL_TIMEOUT_MS || 600000),
    });

    scan.lesions = (data.lesions || []).map((l) => ({
      label: l.label,
      confidence: l.confidence,
      bbox: l.bbox,
      centroid: l.centroid,
      region: l.region || '',
      areaPx: l.area_px || 0,
    }));

    scan.lesionCount = data.counts?.TOTAL ?? scan.lesions.length;
    scan.countsByLabel = countByLabel(scan.lesions);
    scan.imageWidth = data.image?.width || 0;
    scan.imageHeight = data.image?.height || 0;
    scan.modelName = data.model_name || '';
    scan.device = data.device || '';
    scan.maPath = data.ma_path || '';
    scan.inferenceMs = data.inference_ms || 0;
    scan.summary = data.summary || '';
    scan.displayImage = saveImage(data.preprocessed_png_base64, 'input', req.file.filename);
    scan.overlayImage = saveImage(data.overlay_png_base64, 'overlay', req.file.filename);
    scan.status = 'complete';
    await scan.save();

    // Touch the patient so the dashboard's recent-activity order stays right.
    await Patient.updateOne({ _id: patient._id }, { $set: { updatedAt: new Date() } });

    res.status(201).json(scan);
  } catch (err) {
    scan.status = 'failed';
    scan.error = err.response?.data?.detail || err.message;
    await scan.save();
    res.status(502).json({ message: `model service failed: ${scan.error}`, scan });
  }
}

export async function listScans(req, res) {
  const scans = await Scan.find({ patient: req.params.patientId, doctor: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(scans);
}

export async function getScan(req, res) {
  const scan = await Scan.findOne({ _id: req.params.id, doctor: req.user._id }).populate(
    'patient',
    'name age sex'
  );
  if (!scan) return res.status(404).json({ message: 'scan not found' });
  res.json(scan);
}

export async function deleteScan(req, res) {
  const scan = await Scan.findOneAndDelete({ _id: req.params.id, doctor: req.user._id });
  if (!scan) return res.status(404).json({ message: 'scan not found' });

  for (const name of [scan.inputImage, scan.displayImage, scan.overlayImage].filter(Boolean)) {
    fs.rm(path.join(uploadDir, name), { force: true }, () => {});
  }
  res.json({ message: 'scan deleted' });
}
