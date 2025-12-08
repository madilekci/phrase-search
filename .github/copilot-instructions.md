# Turkish Phrase Search - AI Coding Agent Guide

## Project Overview
A video phrase search engine for Turkish TV series (Kurtlar Vadisi). Users search Turkish phrases and watch auto-generated 8-9 second video clips with context.

**Tech Stack**: Node.js (ES modules), Express, SQLite (better-sqlite3), Vanilla JS, FFmpeg, Whisper AI

## Architecture & Data Flow

### Three-Stage Pipeline (Scripts Run Once)
1. **Transcription** (`backend/scripts/1-transcribe.js`) - Whisper CLI generates SRT subtitles from video
2. **Clip Processing** (`backend/scripts/2-process-clips.js`) - FFmpeg cuts video into subtitle-aligned clips
3. **Database Population** (`backend/scripts/3-populate-db.js`) - Reads `clips-metadata.json`, inserts into SQLite

### Runtime Components
- **Backend** (`backend/src/server.js`) - Express serves static frontend + `/api/search` endpoint
- **Database** (`backend/src/db.js`) - SQLite with normalized Turkish text search (case-insensitive, no punctuation)
- **Frontend** (`frontend/`) - Vanilla JS SPA, no build step required

## Critical Conventions

### Turkish Text Normalization
All search queries and database entries are normalized via `normalizeTurkish()`:
```javascript
// Remove punctuation, lowercase, normalize whitespace
text.toLowerCase().replace(/[.,!?;:"']/g, '').replace(/\s+/g, ' ').trim()
```
This function MUST be identical in `2-process-clips.js`, `3-populate-db.js`, and `routes/search.js`.

### File Naming Pattern
Clips: `clip_0001_00-05-23_burada-ne-yapiyorsun.mp4` (index_timestamp_first-5-words)

### ES Modules Throughout
All files use `import`/`export` syntax. `package.json` has `"type": "module"`.

## Key Developer Workflows

### Initial Setup (One-Time)
```bash
# 1. Place video in data/original/ (rename to kurtlar-vadisi-ep1.mp4)
# 2. Run pipeline in order:
npm run transcribe      # 10-20 min, review SRT output manually
npm run process-clips   # 1-2 hours, creates data/clips/ + clips-metadata.json
npm run populate-db     # < 1 min, creates backend/database.db
```

### Daily Development
```bash
npm run dev  # Starts server on port 3000, no build step
```

### Quick Validation
- **Search logic**: Test with Turkish characters (ç, ğ, ı, ö, ş, ü) and punctuation
- **Clip generation**: Use `TEST_MODE = true` and `MAX_TEST_CLIPS = 50` in `2-process-clips.js` to avoid long runs
- **Database**: Query directly with `sqlite3 backend/database.db "SELECT * FROM phrases LIMIT 5"`

## Common Pitfalls

1. **FFmpeg Path Issues**: Clips fail if FFmpeg not in PATH. Verify with `ffmpeg -version`.
2. **CORS Errors**: Frontend assumes `http://localhost:3000`. Change `API_BASE` in `frontend/js/app.js` if server port changes.
3. **Turkish Encoding**: Always use UTF-8. Node.js defaults to UTF-8, but verify SRT files open correctly.
4. **Video Codec**: Clips use H.264 + AAC for browser compatibility. Don't change codec without testing in Safari/Chrome/Firefox.
5. **Sequential Processing**: `2-process-clips.js` processes clips sequentially (not parallel) to avoid overwhelming FFmpeg. Don't parallelize without adding queue logic.

## Current Project State

**Existing**: Video file, `package.json`, implementation guide
**To Build**: All backend scripts, frontend, database setup

### Project Structure Rationale

**Why No `data/` in Git**: Videos and clips are large (~1GB+ per episode). `.gitignore` excludes `data/original/`, `data/clips/`, and `backend/database.db`.

**Why Three Separate Scripts**: Decouples expensive operations. Re-run only the failing stage if transcription/processing errors occur. Allows manual SRT review between stages 1 and 2.

**Why SQLite Not Postgres**: MVP for single-user local use. No concurrent writes. Upgrade to Postgres + full-text search for production.

## Critical Files

- `backend/scripts/2-process-clips.js` - Contains clip duration logic (`MAX_CLIP_DURATION = 9`, `CONTEXT_PADDING = 2`)
- `backend/src/routes/search.js` - Search endpoint with `LIKE` pattern matching (no fuzzy search yet)
- `turkish-phrase-search-implementation-guide.md` - Comprehensive setup guide (1194 lines), read for detailed context

## External Dependencies

- **Whisper** (Python): Installed via `pip3 install openai-whisper`. Uses `small` model for Turkish.
- **FFmpeg**: Homebrew install on macOS. Used for clip extraction and video transcoding.

## Future Improvements (Not Implemented)

- Fuzzy search (Levenshtein distance)
- Turkish stemming (Zemberek NLP library)
- Multi-episode support (requires `episode_id` column)
- Production deployment (needs auth, rate limiting, signed URLs)

## When Editing Code

- **Search changes**: Update normalization in all 3 locations (scripts + routes)
- **Clip logic**: Modify `MAX_CLIP_DURATION` or `CONTEXT_PADDING` in `2-process-clips.js` only
- **API changes**: Frontend has no build step, edit `frontend/js/app.js` directly
- **Database schema**: Drop `backend/database.db` and re-run `npm run populate-db` (no migrations setup)
