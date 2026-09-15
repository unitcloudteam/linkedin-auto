import Link from "next/link";
import { listHistory, recentLogs } from "@/lib/articles";
import { RetryButton } from "@/components/RetryButton";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const LEVEL_CLASS: Record<string, string> = {
  info: "text-muted",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
};

export default function VerlaufPage() {
  const history = listHistory();
  const logs = recentLogs(50);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Verlauf</h2>
          <p className="mt-1 text-sm text-muted">
            Alle Artikel mit Sendeversuch — veröffentlicht, in der Warteschlange
            oder fehlgeschlagen.
          </p>
        </div>

        {history.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
            Noch nichts gepostet. Das Senden wird in Stufe 4 aktiviert — bis dahin
            bleibt diese Liste leer.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {history.map((article) => (
              <li key={article.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="w-28 shrink-0 font-mono text-xs text-muted">
                    {formatDateTime(article.posted_at ?? article.updated_at)}
                  </span>
                  <Link
                    href={`/artikel/${article.id}`}
                    className="min-w-0 flex-1 truncate text-sm hover:underline"
                  >
                    {article.emoji ? `${article.emoji} ` : ""}
                    {article.title_clean}
                  </Link>
                  <StatusBadge status={article.status} />
                </div>

                {article.post_urn ? (
                  <a
                    href={`https://www.linkedin.com/feed/update/${article.post_urn}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-32 text-xs text-accent underline underline-offset-2"
                  >
                    Post auf LinkedIn öffnen
                  </a>
                ) : null}

                {article.last_error ? (
                  <div className="ml-32 flex flex-col gap-2">
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {article.last_error}
                    </p>
                    <RetryButton id={article.id} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Protokoll
        </h3>

        {logs.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted">
            Noch keine Einträge.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface text-sm">
            {logs.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-3 px-4 py-2">
                <span className="w-28 shrink-0 font-mono text-xs text-muted">
                  {formatDateTime(entry.at)}
                </span>
                <span
                  className={`w-12 shrink-0 text-xs font-medium uppercase ${
                    LEVEL_CLASS[entry.level] ?? "text-muted"
                  }`}
                >
                  {entry.level}
                </span>
                <span className="min-w-0 flex-1 text-xs">
                  {entry.article_id ? (
                    <Link
                      href={`/artikel/${entry.article_id}`}
                      className="mr-2 font-mono text-muted hover:underline"
                    >
                      {entry.article_id}
                    </Link>
                  ) : null}
                  {entry.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
