import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { request } from "undici";
import { getDb, getSetting, log, setSetting, type ArticleStatus } from "./db";

export const BLOG_URL = process.env.BLOG_URL ?? "https://unit.cloud/news-blog/";
export const USER_AGENT =
  process.env.SCRAPE_USER_AGENT ??
  "unit.cloud-autoposter/1.0 (+https://unit.cloud)";

/** Selektoren aus PROMPT.md Abschnitt 2 — verifiziert, nicht raten. */
const SEL = {
  article: "article.news-blog-block__article",
  date: ".news-blog-block__date",
  heading: ".news-blog-block__heading",
  intro: ".news-blog-block__intro",
  text: ".news-blog-block__text",
} as const;

/** Führende Emojis am Titelanfang, inkl. Varianten- und ZWJ-Sequenzen. */
const LEADING_EMOJI =
  /^(?:\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*[\u{1F3FB}-\u{1F3FF}]?\s*)+/u;

export class ScrapeError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { status?: number; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "ScrapeError";
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

export interface ParsedArticle {
  id: string;
  title: string;
  titleClean: string;
  emoji: string | null;
  date: string;
  intro: string;
  body: string;
  sourceImageUrl: string | null;
  contentHash: string;
  rawHtml: string;
}

export interface ScrapeResult {
  runId: number;
  notModified: boolean;
  httpStatus: number;
  found: number;
  created: number;
  updated: number;
  unchanged: number;
  firstRun: boolean;
  articles: ParsedArticle[];
}

/** Mehrere Leerzeichen, Zeilenumbrüche und NBSP zu einem Leerzeichen. */
function tidy(value: string): string {
  return value.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** `DD.MM.YYYY` nach ISO `YYYY-MM-DD`. */
export function parseGermanDate(value: string): string | null {
  const match = /(\d{2})\.(\d{2})\.(\d{4})/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Rückrechnung fängt Unsinn wie 31.02. ab.
  return parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Trennt führende Emojis vom Titel. */
export function splitEmoji(title: string): {
  emoji: string | null;
  clean: string;
} {
  const match = LEADING_EMOJI.exec(title);
  if (!match) return { emoji: null, clean: title };
  return {
    emoji: tidy(match[0]) || null,
    clean: tidy(title.slice(match[0].length)),
  };
}

/**
 * Stabile ID: SHA256 aus normalisiertem Titel (ohne Emoji) und Datum,
 * auf 16 Zeichen gekürzt.
 */
export function articleId(titleClean: string, isoDate: string): string {
  const normalized = titleClean
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return sha256(`${normalized}|${isoDate}`).slice(0, 16);
}

/**
 * Zerlegt die Übersichtsseite. Findet sie keinen Artikel, hat sich die Seite
 * geändert — das ist ein Fehler und kein Anlass, andere Selektoren zu raten.
 */
export function parseArticles(
  html: string,
  baseUrl = BLOG_URL,
): ParsedArticle[] {
  const $ = cheerio.load(html);
  const nodes = $(SEL.article);

  if (nodes.length === 0) {
    throw new ScrapeError(
      `Kein einziger Artikel über "${SEL.article}" gefunden. Die Seitenstruktur ` +
        `von ${baseUrl} hat sich vermutlich geändert — Selektoren prüfen, nicht raten.`,
    );
  }

  const articles: ParsedArticle[] = [];

  nodes.each((index, node) => {
    const $article = $(node);

    const title = tidy($article.find(SEL.heading).first().text());
    if (!title) {
      throw new ScrapeError(
        `Artikel ${index + 1} hat keinen Titel unter "${SEL.heading}".`,
      );
    }

    // Das datetime-Attribut ist bereits ISO; der sichtbare Text ist DD.MM.YYYY.
    const $date = $article.find(SEL.date).first();
    const isoAttr = ($date.attr("datetime") ?? "").trim().slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(isoAttr)
      ? isoAttr
      : parseGermanDate($date.text());
    if (!date) {
      throw new ScrapeError(
        `Artikel "${title}" hat kein lesbares Datum unter "${SEL.date}".`,
      );
    }

    const intro = tidy($article.find(SEL.intro).first().text());

    const body = $article
      .find(`${SEL.text} p`)
      .map((_, p) => tidy($(p).text()))
      .get()
      .filter((paragraph) => paragraph.length > 0)
      .join("\n\n");

    // Meist null — die Artikel enthalten derzeit keine Bilder.
    const rawSrc = $article.find("img").first().attr("src");
    let sourceImageUrl: string | null = null;
    if (rawSrc) {
      try {
        sourceImageUrl = new URL(rawSrc, baseUrl).toString();
      } catch {
        sourceImageUrl = null;
      }
    }

    const { emoji, clean } = splitEmoji(title);

    articles.push({
      id: articleId(clean, date),
      title,
      titleClean: clean,
      emoji,
      date,
      intro,
      body,
      sourceImageUrl,
      contentHash: sha256([title, intro, body].join("\n")),
      rawHtml: $.html($article),
    });
  });

  return articles;
}

/**
 * Ein einziger GET pro Lauf, mit ETag/If-Modified-Since, falls der Server
 * beim letzten Mal welche geliefert hat.
 */
async function fetchBlogPage(): Promise<{
  status: number;
  html: string | null;
  etag?: string;
  lastModified?: string;
}> {
  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: "text/html,application/xhtml+xml",
  };

  const etag = getSetting("http_etag");
  const lastModified = getSetting("http_last_modified");
  if (etag) headers["if-none-match"] = etag;
  if (lastModified) headers["if-modified-since"] = lastModified;

  let response;
  try {
    response = await request(BLOG_URL, {
      method: "GET",
      headers,
      headersTimeout: 20_000,
      bodyTimeout: 20_000,
    });
  } catch (cause) {
    throw new ScrapeError(
      `Netzwerkfehler beim Abruf von ${BLOG_URL}: ${(cause as Error).message}`,
      { retryable: true },
    );
  }

  const status = response.statusCode;

  if (status === 304) {
    response.body.dump();
    return { status, html: null };
  }

  if (status === 429 || status >= 500) {
    response.body.dump();
    throw new ScrapeError(
      `${BLOG_URL} antwortet mit HTTP ${status} — Lauf wird abgebrochen, ` +
        `nächster Versuch später (Backoff).`,
      { status, retryable: true },
    );
  }

  if (status !== 200) {
    response.body.dump();
    throw new ScrapeError(`${BLOG_URL} antwortet mit HTTP ${status}.`, {
      status,
    });
  }

  const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  return {
    status,
    html: await response.body.text(),
    etag: first(response.headers["etag"]),
    lastModified: first(response.headers["last-modified"]),
  };
}

/** Verhindert, dass zwei Läufe gleichzeitig gegen die fremde Seite gehen. */
let running: Promise<ScrapeResult> | null = null;

export function scrapeArticles(): Promise<ScrapeResult> {
  if (running) return running;
  running = runScrape().finally(() => {
    running = null;
  });
  return running;
}

async function runScrape(): Promise<ScrapeResult> {
  const db = getDb();
  const startedAt = new Date().toISOString();

  const runId = Number(
    db.prepare("INSERT INTO runs (started_at) VALUES (?)").run(startedAt)
      .lastInsertRowid,
  );

  const finish = (
    patch: Partial<{
      found_count: number;
      new_count: number;
      http_status: number;
      not_modified: number;
      error: string;
    }>,
  ) => {
    db.prepare(
      `UPDATE runs SET finished_at = ?, found_count = ?, new_count = ?,
              http_status = ?, not_modified = ?, error = ?
       WHERE id = ?`,
    ).run(
      new Date().toISOString(),
      patch.found_count ?? 0,
      patch.new_count ?? 0,
      patch.http_status ?? null,
      patch.not_modified ?? 0,
      patch.error ?? null,
      runId,
    );
  };

  try {
    const page = await fetchBlogPage();

    if (page.html === null) {
      finish({ http_status: page.status, not_modified: 1 });
      setSetting("last_successful_scrape", new Date().toISOString());
      log("info", "Blogseite unverändert (HTTP 304), nichts zu tun.");
      return {
        runId,
        notModified: true,
        httpStatus: page.status,
        found: 0,
        created: 0,
        updated: 0,
        unchanged: 0,
        firstRun: false,
        articles: [],
      };
    }

    const articles = parseArticles(page.html);

    const firstRun = getSetting("initial_import_done") !== "1";
    // Erstlauf-Schutz: was beim ersten Import schon dasteht, wird nie gepostet.
    const statusForNew: ArticleStatus = firstRun ? "skipped" : "new";

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    const selectOne = db.prepare(
      "SELECT id, content_hash, status FROM articles WHERE id = ?",
    );
    const insertOne = db.prepare(
      `INSERT INTO articles
         (id, title, title_clean, emoji, date, intro, body, source_image_url,
          content_hash, first_seen_at, status, raw_html)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const updateOne = db.prepare(
      `UPDATE articles
          SET title = ?, title_clean = ?, emoji = ?, date = ?, intro = ?,
              body = ?, source_image_url = ?, content_hash = ?, raw_html = ?
        WHERE id = ?`,
    );

    const pending: Array<["info" | "warn", string, string]> = [];

    db.transaction(() => {
      const now = new Date().toISOString();

      for (const article of articles) {
        const existing = selectOne.get(article.id) as
          | { id: string; content_hash: string; status: ArticleStatus }
          | undefined;

        if (!existing) {
          insertOne.run(
            article.id,
            article.title,
            article.titleClean,
            article.emoji,
            article.date,
            article.intro,
            article.body,
            article.sourceImageUrl,
            article.contentHash,
            now,
            statusForNew,
            article.rawHtml,
          );
          created++;
          pending.push([
            "info",
            firstRun
              ? `Erstimport, als "skipped" angelegt: ${article.title}`
              : `Neuer Artikel gefunden: ${article.title}`,
            article.id,
          ]);
          continue;
        }

        if (existing.content_hash === article.contentHash) {
          unchanged++;
          continue;
        }

        if (existing.status === "posted") {
          // Nichts anfassen. Ein bereits geposteter Artikel wird nie erneut gepostet.
          unchanged++;
          pending.push([
            "warn",
            `Inhalt hat sich nach der Veröffentlichung geändert — es wird nicht ` +
              `erneut gepostet: ${article.title}`,
            article.id,
          ]);
          continue;
        }

        updateOne.run(
          article.title,
          article.titleClean,
          article.emoji,
          article.date,
          article.intro,
          article.body,
          article.sourceImageUrl,
          article.contentHash,
          article.rawHtml,
          article.id,
        );
        updated++;
        pending.push([
          "info",
          `Inhalt aktualisiert (Status ${existing.status} bleibt): ${article.title}`,
          article.id,
        ]);
      }

      if (firstRun) setSetting("initial_import_done", "1");
      if (page.etag) setSetting("http_etag", page.etag);
      if (page.lastModified) setSetting("http_last_modified", page.lastModified);
      setSetting("last_successful_scrape", now);
    })();

    for (const [level, message, id] of pending) log(level, message, id);

    finish({
      found_count: articles.length,
      new_count: created,
      http_status: page.status,
    });

    log(
      "info",
      `Lauf ${runId}: ${articles.length} Artikel gefunden, ${created} neu, ` +
        `${updated} aktualisiert, ${unchanged} unverändert.`,
    );

    return {
      runId,
      notModified: false,
      httpStatus: page.status,
      found: articles.length,
      created,
      updated,
      unchanged,
      firstRun,
      articles,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finish({ error: message, http_status: (error as ScrapeError).status });
    log("error", `Lauf ${runId} fehlgeschlagen: ${message}`);
    throw error;
  }
}
