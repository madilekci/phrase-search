import express from 'express';
import db from '../db.js';

const router = express.Router();

function normalizeTurkish(text) {
	return text
		.toLowerCase()
		.replace(/[.,!?;:"']/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

router.get('/search', (req, res) => {
	const query = req.query.q;

	if (!query || query.trim().length < 2) {
		return res.json({ results: [], message: 'Query too short' });
	}

	const normalizedQuery = normalizeTurkish(query);
	const searchPattern = `%${normalizedQuery}%`;

	const results = db
		.prepare(
			`
    SELECT id, text, start_time, end_time, clip_filename, clip_duration
    FROM phrases
    WHERE text_normalized LIKE ?
    ORDER BY id
    LIMIT 50
  `
		)
		.all(searchPattern);

	res.json({
		results,
		count: results.length,
		query: query,
	});
});

router.get('/clip/:id', (req, res) => {
	const clip = db
		.prepare(
			`
    SELECT * FROM phrases WHERE id = ?
  `
		)
		.get(req.params.id);

	if (!clip) {
		return res.status(404).json({ error: 'Clip not found' });
	}

	res.json(clip);
});

router.get('/stats', (req, res) => {
	const stats = db
		.prepare(
			`
    SELECT
      COUNT(*) as total_phrases,
      SUM(clip_duration) as total_duration
    FROM phrases
  `
		)
		.get();

	res.json(stats);
});

export default router;
