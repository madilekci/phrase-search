import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import { parseSync } from 'subtitle';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIDEO_PATH = path.join(__dirname, '../../data/original/kurtlar-vadisi-ep1.mp4');
const SUBTITLE_PATH = path.join(__dirname, '../../data/subtitles/kurtlar-vadisi-ep1.srt');
const CLIPS_DIR = path.join(__dirname, '../../data/clips');

const MAX_CLIP_DURATION = 9;
const CONTEXT_PADDING = 2;
const TEST_MODE = true;
const MAX_TEST_CLIPS = 50;

function normalizeTurkish(text) {
	return text
		.toLowerCase()
		.replace(/[.,!?;:"']/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function parseSubtitles() {
	console.log('📖 Reading subtitle file...');
	if (!fs.existsSync(SUBTITLE_PATH)) {
		console.error('❌ Subtitle file not found:', SUBTITLE_PATH);
		console.log('Please run "npm run transcribe" first');
		process.exit(1);
	}
	const srtContent = fs.readFileSync(SUBTITLE_PATH, 'utf-8');
	const subtitles = parseSync(srtContent);
	console.log(`Found ${subtitles.length} subtitle entries\n`);
	return subtitles;
}

function msToTime(ms) {
	const seconds = Math.floor(ms / 1000);
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
		secs
	).padStart(2, '0')}`;
}

function createClip(subtitle, index, totalSubtitles) {
	return new Promise((resolve, reject) => {
		const startMs = subtitle.start;
		const endMs = subtitle.end;

		let clipStartMs = Math.max(0, startMs - CONTEXT_PADDING * 1000);
		let clipEndMs = endMs + CONTEXT_PADDING * 1000;

		if (clipEndMs - clipStartMs > MAX_CLIP_DURATION * 1000) {
			clipEndMs = clipStartMs + MAX_CLIP_DURATION * 1000;
		}

		const clipDuration = (clipEndMs - clipStartMs) / 1000;
		const startTime = msToTime(clipStartMs);

		const text = subtitle.text.replace(/<[^>]*>/g, '').trim();
		const safeText = normalizeTurkish(text)
			.replace(/[^a-zçğıöşü0-9\s]/gi, '')
			.split(/\s+/)
			.slice(0, 5)
			.join('-')
			.substring(0, 50);

		const timestamp = msToTime(startMs).replace(/:/g, '-');
		const filename = `clip_${String(index).padStart(4, '0')}_${timestamp}_${safeText}.mp4`;
		const outputPath = path.join(CLIPS_DIR, filename);

		console.log(
			`⏳ [${index}/${totalSubtitles}] Creating clip: ${startTime} (${clipDuration.toFixed(
				1
			)}s)`
		);
		console.log(`   Text: "${text}"`);

		ffmpeg(VIDEO_PATH)
			.setStartTime(clipStartMs / 1000)
			.setDuration(clipDuration)
			.output(outputPath)
			.videoCodec('libx264')
			.audioCodec('aac')
			.size('640x?')
			.on('end', () => {
				console.log(`✅ Created: ${filename}\n`);
				resolve({
					filename,
					text,
					start_time: msToTime(startMs),
					end_time: msToTime(endMs),
					clip_duration: clipDuration,
				});
			})
			.on('error', (err) => {
				console.error(`❌ Error creating clip ${index}:`, err.message);
				reject(err);
			})
			.run();
	});
}

async function processClips() {
	console.log('🎬 Starting video clip processing...\n');

	if (!fs.existsSync(VIDEO_PATH)) {
		console.error('❌ Video file not found:', VIDEO_PATH);
		process.exit(1);
	}

	if (!fs.existsSync(CLIPS_DIR)) {
		fs.mkdirSync(CLIPS_DIR, { recursive: true });
	}

	const subtitles = parseSubtitles();
	const clipData = [];

	for (let i = 0; i < subtitles.length; i++) {
		if (TEST_MODE && i >= MAX_TEST_CLIPS) {
			console.log(`\n⚠️ Test mode active. Processed ${MAX_TEST_CLIPS} clips. Stopping...`);
			break;
		}

		try {
			const data = await createClip(subtitles[i], i + 1, subtitles.length);
			clipData.push(data);
		} catch (error) {
			console.error(`Failed to process clip ${i + 1}, continuing...`);
		}
	}

	const metadataPath = path.join(__dirname, '../../data/clips-metadata.json');
	fs.writeFileSync(metadataPath, JSON.stringify(clipData, null, 2));

	console.log('\n✅ All clips processed!');
	console.log(`📊 Total clips created: ${clipData.length}`);
	console.log(`📁 Clips directory: ${CLIPS_DIR}`);
	console.log(`📄 Metadata saved: ${metadataPath}`);
	console.log('\n➡️  Next step: Run "npm run populate-db" to create the database');
}

processClips().catch(console.error);
