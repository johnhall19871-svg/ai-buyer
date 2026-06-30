import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import recommendationsRouter from './routes/recommendations.js';
import { PORT } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/recommendations', recommendationsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ai-buyer' });
});

app.listen(PORT, () => {
  console.log(`AI Buyer running at http://localhost:${PORT}`);
});
