import Database from "better-sqlite3";

const db = new Database("./drawboard.db");

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

const defaults = ["user1", "user2", "user3", "user4", "user5"];
const insert = db.prepare("INSERT OR IGNORE INTO users (username, password, token) VALUES (?, ?, NULL)");
for (const username of defaults) insert.run(username, "1234");
console.log("기본 사용자 5개 생성 완료: user1 ~ user5 / 비밀번호 1234");
