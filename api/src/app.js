import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import { notFound, errorHandler } from './middleware/error.js';
import { uploadDir } from './middleware/upload.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/scans', scanRoutes);
app.use('/uploads', express.static(uploadDir));

app.use(notFound);
app.use(errorHandler);

export default app;
