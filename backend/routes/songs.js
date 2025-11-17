// routes/songs.js
import express from "express";
import { openDB } from "../db.js";

const router = express.Router();

// GET /songs
router.get("/", async (req, res) => {
  const db = await openDB();
  const songs = await db.all("SELECT * FROM songs");
  res.json(songs);
});

// POST /songs
router.post("/", async (req, res) => {
  const { title, artist, file_path } = req.body;
  const db = await openDB();
  await db.run(
    "INSERT INTO songs (title, artist, file_path) VALUES (?, ?, ?)",
    [title, artist, file_path]
  );
  res.json({ message: "Song added!" });
});

// PUT /songs/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, artist, file_path } = req.body;
  const db = await openDB();
  await db.run(
    "UPDATE songs SET title = ?, artist = ?, file_path = ? WHERE id = ?",
    [title, artist, file_path, id]
  );
  res.json({ message: "Song updated!" });
});

// DELETE /songs/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const db = await openDB();
  await db.run("DELETE FROM songs WHERE id = ?", [id]);
  res.json({ message: "Song deleted!" });
});

export default router;