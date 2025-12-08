import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metadataPath = path.join(__dirname, '../../data/clips-metadata.json');

function normalizeTurkish(text) {
	return text
		.toLowerCase()
		.replace(/[.,!?;:"']/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function populateDatabase() {
	console.log('📚 Populating database with clip data...\n');

	if (!fs.existsSync(metadataPath)) {
		console.error('❌ Metadata file not found:', metadataPath);
		console.log('Please run "npm run process-clips" first');
		process.exit(1);
	}

	const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

	const insert = db.prepare(`
    INSERT INTO phrases (text, text_normalized, start_time, end_time, clip_filename, clip_duration)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

	const insertMany = db.transaction((clips) => {
		for (const clip of clips) {
			insert.run(
				clip.text,
				normalizeTurkish(clip.text),
				clip.start_time,
				clip.end_time,
				clip.filename,
				clip.clip_duration
			);
		}
	});

	insertMany(metadata);

	console.log(`✅ Inserted ${metadata.length} phrases into database`);
	console.log('\n📊 Database stats:');

	const stats = db.prepare('SELECT COUNT(*) as count FROM phrases').get();
	console.log(`   Total phrases: ${stats.count}`);

	console.log('\n✅ Database setup complete!');
	console.log('➡️  Next step: Run "npm run dev" to start the server');
}

populateDatabase();
