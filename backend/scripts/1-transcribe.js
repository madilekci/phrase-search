import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIDEO_PATH = path.join(__dirname, '../../data/original/kurtlar-vadisi-ep1.mp4');
const SUBTITLE_DIR = path.join(__dirname, '../../data/subtitles');
const SUBTITLE_PATH = path.join(SUBTITLE_DIR, 'kurtlar-vadisi-ep1.srt');
const TEMP_DIR = path.join(__dirname, '../../data/temp');

// Configuration
const TEST_MODE = false; // Set to true to transcribe a sample segment
const TEST_START_TIME = 480; // Start at 8:00 (8 minutes * 60 seconds)
const TEST_DURATION = 120; // Extract 2 minutes (from 8:00 to 10:00)
const WHISPER_MODEL = 'large'; // Options: tiny, base, small, medium, large

// Performance Configuration
const USE_GPU = true; // Set to true to use GPU (Apple Silicon MPS or CUDA)
const FP16 = false; // Use half-precision (faster, slightly less accurate)
const NUM_WORKERS = 4; // Number of CPU workers for preprocessing

async function transcribe() {
	console.log('🎬 Starting transcription with Whisper...');

	if (TEST_MODE) {
		const startMin = Math.floor(TEST_START_TIME / 60);
		const endMin = Math.floor((TEST_START_TIME + TEST_DURATION) / 60);
		console.log(
			`⚠️  TEST MODE: Transcribing ${
				TEST_DURATION / 60
			} minutes (${startMin}:00 to ${endMin}:00)`
		);
		console.log(`📊 Using Whisper model: ${WHISPER_MODEL}`);
		console.log('This should take 1-5 minutes.\n');
	} else {
		console.log('This may take 10-20 minutes for a 40-minute episode.\n');
	}

	// Check if video exists
	if (!fs.existsSync(VIDEO_PATH)) {
		console.error('❌ Video file not found:', VIDEO_PATH);
		console.log('Please place your video at:', VIDEO_PATH);
		process.exit(1);
	}

	// Create directories
	if (!fs.existsSync(SUBTITLE_DIR)) {
		fs.mkdirSync(SUBTITLE_DIR, { recursive: true });
	}
	if (!fs.existsSync(TEMP_DIR)) {
		fs.mkdirSync(TEMP_DIR, { recursive: true });
	}

	try {
		let videoToTranscribe = VIDEO_PATH;

		// Extract test clip if in TEST_MODE
		if (TEST_MODE) {
			const testClipPath = path.join(TEMP_DIR, 'test-clip.mp4');
			const startMin = Math.floor(TEST_START_TIME / 60);
			const startSec = TEST_START_TIME % 60;
			const endMin = Math.floor((TEST_START_TIME + TEST_DURATION) / 60);

			console.log(
				`📹 Extracting segment ${startMin}:${String(startSec).padStart(
					2,
					'0'
				)} to ${endMin}:00 with FFmpeg...`
			);

			const extractCommand = `ffmpeg -ss ${TEST_START_TIME} -i "${VIDEO_PATH}" -t ${TEST_DURATION} -c copy "${testClipPath}" -y`;
			console.log('Running:', extractCommand);

			await execAsync(extractCommand);
			console.log('✅ Test segment extracted\n');

			videoToTranscribe = testClipPath;
		}

		// Build Whisper command with performance optimizations
		let command = `whisper "${videoToTranscribe}" --model ${WHISPER_MODEL} --language Turkish --output_format srt --output_dir "${SUBTITLE_DIR}"`;

		// Add GPU acceleration
		if (USE_GPU) {
			command += ` --device mps`; // Use 'cuda' for NVIDIA, 'mps' for Apple Silicon
			console.log('🚀 GPU acceleration enabled (Metal Performance Shaders)');
		}

		// Add half-precision for faster processing
		if (FP16) {
			command += ` --fp16 True`;
			console.log('⚡ Half-precision (FP16) enabled');
		}

		// Add threading for preprocessing
		command += ` --threads ${NUM_WORKERS}`;
		console.log(`🧵 Using ${NUM_WORKERS} CPU threads for audio preprocessing`);

		console.log('\nRunning Whisper:', command);
		const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });

		console.log(stdout);
		if (stderr) console.error('Warnings:', stderr);

		// Rename subtitle file if using test clip
		if (TEST_MODE) {
			const testSrtPath = path.join(SUBTITLE_DIR, 'test-clip.srt');
			if (fs.existsSync(testSrtPath)) {
				fs.renameSync(testSrtPath, SUBTITLE_PATH);
			}
		}

		console.log('\n✅ Transcription complete!');
		console.log(`📄 Subtitle file created: ${SUBTITLE_PATH}`);

		if (TEST_MODE) {
			const startMin = Math.floor(TEST_START_TIME / 60);
			const endMin = Math.floor((TEST_START_TIME + TEST_DURATION) / 60);
			console.log(
				`\n⚠️  TEST MODE: Transcribed ${
					TEST_DURATION / 60
				} minutes (${startMin}:00 to ${endMin}:00) using '${WHISPER_MODEL}' model`
			);
			console.log('\n💡 To test different quality levels:');
			console.log('   - Change WHISPER_MODEL to: tiny, base, small, medium, or large');
			console.log('   - Set TEST_MODE = false to transcribe full video');
		}

		console.log(
			'\n⚠️  IMPORTANT: Please review and manually correct the subtitle file before proceeding!'
		);
		console.log('Look for:');
		console.log('- Misspelled Turkish words');
		console.log('- Missing punctuation');
		console.log('- Incorrect timestamps');
		console.log('\n➡️  Next step: Run "npm run process-clips"');
	} catch (error) {
		console.error('❌ Transcription failed:', error.message);

		// Enhanced troubleshooting
		console.log('\nTroubleshooting:');
		console.log('1. Make sure Whisper is installed: pip3 install openai-whisper');
		console.log('2. Make sure FFmpeg is installed: brew install ffmpeg');
		console.log('3. Make sure video file exists at:', VIDEO_PATH);
		console.log('4. Try with smaller model: --model tiny or --model base');
		console.log('5. If GPU fails, set USE_GPU = false to use CPU only');
		console.log('6. Update Whisper for GPU support: pip3 install --upgrade openai-whisper');
		process.exit(1);
	}
}

transcribe();
