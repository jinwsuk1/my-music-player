import express from "express";
import cors from "cors";
import { createTables } from "./db.js";
import songsRouter from "./routes/songs.js";

const app = express();
app.use(cors());
app.use(express.json());

await createTables(); // DB 초기화

app.use("/songs", songsRouter); // 곡 관련 API 연결

app.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});