import { startOfDay, startOfWeek } from "date-fns";
import {
  getDb,
  getSetting,
  log,
  type ArticleRow,
  type ArticleStatus,
  type LogLevel,
  type RunRow,
} from "./db";

export interface DashboardStats {
  postsToday: number;
  postsThisWeek: number;
  openFailures: number;
  queued: number;
  totalArticles: number;
}

export interface LinkedInStatus {
  connected: boolean;
  organizationUrn: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
}

/** Die letzten Artikel, neueste zuerst. */
export function listArticles(limit = 20): ArticleRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM articles ORDER BY date DESC, first_seen_at DESC LIMIT ?",
    )
    .all(limit) as ArticleRow[];
}

export function getArticle(id: string): ArticleRow | null {
  return (getDb().prepare("SELECT * FROM articles WHERE id = ?").get(id) ??
    null) as ArticleRow | null;
}

/** Alles, was schon einmal einen Sendeversuch hatte — für den Verlauf. */
export function listHistory(): ArticleRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM articles
        WHERE post_urn IS NOT NULL OR posted_at IS NOT NULL
           OR status IN ('posted','failed','queued')
        ORDER BY COALESCE(posted_at, updated_at, first_seen_at) DESC`,
    )
    .all() as ArticleRow[];
}

export function dashboardStats(): DashboardStats {
  const db = getDb();
  const dayStart = startOfDay(new Date()).toISOString();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

  const count = (sql: string, ...params: unknown[]): number =>
    (db.prepare(sql).get(...params) as { n: number }).n;

  return {
    postsToday: count(
      "SELECT COUNT(*) n FROM articles WHERE posted_at IS NOT NULL AND posted_at >= ?",
      dayStart,
    ),
    postsThisWeek: count(
      "SELECT COUNT(*) n FROM articles WHERE posted_at IS NOT NULL AND posted_at >= ?",
      weekStart,
    ),
    openFailures: count("SELECT COUNT(*) n FROM articles WHERE status = 'failed'"),
    queued: count("SELECT COUNT(*) n FROM articles WHERE status = 'queued'"),
    totalArticles: count("SELECT COUNT(*) n FROM articles"),
  };
}

/** Letzter Scrape-Lauf, egal ob erfolgreich oder nicht. */
export function lastRun(): RunRow | null {
  return (getDb()
    .prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 1")
    .get() ?? null) as RunRow | null;
}

export function lastSuccessfulScrape(): string | null {
  return getSetting("last_successful_scrape");
}

export function recentLogs(
  limit = 50,
): Array<{ id: number; at: string; level: LogLevel; article_id: string | null; message: string }> {
  return getDb()
    .prepare("SELECT * FROM logs ORDER BY id DESC LIMIT ?")
    .all(limit) as Array<{
    id: number;
    at: string;
    level: LogLevel;
    article_id: string | null;
    message: string;
  }>;
}

/**
 * Zustand der LinkedIn-Verbindung. Die Schlüssel werden erst in Stufe 4
 * gefüllt — bis dahin meldet das hier ehrlich "nicht verbunden".
 */
export function linkedinStatus(): LinkedInStatus {
  const expiresAt = getSetting("linkedin_token_expires_at");
  const organizationUrn = getSetting("linkedin_organization_urn");
  const hasToken = getSetting("linkedin_access_token") !== null;

  let daysLeft: number | null = null;
  if (expiresAt) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    daysLeft = Math.floor(ms / 86_400_000);
  }

  return {
    connected: hasToken && (daysLeft === null || daysLeft > 0),
    organizationUrn: organizationUrn && organizationUrn.length > 0 ? organizationUrn : null,
    expiresAt,
    daysLeft,
  };
}

/** Speichert den bearbeiteten Post-Text. */
export function savePostText(id: string, text: string): void {
  const article = getArticle(id);
  if (!article) throw new Error(`Artikel ${id} existiert nicht.`);
  if (article.status === "posted") {
    throw new Error(
      "Der Artikel ist bereits veröffentlicht — der Text lässt sich nicht mehr ändern.",
    );
  }

  const trimmed = text.trim();
  getDb()
    .prepare(
      "UPDATE articles SET post_text = ?, updated_at = ? WHERE id = ?",
    )
    .run(trimmed.length > 0 ? trimmed : null, new Date().toISOString(), id);

  log("info", "Post-Text in der Maske gespeichert.", id);
}

/**
 * Setzt den Status. Ein bereits geposteter Artikel wird nie wieder angefasst —
 * das ist die Idempotenz-Sperre aus den Projektregeln.
 */
export function setArticleStatus(id: string, status: ArticleStatus): void {
  const article = getArticle(id);
  if (!article) throw new Error(`Artikel ${id} existiert nicht.`);
  if (article.status === "posted") {
    throw new Error(
      "Der Artikel wurde bereits veröffentlicht und kann nicht erneut in die Queue.",
    );
  }
  if (article.post_urn) {
    throw new Error(
      `Für den Artikel existiert bereits die Post-URN ${article.post_urn}. ` +
        "Er wird nicht noch einmal gepostet.",
    );
  }

  getDb()
    .prepare("UPDATE articles SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, new Date().toISOString(), id);

  log("info", `Status in der Maske auf "${status}" gesetzt.`, id);
}

/** Fehlertext eines Artikels löschen, z. B. vor einem neuen Versuch. */
export function clearArticleError(id: string): void {
  getDb()
    .prepare("UPDATE articles SET last_error = NULL, updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

export const STATUS_LABEL: Record<ArticleStatus, string> = {
  new: "Neu",
  drafted: "Entwurf",
  queued: "In Warteschlange",
  posted: "Veröffentlicht",
  failed: "Fehlgeschlagen",
  skipped: "Übersprungen",
};

export const STATUS_CLASS: Record<ArticleStatus, string> = {
  new: "bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/30",
  drafted: "bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/30",
  queued: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30",
  posted: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30",
  failed: "bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/30",
  skipped: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 ring-zinc-500/30",
};
