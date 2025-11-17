import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function openDB() {
  return open({
    filename: './music.db',
    driver: sqlite3.Database
  });
}

export async function createTables() {
  const db = await openDB();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      artist TEXT,
      file_path TEXT
    )
  `);
}
