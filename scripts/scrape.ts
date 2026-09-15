/**
 * Manueller Scrape-Lauf: `npm run scrape`
 * Holt die Übersichtsseite, schreibt neue Artikel in die Datenbank und gibt
 * den Tabellenstand aus.
 */
import { existsSync } from "node:fs";
import { getGlobalDispatcher } from "undici";

// Next lädt .env.local selbst; für den CLI-Lauf machen wir das hier.
// Reihenfolge wie bei Next: .env.local gewinnt über .env.
for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// Erst nach dem Laden der Umgebung importieren — die Module lesen process.env.
const { getDb, databaseFile, closeDb } = await import("../src/lib/db.ts");
const { scrapeArticles, ScrapeError } = await import("../src/lib/scraper.ts");

function cut(value: string, width: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= width
    ? text.padEnd(width)
    : text.slice(0, width - 1) + "…";
}

try {
  console.log(`Datenbank: ${databaseFile()}`);
  const result = await scrapeArticles();

  if (result.notModified) {
    console.log("Blogseite unverändert (HTTP 304) — nichts zu tun.");
  } else {
    console.log(
      `Lauf ${result.runId}: HTTP ${result.httpStatus}, ` +
        `${result.found} Artikel gefunden · ${result.created} neu · ` +
        `${result.updated} aktualisiert · ${result.unchanged} unverändert`,
    );
    if (result.firstRun) {
      console.log(
        'Erstlauf-Schutz aktiv: alle importierten Artikel stehen auf "skipped" ' +
          "und werden nie gepostet.",
      );
    }
  }

  const rows = getDb()
    .prepare(
      `SELECT id, date, status, emoji, title_clean, source_image_url,
              LENGTH(body) AS body_len
         FROM articles
        ORDER BY date DESC`,
    )
    .all() as Array<{
    id: string;
    date: string;
    status: string;
    emoji: string | null;
    title_clean: string;
    source_image_url: string | null;
    body_len: number;
  }>;

  console.log("");
  console.log(
    `${"ID".padEnd(16)}  ${"DATUM".padEnd(10)}  ${"STATUS".padEnd(8)}  ` +
      `${"EMOJI".padEnd(5)}  ${"ZEICHEN".padStart(7)}  ${"BILD".padEnd(5)}  TITEL`,
  );
  console.log("-".repeat(118));
  for (const row of rows) {
    console.log(
      `${row.id.padEnd(16)}  ${row.date.padEnd(10)}  ${row.status.padEnd(8)}  ` +
        `${(row.emoji ?? "—").padEnd(5)}  ${String(row.body_len).padStart(7)}  ` +
        `${(row.source_image_url ? "ja" : "nein").padEnd(5)}  ${cut(row.title_clean, 58)}`,
    );
  }
  console.log("-".repeat(118));
  console.log(`${rows.length} Artikel in der Datenbank.`);
} catch (error) {
  process.exitCode = 1;
  if (error instanceof ScrapeError) {
    console.error(`\nScrape-Fehler: ${error.message}`);
    if (error.retryable) {
      console.error("Vorübergehend — ein späterer Versuch kann klappen.");
    }
  } else {
    console.error("\nUnerwarteter Fehler:", error);
  }
} finally {
  // Offene Handles schließen, sonst bricht Node unter Windows beim Beenden ab.
  closeDb();
  await getGlobalDispatcher().close();
}
