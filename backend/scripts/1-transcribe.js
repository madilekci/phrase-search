import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
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
const TEST_START_TIME = 120; // Start at 2:00 (2 minutes * 60 seconds)
const TEST_DURATION = 600; // Extract 10 minutes (from 2:00 to 12:00)

// faster-whisper Configuration - M1 Pro Optimized
const WHISPER_MODEL = 'large-v3'; // Options: tiny, base, small, medium, large-v2, large-v3
const USE_GPU = false; // Set to true for CUDA GPU acceleration (requires NVIDIA GPU)
const COMPUTE_TYPE = 'int8'; // Options: int8, float16, float32 (int8 is fastest for CPU)
const BEAM_SIZE = 10; // Higher = more accurate but slower (1-10, default: 5)
const NUM_WORKERS = 8; // M1 Pro has 8-10 cores, use 8 for optimal performance
const VAD_THRESHOLD = 0.3; // Voice Activity Detection threshold (0.0-1.0, higher = more aggressive silence skipping)
const MIN_SILENCE_DURATION = 500; // Minimum silence duration in ms to skip (lower = faster but may cut speech)

async function transcribe() {
	console.log('🎬 Starting transcription with faster-whisper...');
	console.log(`📊 Model: ${WHISPER_MODEL}`);
	console.log(`🖥️  Device: ${USE_GPU ? 'GPU (CUDA)' : 'CPU (Apple M1 Pro optimized)'}`);
	console.log(`⚡ Compute Type: ${COMPUTE_TYPE}`);
	console.log(`🎯 Beam Size: ${BEAM_SIZE}`);
	console.log(`👷 Workers: ${NUM_WORKERS} (parallel processing)`);
	console.log(`🔇 VAD Threshold: ${VAD_THRESHOLD} (silence detection)`);

	if (TEST_MODE) {
		const startMin = Math.floor(TEST_START_TIME / 60);
		const endMin = Math.floor((TEST_START_TIME + TEST_DURATION) / 60);
		console.log(
			`\n⚠️  TEST MODE: Transcribing ${
				TEST_DURATION / 60
			} minutes (${startMin}:00 to ${endMin}:00)`
		);
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

		// Create Python script for faster-whisper
		const pythonScript = `
from faster_whisper import WhisperModel
import sys
import os
import time
from datetime import datetime

# Configuration
model_size = "${WHISPER_MODEL}"
device = "${USE_GPU ? 'cuda' : 'cpu'}"
compute_type = "${COMPUTE_TYPE}"
beam_size = ${BEAM_SIZE}
num_workers = ${NUM_WORKERS}
vad_threshold = ${VAD_THRESHOLD}
min_silence_duration = ${MIN_SILENCE_DURATION}

video_path = """${videoToTranscribe}"""
subtitle_path = """${SUBTITLE_PATH}"""

print(f"Loading model: {model_size}")
print(f"Device: {device}, Compute type: {compute_type}")
print(f"Workers: {num_workers}, VAD threshold: {vad_threshold}\\n")

try:
    # Load model
    model = WhisperModel(model_size, device=device, compute_type=compute_type, num_workers=num_workers)

    # Transcribe
    print(f"🕐 Start Time: {datetime.now().strftime('%H:%M:%S')}")
    print("Starting transcription...\\n")

    transcription_start = time.time()
    segments, info = model.transcribe(
        video_path,
        language="tr",  # Turkish
        beam_size=beam_size,
        vad_filter=True,  # Voice Activity Detection - skip silence
        vad_parameters=dict(
            threshold=vad_threshold,
            min_silence_duration_ms=min_silence_duration
        ),
        word_timestamps=False,  # Disable for faster processing
        condition_on_previous_text=True  # Better accuracy for conversational content
    )

    print(f"Detected language: '{info.language}' (probability: {info.language_probability:.2f})")
    print(f"Duration: {info.duration:.1f} seconds\\n")

    # Generate SRT format with progress
    print("Generating SRT file...")
    srt_content = []
    segment_id = 1
    total_duration = info.duration
    last_progress = 0

    for segment in segments:
        start_time = segment.start
        end_time = segment.end
        text = segment.text.strip()

        # Show progress every 10%
        progress = int((end_time / total_duration) * 100)
        if progress >= last_progress + 10 and progress <= 100:
            elapsed = time.time() - transcription_start
            print(f"⏳ Progress: {progress}% ({int(end_time)}/{int(total_duration)}s) - Elapsed: {elapsed:.1f}s")
            last_progress = progress

        # Convert seconds to SRT time format (HH:MM:SS,mmm)
        def format_timestamp(seconds):
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millis = int((seconds % 1) * 1000)
            return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

        srt_content.append(str(segment_id))
        srt_content.append(f"{format_timestamp(start_time)} --> {format_timestamp(end_time)}")
        srt_content.append(text)
        srt_content.append("")
        segment_id += 1

    transcription_end = time.time()
    total_time = transcription_end - transcription_start

    # Write SRT file
    os.makedirs(os.path.dirname(subtitle_path), exist_ok=True)
    with open(subtitle_path, "w", encoding="utf-8") as f:
        f.write("\\n".join(srt_content))

    print(f"\\n✓ Transcription complete!")
    print(f"✓ Total segments: {segment_id - 1}")
    print(f"✓ Saved to: {subtitle_path}")
    print(f"🕐 End Time: {datetime.now().strftime('%H:%M:%S')}")
    print(f"⏱️  Processing Time: {total_time:.1f} seconds")

except Exception as e:
    print(f"\\n✗ Error: {e}", file=sys.stderr)
    sys.exit(1)
`;

		const tempScriptPath = path.join(TEMP_DIR, 'transcribe_faster_whisper.py');

		// Write Python script
		console.log('📝 Creating Python transcription script...');
		fs.writeFileSync(tempScriptPath, pythonScript);

		console.log('🚀 Running faster-whisper transcription...\n');
		const startTime = Date.now();

		// Use conda Python explicitly (faster-whisper is installed in conda base environment)
		const pythonCommand = '/opt/anaconda3/bin/python3';

		// Use spawn instead of exec for real-time output streaming
		await new Promise((resolve, reject) => {
			const pythonProcess = spawn(pythonCommand, [tempScriptPath]);

			// Stream stdout in real-time
			pythonProcess.stdout.on('data', (data) => {
				process.stdout.write(data.toString());
			});

			// Stream stderr in real-time
			pythonProcess.stderr.on('data', (data) => {
				process.stderr.write(data.toString());
			});

			// Handle process completion
			pythonProcess.on('close', (code) => {
				if (code !== 0) {
					reject(new Error(`Python process exited with code ${code}`));
				} else {
					resolve();
				}
			});

			// Handle process errors
			pythonProcess.on('error', (error) => {
				reject(error);
			});
		});

		const duration = ((Date.now() - startTime) / 1000).toFixed(1);

		// Clean up temp script
		fs.unlinkSync(tempScriptPath);

		// Clean up test clip if it exists
		if (TEST_MODE) {
			const testClipPath = path.join(TEMP_DIR, 'test-clip.mp4');
			if (fs.existsSync(testClipPath)) {
				fs.unlinkSync(testClipPath);
			}
		}

		console.log(`\n⏱️  Total time: ${duration} seconds`);
		console.log(`📄 Subtitle file: ${SUBTITLE_PATH}`);

		if (TEST_MODE) {
			const startMin = Math.floor(TEST_START_TIME / 60);
			const endMin = Math.floor((TEST_START_TIME + TEST_DURATION) / 60);
			console.log(
				`\n⚠️  TEST MODE: Transcribed ${
					TEST_DURATION / 60
				} minutes (${startMin}:00 to ${endMin}:00)`
			);
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
		process.exit(1);
	}
}

transcribe();
