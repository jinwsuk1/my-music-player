import express from "express";
import cors from "cors";
import { openDB, createTables } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

// DB 테이블 생성
await createTables();

// 1) 곡 리스트 가져오기
app.get("/songs", async (req, res) => {
  const db = await openDB();
  const songs = await db.all("SELECT * FROM songs");
  res.json(songs);
});

// 2) 곡 추가하기
app.post("/songs", async (req, res) => {
  const { title, artist, file_path } = req.body;
  const db = await openDB();
  await db.run(
    "INSERT INTO songs (title, artist, file_path) VALUES (?, ?, ?)",
    [title, artist, file_path]
  );
  res.json({ message: "Song added!" });
});

app.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});