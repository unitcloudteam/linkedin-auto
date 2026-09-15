import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/** Mögliche Zustände eines Artikels im Verarbeitungsweg. */
export type ArticleStatus =
  | "new"
  | "drafted"
  | "queued"
  | "posted"
  | "failed"
  | "skipped";

export const ARTICLE_STATUSES: ArticleStatus[] = [
  "new",
  "drafted",
  "queued",
  "posted",
  "failed",
  "skipped",
];

export interface ArticleRow {
  id: string;
  title: string;
  title_clean: string;
  emoji: string | null;
  date: string;
  intro: string;
  body: string;
  source_image_url: string | null;
  content_hash: string;
  first_seen_at: string;
  status: ArticleStatus;
  raw_html: string;
}

export interface RunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  found_count: number;
  new_count: number;
  http_status: number | null;
  not_modified: number;
  error: string | null;
}

export type LogLevel = "info" | "warn" | "error";

let instance: Database.Database | null = null;

/** Pfad der SQLite-Datei, absolut aufgelöst. */
export function databaseFile(): string {
  const configured = process.env.DATABASE_PATH ?? "data/app.db";
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
}

/**
 * Liefert die geteilte Verbindung. Beim ersten Aufruf werden Datei und
 * Migrationen angelegt.
 */
export function getDb(): Database.Database {
  if (instance) return instance;

  const file = databaseFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);

  instance = db;
  return db;
}

/**
 * Migrationen über `user_version`. Jede Migration läuft genau einmal und in
 * einer Transaktion; neue Versionen werden hinten angehängt, nie geändert.
 */
function migrate(db: Database.Database): void {
  const migrations: Array<(d: Database.Database) => void> = [
    // 1 — Grundschema: Artikel, Läufe, Logs, Einstellungen
    (d) => {
      d.exec(`
        CREATE TABLE articles (
          id               TEXT PRIMARY KEY,
          title            TEXT NOT NULL,
          title_clean      TEXT NOT NULL,
          emoji            TEXT,
          date             TEXT NOT NULL,
          intro            TEXT NOT NULL DEFAULT '',
          body             TEXT NOT NULL DEFAULT '',
          source_image_url TEXT,
          content_hash     TEXT NOT NULL,
          first_seen_at    TEXT NOT NULL,
          status           TEXT NOT NULL
                           CHECK (status IN ('new','drafted','queued','posted','failed','skipped')),
          raw_html         TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_articles_status ON articles(status);
        CREATE INDEX idx_articles_date ON articles(date DESC);

        CREATE TABLE runs (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at   TEXT NOT NULL,
          finished_at  TEXT,
          found_count  INTEGER NOT NULL DEFAULT 0,
          new_count    INTEGER NOT NULL DEFAULT 0,
          http_status  INTEGER,
          not_modified INTEGER NOT NULL DEFAULT 0,
          error        TEXT
        );

        CREATE TABLE logs (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          at         TEXT NOT NULL,
          level      TEXT NOT NULL CHECK (level IN ('info','warn','error')),
          article_id TEXT,
          message    TEXT NOT NULL
        );
        CREATE INDEX idx_logs_at ON logs(at DESC);

        CREATE TABLE settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
    },
  ];

  const current = db.pragma("user_version", { simple: true }) as number;
  for (let version = current; version < migrations.length; version++) {
    const step = migrations[version];
    db.transaction(() => {
      step(db);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}

/** Verbindung schließen — nur für CLI-Läufe, damit der Prozess sauber endet. */
export function closeDb(): void {
  instance?.close();
  instance = null;
}

/** Einstellung lesen. */
export function getSetting(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

/** Einstellung schreiben oder überschreiben. */
export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

/**
 * Schreibt eine Zeile ins Log. Niemals Secrets übergeben — die Logs sind in
 * der Maske sichtbar.
 */
export function log(
  level: LogLevel,
  message: string,
  articleId: string | null = null,
): void {
  getDb()
    .prepare(
      "INSERT INTO logs (at, level, article_id, message) VALUES (?, ?, ?, ?)",
    )
    .run(new Date().toISOString(), level, articleId, message);
}
