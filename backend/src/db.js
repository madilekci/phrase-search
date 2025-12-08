import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../database.db');

const db = new Database(dbPath);

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
