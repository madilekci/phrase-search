import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import searchRoutes from './routes/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../../frontend')));
app.use('/clips', express.static(path.join(__dirname, '../../data/clips')));

app.use('/api', searchRoutes);

app.get('/api/health', (req, res) => {
	res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
	console.log(`\n🚀 Server running at http://localhost:${PORT}`);
	console.log(`📺 Open your browser and start searching!\n`);
});
