import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getMergedRuntimeConfig } from "@/lib/runtime-config";

export type SessionSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
};

export type ChatMessageRecord = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type StorageStats = {
  dbPath: string;
  sessionCount: number;
  messageCount: number;
};

let cachedDbPath = "";
let cachedDb: Database.Database | null = null;

function ensureTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
      ON chat_messages(session_id, created_at);
  `);
}

async function getDb() {
  const runtime = await getMergedRuntimeConfig();
  const dbPath = path.resolve(runtime.LOCAL_DB_PATH);

  if (cachedDb && cachedDbPath === dbPath) {
    return { db: cachedDb, dbPath };
  }

  if (cachedDb) {
    cachedDb.close();
    cachedDb = null;
  }

  const dir = path.dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureTables(db);

  cachedDb = db;
  cachedDbPath = dbPath;
  return { db, dbPath };
}

export async function createSession(title = "新对话"): Promise<SessionSummary> {
  const { db } = await getDb();
  const now = Date.now();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`
  ).run(id, title, now, now);

  return { id, title, createdAt: now, updatedAt: now, messageCount: 0 };
}

export async function listSessions(limit = 100): Promise<SessionSummary[]> {
  const { db } = await getDb();

  const rows = db
    .prepare(
      `SELECT
         s.id,
         s.title,
         s.created_at as createdAt,
         s.updated_at as updatedAt,
         COUNT(m.id) as messageCount
       FROM chat_sessions s
       LEFT JOIN chat_messages m ON m.session_id = s.id
       GROUP BY s.id
       ORDER BY s.updated_at DESC
       LIMIT ?`
    )
    .all(limit) as SessionSummary[];

  return rows;
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessageRecord[]> {
  const { db } = await getDb();

  const rows = db
    .prepare(
      `SELECT id, session_id as sessionId, role, content, created_at as createdAt
       FROM chat_messages
       WHERE session_id = ?
       ORDER BY created_at ASC`
    )
    .all(sessionId) as ChatMessageRecord[];

  return rows;
}

export async function appendMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<ChatMessageRecord> {
  const { db } = await getDb();
  const normalizedContent = content.trim();
  if (!normalizedContent) {
    throw new Error("消息内容不能为空");
  }

  const now = Date.now();
  const id = randomUUID();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(id, sessionId, role, normalizedContent, now);

    const countRow = db
      .prepare(`SELECT COUNT(1) as count FROM chat_messages WHERE session_id = ?`)
      .get(sessionId) as { count: number } | undefined;

    if (countRow?.count === 1 && role === "user") {
      const autoTitle = normalizedContent.slice(0, 24);
      db.prepare(`UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?`).run(autoTitle, now, sessionId);
    } else {
      db.prepare(`UPDATE chat_sessions SET updated_at = ? WHERE id = ?`).run(now, sessionId);
    }
  })();

  return { id, sessionId, role, content: normalizedContent, createdAt: now };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { db } = await getDb();
  db.prepare(`DELETE FROM chat_sessions WHERE id = ?`).run(sessionId);
}


export async function renameSession(sessionId: string, title: string): Promise<void> {
  const { db } = await getDb();
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error("会话标题不能为空");
  }

  const now = Date.now();
  const result = db
    .prepare(`UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?`)
    .run(normalizedTitle, now, sessionId);

  if (result.changes === 0) {
    throw new Error("会话不存在");
  }
}
export async function clearAllSessions(): Promise<void> {
  const { db } = await getDb();
  db.transaction(() => {
    db.prepare(`DELETE FROM chat_messages`).run();
    db.prepare(`DELETE FROM chat_sessions`).run();
  })();
}

export async function getStorageStats(): Promise<StorageStats> {
  const { db, dbPath } = await getDb();
  const sessionRow = db.prepare(`SELECT COUNT(1) as count FROM chat_sessions`).get() as { count: number };
  const messageRow = db.prepare(`SELECT COUNT(1) as count FROM chat_messages`).get() as { count: number };

  return {
    dbPath,
    sessionCount: sessionRow.count,
    messageCount: messageRow.count
  };
}

