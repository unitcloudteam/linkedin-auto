import Link from "next/link";
import {
  dashboardStats,
  lastRun,
  lastSuccessfulScrape,
  linkedinStatus,
  listArticles,
} from "@/lib/articles";
import { loadSettings } from "@/lib/settings";
import { DashboardControls } from "@/components/DashboardControls";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("de-DE");
}

function Tile({
  label,
  value,
  hint,
  tone = "normal",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "normal" | "warn" | "bad" | "good";
}) {
  const toneClass = {
    normal: "",
    good: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    bad: "text-red-600 dark:text-red-400",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={`mt-1.5 text-xl font-semibold ${toneClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const stats = dashboardStats();
  const run = lastRun();
  const scrapedAt = lastSuccessfulScrape();
  const linkedin = linkedinStatus();
  const settings = loadSettings();
  const articles = listArticles(20);

  const scrapeFailed = run !== null && run.error !== null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Dashboard</h2>
            <p className="mt-1 text-sm text-muted">
              Quelle: <span className="font-mono">unit.cloud/news-blog</span> ·{" "}
              {stats.totalArticles} Artikel erfasst
            </p>
          </div>
          <DashboardControls automationEnabled={settings.automationEnabled} />
        </div>

        {scrapeFailed ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            <strong className="font-semibold">Letzter Scrape-Lauf fehlgeschlagen.</strong>{" "}
            {run?.error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="LinkedIn"
            value={linkedin.connected ? "Verbunden" : "Nicht verbunden"}
            tone={linkedin.connected ? "good" : "warn"}
            hint={
              linkedin.connected
                ? linkedin.daysLeft !== null
                  ? `Token läuft in ${linkedin.daysLeft} Tagen ab`
                  : "Token-Laufzeit unbekannt"
                : "Anbindung folgt in Stufe 4"
            }
          />
          <Tile
            label="Letzter Scrape"
            value={scrapedAt ? formatDateTime(scrapedAt) : "noch nie"}
            tone={scrapeFailed ? "bad" : "normal"}
            hint={
              run
                ? `Lauf ${run.id}: ${run.found_count} gefunden, ${run.new_count} neu`
                : undefined
            }
          />
          <Tile
            label="Posts"
            value={`${stats.postsToday} heute · ${stats.postsThisWeek} diese Woche`}
            hint={`Limit ${settings.maxPostsPerDay} pro Tag`}
          />
          <Tile
            label="Offene Fehler"
            value={String(stats.openFailures)}
            tone={stats.openFailures > 0 ? "bad" : "good"}
            hint={
              stats.queued > 0 ? `${stats.queued} in der Warteschlange` : "Warteschlange leer"
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Letzte Artikel
        </h3>

        {articles.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
            {"Noch keine Artikel. Mit „Jetzt scrapen“ den ersten Lauf starten."}
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {articles.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/artikel/${article.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-background"
                >
                  <span className="w-20 shrink-0 font-mono text-xs text-muted">
                    {formatDate(article.date)}
                  </span>
                  <span className="text-base leading-none">{article.emoji ?? "📄"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {article.title_clean}
                  </span>
                  {article.post_text ? (
                    <span className="shrink-0 text-xs text-muted">Text bearbeitet</span>
                  ) : null}
                  <StatusBadge status={article.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
