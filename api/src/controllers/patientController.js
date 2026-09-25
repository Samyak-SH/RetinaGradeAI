import Patient from '../models/Patient.js';
import Scan from '../models/Scan.js';

export async function listPatients(req, res) {
  const { search = '' } = req.query;
  const query = { doctor: req.user._id };

  if (search.trim()) {
    // Regex rather than $text so partial names match as the doctor types.
    query.name = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  const patients = await Patient.find(query).sort({ updatedAt: -1 }).lean();

  const counts = await Scan.aggregate([
    { $match: { doctor: req.user._id } },
    { $group: { _id: '$patient', scans: { $sum: 1 }, lastScan: { $max: '$createdAt' } } },
  ]);
  const byPatient = new Map(counts.map((c) => [c._id.toString(), c]));

  res.json(
    patients.map((p) => ({
      ...p,
      scanCount: byPatient.get(p._id.toString())?.scans || 0,
      lastScan: byPatient.get(p._id.toString())?.lastScan || null,
    }))
  );
}

export async function createPatient(req, res) {
  const { name, age, sex, contact, notes } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ message: 'patient name is required' });

  const patient = await Patient.create({
    doctor: req.user._id,
    name: name.trim(),
    age: age === '' || age === undefined ? undefined : Number(age),
    sex: sex || 'unknown',
    contact: contact || '',
    notes: notes || '',
  });

  res.status(201).json(patient);
}

export async function getPatient(req, res) {
  const patient = await Patient.findOne({ _id: req.params.id, doctor: req.user._id });
  if (!patient) return res.status(404).json({ message: 'patient not found' });

  const scans = await Scan.find({ patient: patient._id }).sort({ createdAt: -1 });
  res.json({ patient, scans });
}

export async function updatePatient(req, res) {
  const { name, age, sex, contact, notes } = req.body || {};
  const patient = await Patient.findOneAndUpdate(
    { _id: req.params.id, doctor: req.user._id },
    {
      ...(name !== undefined && { name: name.trim() }),
      ...(age !== undefined && { age: age === '' ? undefined : Number(age) }),
      ...(sex !== undefined && { sex }),
      ...(contact !== undefined && { contact }),
      ...(notes !== undefined && { notes }),
    },
    { new: true }
  );
  if (!patient) return res.status(404).json({ message: 'patient not found' });
  res.json(patient);
}

export async function deletePatient(req, res) {
  const patient = await Patient.findOneAndDelete({ _id: req.params.id, doctor: req.user._id });
  if (!patient) return res.status(404).json({ message: 'patient not found' });
  await Scan.deleteMany({ patient: patient._id });
  res.json({ message: 'patient and their scans were deleted' });
}
