# Turkish Series Phrase Search - Complete Implementation Guide

## Project Overview
A minimal web app to search for phrases in Kurtlar Vadisi Episode 1 and watch 8-9 second video clips.

**Tech Stack**: Node.js, Express, SQLite, Vanilla JavaScript, FFmpeg, faster-whisper

**⚠️ IMPLEMENTATION APPROACH**: We will verify each step works before proceeding to the next.

---

## Project Structure

```
turkish-phrase-search/
├── package.json
├── README.md
├── .gitignore
├── backend/
│   ├── scripts/
│   │   ├── 1-transcribe.js        # Generate subtitles with faster-whisper
│   │   ├── 2-process-clips.js     # Cut video into clips based on subtitles
│   │   └── 3-populate-db.js       # Insert phrases into database
│   ├── src/
│   │   ├── server.js              # Express server
│   │   ├── db.js                  # SQLite database setup
│   │   └── routes/
│   │       └── search.js          # Search API routes
│   └── database.db                # SQLite database (generated)
├── frontend/
│   ├── index.html                 # Main UI
│   ├── js/
│   │   └── app.js                 # Search and video playback logic
│   └── css/
│       └── style.css              # Styling
└── data/
    ├── original/
    │   └── kurtlar-vadisi-ep1.mp4 # Your video file (PUT THIS HERE)
    ├── subtitles/
    │   └── kurtlar-vadisi-ep1.srt # Generated subtitles (review & fix)
    └── clips/                      # Generated video clips (auto-created)
```

---

## Prerequisites & Dependencies

### System Requirements
```bash
# Install Node.js (v18+)
# Already installed on your Mac

# Install FFmpeg (macOS)
brew install ffmpeg

# Install Python 3.8+ (macOS)
brew install python3

# Install faster-whisper (macOS)
pip3 install faster-whisper

# Verify installations
python3 --version
ffmpeg -version
python3 -c "from faster_whisper import WhisperModel; print('faster-whisper installed successfully')"
```

### Node.js Dependencies
```json
{
  "name": "turkish-phrase-search",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "transcribe": "node backend/scripts/1-transcribe.js",
    "process-clips": "node backend/scripts/2-process-clips.js",
    "populate-db": "node backend/scripts/3-populate-db.js",
    "dev": "node backend/src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.2.2",
    "cors": "^2.8.5",
    "fluent-ffmpeg": "^2.1.2",
    "subtitle": "^4.2.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

---

## Step-by-Step Implementation

## STEP 1: Project Setup

### 1.1 Initialize Project
```bash
cd /Users/madilekci/Documents/GitHub/phrase-search
npm init -y
npm install express better-sqlite3 cors fluent-ffmpeg subtitle
```

### 1.2 Create Directory Structure
```bash
mkdir -p backend/scripts backend/src/routes frontend/js frontend/css data/original data/subtitles data/clips
```

### 1.3 Create .gitignore
```
node_modules/
data/original/*.mp4
data/clips/
backend/database.db
.DS_Store
*.log
```

---

## STEP 2: Transcription Script

### File: `backend/scripts/1-transcribe.js`

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIDEO_PATH = path.join(__dirname, '../../data/original/kurtlar-vadisi-ep1.mp4');
const SUBTITLE_PATH = path.join(__dirname, '../../data/subtitles/kurtlar-vadisi-ep1.srt');

async function transcribe() {
  console.log('🎬 Starting transcription with faster-whisper...');
  console.log('This may take 5-15 minutes for a 40-minute episode (much faster than openai-whisper!).\n');

  try {
    // Create a temporary Python script to run faster-whisper
    const pythonScript = `
from faster_whisper import WhisperModel
import sys

model_size = "large-v3"
model = WhisperModel(model_size, device="cpu", compute_type="int8")

segments, info = model.transcribe("${VIDEO_PATH}", language="tr", beam_size=5)

print(f"Detected language '{info.language}' with probability {info.language_probability}")

# Generate SRT format
srt_content = []
segment_id = 1

for segment in segments:
    start_time = segment.start
    end_time = segment.end
    text = segment.text.strip()

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

# Write SRT file
with open("${SUBTITLE_PATH}", "w", encoding="utf-8") as f:
    f.write("\\n".join(srt_content))

print(f"\\nTranscription complete! Saved to ${SUBTITLE_PATH}")
`;

    const tempScriptPath = path.join(__dirname, '../../data/temp/transcribe.py');

    // Ensure temp directory exists
    const tempDir = path.dirname(tempScriptPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Write Python script
    fs.writeFileSync(tempScriptPath, pythonScript);

    console.log('Running faster-whisper transcription...');
    console.log('Model: large-v3 (best quality for Turkish)');
    console.log('Device: CPU with int8 quantization (optimized for speed)\n');

    const { stdout, stderr } = await execAsync(`python3 "${tempScriptPath}"`, {
      maxBuffer: 10 * 1024 * 1024
    });

    console.log(stdout);
    if (stderr) console.error('Warnings:', stderr);

    // Clean up temp script
    fs.unlinkSync(tempScriptPath);

    console.log('\n✅ Transcription complete!');
    console.log(`📄 Subtitle file created: ${SUBTITLE_PATH}`);
    console.log('\n⚠️  IMPORTANT: Please review and manually correct the subtitle file before proceeding!');
    console.log('Look for:');
    console.log('- Misspelled Turkish words');
    console.log('- Missing punctuation');
    console.log('- Incorrect timestamps');

  } catch (error) {
    console.error('❌ Transcription failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure faster-whisper is installed: pip3 install faster-whisper');
    console.log('2. Make sure video file exists at:', VIDEO_PATH);
    console.log('3. For GPU support, install: pip3 install faster-whisper[cuda]');
    console.log('4. Try smaller model: change model_size to "medium" or "small"');
  }
}

transcribe();
```

### Run Transcription
```bash
npm run transcribe
```

**After running**:
1. Open `data/subtitles/kurtlar-vadisi-ep1.srt`
2. Manually review and fix any errors
3. Save the corrected file

---

## STEP 3: Clip Processing Script

### File: `backend/scripts/2-process-clips.js`

```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import { parseSync } from 'subtitle';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIDEO_PATH = path.join(__dirname, '../../data/original/kurtlar-vadisi-ep1.mp4');
const SUBTITLE_PATH = path.join(__dirname, '../../data/subtitles/kurtlar-vadisi-ep1.srt');
const CLIPS_DIR = path.join(__dirname, '../../data/clips');

// Configuration
const MAX_CLIP_DURATION = 9; // Maximum 9 seconds
const CONTEXT_PADDING = 2;   // Add 2 seconds before and after phrase
const TEST_MODE = true;      // Set to true to process only first N clips
const MAX_TEST_CLIPS = 50;   // Number of clips to process in test mode

function parseSubtitles() {
  console.log('📖 Reading subtitle file...');
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
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function createClip(subtitle, index) {
  return new Promise((resolve, reject) => {
    const startMs = subtitle.start;
    const endMs = subtitle.end;
    const durationMs = endMs - startMs;

    // Calculate clip boundaries with context
    let clipStartMs = Math.max(0, startMs - (CONTEXT_PADDING * 1000));
    let clipEndMs = endMs + (CONTEXT_PADDING * 1000);

    // Ensure max duration
    if ((clipEndMs - clipStartMs) > MAX_CLIP_DURATION * 1000) {
      clipEndMs = clipStartMs + (MAX_CLIP_DURATION * 1000);
    }

    const clipDuration = (clipEndMs - clipStartMs) / 1000;
    const startTime = msToTime(clipStartMs);

    // Create safe filename
    const text = subtitle.text.replace(/<[^>]*>/g, '').trim(); // Remove HTML tags
    const safeText = text
      .toLowerCase()
      .replace(/[^a-zçğıöşü0-9\s]/gi, '')
      .split(/\s+/)
      .slice(0, 5)
      .join('-')
      .substring(0, 50);

    const timestamp = msToTime(startMs).replace(/:/g, '-');
    const filename = `clip_${String(index).padStart(4, '0')}_${timestamp}_${safeText}.mp4`;
    const outputPath = path.join(CLIPS_DIR, filename);

    console.log(`⏳ [${index}/${totalSubtitles}] Creating clip: ${startTime} (${clipDuration.toFixed(1)}s)`);
    console.log(`   Text: "${text}"`);

    ffmpeg(VIDEO_PATH)
      .setStartTime(clipStartMs / 1000)
      .setDuration(clipDuration)
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .size('640x?') // Reduce size for faster processing
      .on('end', () => {
        console.log(`✅ Created: ${filename}\n`);
        resolve({
          filename,
          text,
          start_time: msToTime(startMs),
          end_time: msToTime(endMs),
          clip_duration: clipDuration
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

  // Create clips directory
  if (!fs.existsSync(CLIPS_DIR)) {
    fs.mkdirSync(CLIPS_DIR, { recursive: true });
  }

  // Parse subtitles
  const subtitles = parseSubtitles();
  global.totalSubtitles = subtitles.length;

  // Process clips sequentially to avoid overwhelming the system
  const clipData = [];
  for (let i = 0; i < subtitles.length; i++) {
    try {
      // Skip to next if in test mode and limit reached
      if (TEST_MODE && i >= MAX_TEST_CLIPS) {
        console.log(`\n⚠️ Test mode active. Processed ${MAX_TEST_CLIPS} clips. Skipping to database population...`);
        break;
      }

      const data = await createClip(subtitles[i], i + 1);
      clipData.push(data);
    } catch (error) {
      console.error(`Failed to process clip ${i + 1}, continuing...`);
    }
  }

  // Save clip metadata
  const metadataPath = path.join(__dirname, '../../data/clips-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(clipData, null, 2));

  console.log('\n✅ All clips processed!');
  console.log(`📊 Total clips created: ${clipData.length}`);
  console.log(`📁 Clips directory: ${CLIPS_DIR}`);
  console.log(`📄 Metadata saved: ${metadataPath}`);
  console.log('\n➡️  Next step: Run "npm run populate-db" to create the database');
}

processClips().catch(console.error);
```

### Run Clip Processing
```bash
npm run process-clips
```

**Note**: This will take 1-2 hours depending on your computer. It creates one 8-9 second clip for each subtitle line.

---

## STEP 4: Database Setup

### File: `backend/src/db.js`

```javascript
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../database.db');

const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS phrases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    text_normalized TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    clip_filename TEXT NOT NULL,
    clip_duration REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_text_normalized ON phrases(text_normalized);
  CREATE INDEX IF NOT EXISTS idx_text ON phrases(text);
`);

console.log('✅ Database initialized');

export default db;
```

### File: `backend/scripts/3-populate-db.js`

```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metadataPath = path.join(__dirname, '../../data/clips-metadata.json');

function normalizeTurkish(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"']/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim();
}

function populateDatabase() {
  console.log('📚 Populating database with clip data...\n');

  // Read metadata
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

  // Prepare insert statement
  const insert = db.prepare(`
    INSERT INTO phrases (text, text_normalized, start_time, end_time, clip_filename, clip_duration)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Insert all clips
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
```

### Run Database Population
```bash
npm run populate-db
```

---

## STEP 5: Backend API

### File: `backend/src/routes/search.js`

```javascript
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

// Search endpoint
router.get('/search', (req, res) => {
  const query = req.query.q;

  if (!query || query.trim().length < 2) {
    return res.json({ results: [], message: 'Query too short' });
  }

  const normalizedQuery = normalizeTurkish(query);
  const searchPattern = `%${normalizedQuery}%`;

  // Search for phrases containing the query
  const results = db.prepare(`
    SELECT id, text, start_time, end_time, clip_filename, clip_duration
    FROM phrases
    WHERE text_normalized LIKE ?
    ORDER BY id
    LIMIT 50
  `).all(searchPattern);

  res.json({
    results,
    count: results.length,
    query: query
  });
});

// Get specific clip info
router.get('/clip/:id', (req, res) => {
  const clip = db.prepare(`
    SELECT * FROM phrases WHERE id = ?
  `).get(req.params.id);

  if (!clip) {
    return res.status(404).json({ error: 'Clip not found' });
  }

  res.json(clip);
});

// Stats endpoint
router.get('/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_phrases,
      SUM(clip_duration) as total_duration
    FROM phrases
  `).get();

  res.json(stats);
});

export default router;
```

### File: `backend/src/server.js`

```javascript
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import searchRoutes from './routes/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../../frontend')));

// Serve video clips
app.use('/clips', express.static(path.join(__dirname, '../../data/clips')));

// API routes
app.use('/api', searchRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📺 Open your browser and start searching!\n`);
});
```

---

## STEP 6: Frontend

### File: `frontend/index.html`

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kurtlar Vadisi - Cümle Ara</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>🐺 Kurtlar Vadisi</h1>
      <p class="subtitle">Bölüm 1 - Cümle Arama</p>
    </header>

    <div class="search-section">
      <div class="search-box">
        <input
          type="text"
          id="searchInput"
          placeholder="Bir cümle veya kelime yazın... (örn: 'ne yapıyorsun')"
          autocomplete="off"
        >
        <button id="searchButton">🔍 Ara</button>
      </div>
      <div id="searchInfo" class="search-info"></div>
    </div>

    <div id="videoSection" class="video-section hidden">
      <video id="videoPlayer" controls>
        <source id="videoSource" type="video/mp4">
        Tarayıcınız video oynatmayı desteklemiyor.
      </video>
      <div class="video-info">
        <p id="currentPhrase" class="current-phrase"></p>
        <p id="timestamp" class="timestamp"></p>
      </div>
    </div>

    <div id="results" class="results"></div>

    <div id="loading" class="loading hidden">
      <div class="spinner"></div>
      <p>Aranıyor...</p>
    </div>

    <footer>
      <p>Toplam kayıtlı cümle: <span id="statsTotal">-</span> |
         Toplam süre: <span id="statsDuration">-</span></p>
    </footer>
  </div>

  <script src="js/app.js"></script>
</body>
</html>
```

### File: `frontend/css/style.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  min-height: 100vh;
  padding: 20px;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
}

header {
  text-align: center;
  margin-bottom: 40px;
  padding: 20px;
}

header h1 {
  font-size: 3em;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

.subtitle {
  font-size: 1.2em;
  color: #a8a8a8;
}

.search-section {
  margin-bottom: 30px;
}

.search-box {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

#searchInput {
  flex: 1;
  padding: 15px 20px;
  font-size: 1.1em;
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  background: #2a2a3e;
  color: #fff;
  outline: none;
  transition: border-color 0.3s;
}

#searchInput:focus {
  border-color: #5c7cfa;
}

#searchButton {
  padding: 15px 30px;
  font-size: 1.1em;
  background: #5c7cfa;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
}

#searchButton:hover {
  background: #4c6cef;
}

.search-info {
  text-align: center;
  color: #a8a8a8;
  font-size: 0.9em;
}

.video-section {
  background: #2a2a3e;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 30px;
}

.video-section.hidden {
  display: none;
}

#videoPlayer {
  width: 100%;
  max-height: 500px;
  border-radius: 8px;
  background: #000;
}

.video-info {
  margin-top: 15px;
  padding: 15px;
  background: #1a1a2e;
  border-radius: 8px;
}

.current-phrase {
  font-size: 1.3em;
  margin-bottom: 8px;
  color: #5c7cfa;
}

.timestamp {
  color: #a8a8a8;
  font-size: 0.9em;
}

.results {
  display: grid;
  gap: 15px;
}

.result-item {
  background: #2a2a3e;
  padding: 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.result-item:hover {
  background: #343449;
  border-color: #5c7cfa;
  transform: translateY(-2px);
}

.result-item .text {
  font-size: 1.1em;
  margin-bottom: 8px;
}

.result-item .meta {
  color: #a8a8a8;
  font-size: 0.85em;
}

.loading {
  text-align: center;
  padding: 40px;
}

.loading.hidden {
  display: none;
}

.spinner {
  border: 4px solid #2a2a3e;
  border-top: 4px solid #5c7cfa;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

footer {
  text-align: center;
  margin-top: 40px;
  padding: 20px;
  color: #a8a8a8;
  font-size: 0.9em;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #a8a8a8;
}

.empty-state .icon {
  font-size: 4em;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  header h1 {
    font-size: 2em;
  }

  .search-box {
    flex-direction: column;
  }

  #searchButton {
    width: 100%;
  }
}
```

### File: `frontend/js/app.js`

```javascript
const API_BASE = 'http://localhost:3000/api';

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const videoSection = document.getElementById('videoSection');
const videoPlayer = document.getElementById('videoPlayer');
const videoSource = document.getElementById('videoSource');
const currentPhrase = document.getElementById('currentPhrase');
const timestamp = document.getElementById('timestamp');
const searchInfo = document.getElementById('searchInfo');
const statsTotal = document.getElementById('statsTotal');
const statsDuration = document.getElementById('statsDuration');

// Load stats on page load
async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/stats`);
    const stats = await response.json();
    statsTotal.textContent = stats.total_phrases;
    statsDuration.textContent = `${(stats.total_duration / 60).toFixed(1)} dakika`;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// Search function
async function search(query) {
  if (!query || query.trim().length < 2) {
    searchInfo.textContent = 'Lütfen en az 2 karakter girin';
    return;
  }

  // Show loading
  loadingDiv.classList.remove('hidden');
  resultsDiv.innerHTML = '';
  searchInfo.textContent = '';
  videoSection.classList.add('hidden');

  try {
    const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    loadingDiv.classList.add('hidden');

    if (data.results.length === 0) {
      resultsDiv.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔍</div>
          <h2>Sonuç bulunamadı</h2>
          <p>"${query}" için hiçbir cümle bulunamadı</p>
        </div>
      `;
      return;
    }

    searchInfo.textContent = `${data.count} sonuç bulundu`;
    displayResults(data.results);

  } catch (error) {
    loadingDiv.classList.add('hidden');
    resultsDiv.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h2>Hata</h2>
        <p>Arama yapılırken bir hata oluştu</p>
      </div>
    `;
    console.error('Search error:', error);
  }
}

// Display results
function displayResults(results) {
  resultsDiv.innerHTML = '';

  results.forEach((result, index) => {
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';
    resultItem.innerHTML = `
      <div class="text">${result.text}</div>
      <div class="meta">
        ⏱️ ${result.start_time} - ${result.end_time}
        (${result.clip_duration.toFixed(1)}s)
      </div>
    `;

    resultItem.addEventListener('click', () => {
      playClip(result);
    });

    resultsDiv.appendChild(resultItem);
  });
}

// Play video clip
function playClip(clip) {
  videoSection.classList.remove('hidden');
  videoSource.src = `/clips/${clip.clip_filename}`;
  videoPlayer.load();
  videoPlayer.play();

  currentPhrase.textContent = `"${clip.text}"`;
  timestamp.textContent = `⏱️ ${clip.start_time} - ${clip.end_time}`;

  // Scroll to video
  videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Event listeners
searchButton.addEventListener('click', () => {
  search(searchInput.value);
});

searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    search(searchInput.value);
  }
});

// Load stats on page load
loadStats();

console.log('🐺 Kurtlar Vadisi Phrase Search initialized');
```

---

## STEP 7: Usage Guide

### First Time Setup (One-time)

```bash
# 1. Clone or create the project
cd turkish-phrase-search

# 2. Install dependencies
npm install

# 3. Put your video file in data/original/
# Name it: kurtlar-vadisi-ep1.mp4

# 4. Generate subtitles (10-20 minutes)
npm run transcribe

# 5. Review and fix subtitles manually
# Edit: data/subtitles/kurtlar-vadisi-ep1.srt

# 6. Process video into clips (1-2 hours)
npm run process-clips

# 7. Populate database
npm run populate-db

# 8. Start the server
npm run dev
```

### Daily Usage

```bash
# Just start the server
npm run dev

# Open browser
# Go to: http://localhost:3000
```

---

## Testing Checklist

- [ ] Video file placed in `data/original/` folder
- [ ] faster-whisper installed (`pip3 install faster-whisper`)
- [ ] FFmpeg installed (`brew install ffmpeg`)
- [ ] Node.js dependencies installed (`npm install`)
- [ ] Subtitles generated and reviewed
- [ ] Clips processed successfully (check `data/clips/` folder)
- [ ] Database populated (check `backend/database.db` exists)
- [ ] Server starts without errors
- [ ] Can access http://localhost:3000 in browser
- [ ] Search returns results
- [ ] Video clips play correctly
- [ ] Search is case-insensitive and handles Turkish characters

---

## Troubleshooting

### faster-whisper Installation Issues
```bash
# If faster-whisper fails to install
pip3 install --upgrade pip
pip3 install faster-whisper --no-cache-dir

# For GPU support (NVIDIA)
pip3 install faster-whisper[cuda]

# Or use conda
conda install -c conda-forge faster-whisper
```

### FFmpeg Issues
```bash
# Test if FFmpeg is installed
ffmpeg -version

# Install on macOS
brew install ffmpeg

# Install on Ubuntu/Debian
sudo apt install ffmpeg
```

### Video Not Playing
- Check if clip files exist in `data/clips/`
- Check browser console for errors
- Try a different browser
- Verify video codec compatibility

### Search Not Working
- Check if database.db exists
- Check server logs for errors
- Verify API endpoint: http://localhost:3000/api/stats

### Slow Performance
- Reduce video quality in `2-process-clips.js` (change `.size('640x?')` to `.size('480x?')`)
- Process fewer clips for testing (modify script to skip some)
- Use SSD instead of HDD for `data/clips/` folder

---

## Optimization Tips (Future Improvements)

### For Better Performance
1. **Lazy Loading**: Load clips on-demand instead of pre-generating all
2. **Caching**: Add Redis for search result caching
3. **Compression**: Use H.265 codec for smaller file sizes
4. **CDN**: Use Cloudflare for faster clip delivery

### For Better Search
1. **Elasticsearch**: Replace SQLite with Elasticsearch for advanced search
2. **Fuzzy Matching**: Implement Levenshtein distance for typo tolerance
3. **Turkish Stemming**: Use Zemberek for better word root matching
4. **Autocomplete**: Add search suggestions as user types

### For Better UX
1. **Keyboard Shortcuts**: Space = play/pause, Arrow keys = next/prev result
2. **Favorites**: Let users save favorite clips
3. **Share Links**: Generate shareable URLs for specific clips
4. **Mobile App**: Build React Native app

---

## Adding More Episodes/Series

To add Episode 2 or new series:

1. Add video file: `data/original/kurtlar-vadisi-ep2.mp4`
2. Update scripts to accept filename as parameter
3. Run transcription: `npm run transcribe -- ep2`
4. Review subtitles
5. Process clips: `npm run process-clips -- ep2`
6. Populate database: `npm run populate-db -- ep2`

Modify scripts to handle multiple episodes:
- Add episode_id column to database
- Update search to filter by episode/series
- Add dropdown in frontend to select episode

---

## Estimated Resource Requirements

### Storage
- Original video: ~500MB - 1GB per episode
- Generated clips: ~200-400MB per episode
- Subtitles: ~50KB per episode
- Total per episode: **~1-1.5GB**

### Processing Time (for 40-min episode)
- Transcription: 10-20 minutes (depends on CPU)
- Clip generation: 60-120 minutes (depends on CPU/GPU)
- Database population: < 1 minute

### Memory Usage
- Node.js server: ~50-100MB
- Browser: ~100-200MB
- FFmpeg during processing: ~500MB-1GB

---

## Security Considerations

### For Local Testing
- No authentication needed
- CORS enabled for localhost

### For Production Deployment
- [ ] Add authentication (JWT or session-based)
- [ ] Rate limiting on search API
- [ ] HTTPS only
- [ ] Environment variables for sensitive config
- [ ] Secure video URLs (signed URLs or tokens)
- [ ] Input sanitization for search queries

---

## License & Copyright Notice

⚠️ **Important Legal Notice**

This project is for **personal/educational use only**.

- You do NOT have distribution rights for the video content
- Kurtlar Vadisi is copyrighted material
- Do NOT deploy publicly without proper licensing
- Keep clips under 9 seconds to stay within fair use guidelines
- Do NOT monetize or commercialize this project

**Recommended Use Cases**:
- Personal language learning
- Private family/friend sharing
- Educational research
- Portfolio demonstration (with disclaimer)

---

## Next Steps After MVP

1. **Test with real users** - Get feedback on search quality
2. **Improve transcription** - Manually fix common errors
3. **Add more episodes** - Scale to full season
4. **Better search** - Implement fuzzy matching
5. **Mobile responsive** - Optimize for phone/tablet
6. **Add features** - Favorites, share links, random clip

---

## Support & Resources

### Helpful Links
- [faster-whisper Documentation](https://github.com/SYSTRAN/faster-whisper)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Better SQLite3 Docs](https://github.com/WiseLibs/better-sqlite3)
- [Express.js Guide](https://expressjs.com/)

### Turkish NLP Resources
- [Zemberek NLP](https://github.com/ahmetaa/zemberek-nlp)
- [Turkish Stopwords](https://github.com/stopwords-iso/stopwords-tr)
- [OpenSubtitles Turkish](https://www.opensubtitles.org/tr)

---

## Success Criteria

Your MVP is complete when:
- ✅ You can search for any phrase (e.g., "ne yapıyorsun")
- ✅ Results show up in < 2 seconds
- ✅ Clicking a result plays the 8-9 second clip
- ✅ Video plays smoothly without buffering
- ✅ Search handles Turkish characters correctly (ç, ğ, ı, ö, ş, ü)
- ✅ At least 200+ searchable phrases

---

**Good luck with your project! 🐺🎬**

*Last updated: December 7, 2025*
