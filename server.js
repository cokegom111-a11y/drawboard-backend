import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import crypto from "crypto";

const app = express();
const db = new Database("./drawboard.db");

app.use(cors());
app.use(express.json({ limit: "5mb" }));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  token TEXT
);

CREATE TABLE IF NOT EXISTS boards (
  user_id INTEGER PRIMARY KEY,
  board_json TEXT NOT NULL,
  history_json TEXT NOT NULL,
  last_opened_json TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

const PRIZES = [
  { name: "1등", count: 1 },
  { name: "2등", count: 3 },
  { name: "3등", count: 6 },
  { name: "4등", count: 20 },
  { name: "5등", count: 30 },
];
const TOTAL_CELLS = 520;

function shuffle(array) {
  const copied = [...array];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function createBoard() {
  const raw = [];
  let idx = 1;
  for (const prize of PRIZES) {
    for (let i = 0; i < prize.count; i += 1) {
      raw.push({ drawId: idx, result: prize.name, opened: false });
      idx += 1;
    }
  }
  while (raw.length < TOTAL_CELLS) {
    raw.push({ drawId: idx, result: "", opened: false });
    idx += 1;
  }
  return shuffle(raw).map((item, index) => ({ ...item, slot: index + 1 }));
}

function ensureBoard(userId) {
  const row = db.prepare("SELECT * FROM boards WHERE user_id = ?").get(userId);
  if (row) return row;
  const board = createBoard();
  db.prepare(`INSERT INTO boards (user_id, board_json, history_json, last_opened_json, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(userId, JSON.stringify(board), JSON.stringify([]), null, new Date().toISOString());
  return db.prepare("SELECT * FROM boards WHERE user_id = ?").get(userId);
}

function auth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).send("로그인이 필요합니다.");
  const user = db.prepare("SELECT id, username FROM users WHERE token = ?").get(token);
  if (!user) return res.status(401).send("토큰이 유효하지 않습니다.");
  req.user = user;
  next();
}

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "drawboard backend is running" });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare("SELECT id, username, password FROM users WHERE username = ?").get(username);
  if (!user || user.password !== password) return res.status(401).send("아이디 또는 비밀번호가 틀렸습니다.");
  const token = crypto.randomBytes(24).toString("hex");
  db.prepare("UPDATE users SET token = ? WHERE id = ?").run(token, user.id);
  ensureBoard(user.id);
  res.json({ token, user: { id: user.id, username: user.username } });
});

app.get("/api/board", auth, (req, res) => {
  const row = ensureBoard(req.user.id);
  res.json({
    user: req.user,
    board: JSON.parse(row.board_json),
    history: JSON.parse(row.history_json),
    lastOpened: row.last_opened_json ? JSON.parse(row.last_opened_json) : null,
    updatedAt: row.updated_at
  });
});

app.put("/api/board", auth, (req, res) => {
  const { board, history, lastOpened } = req.body || {};
  db.prepare(`UPDATE boards SET board_json = ?, history_json = ?, last_opened_json = ?, updated_at = ? WHERE user_id = ?`)
    .run(JSON.stringify(board || []), JSON.stringify(history || []), lastOpened ? JSON.stringify(lastOpened) : null, new Date().toISOString(), req.user.id);
  res.json({ ok: true });
});

app.post("/api/board/new", auth, (req, res) => {
  const board = createBoard();
  db.prepare(`UPDATE boards SET board_json = ?, history_json = ?, last_opened_json = ?, updated_at = ? WHERE user_id = ?`)
    .run(JSON.stringify(board), JSON.stringify([]), null, new Date().toISOString(), req.user.id);
  res.json({ ok: true, board, history: [], lastOpened: null });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`drawboard backend listening on ${PORT}`);
});
