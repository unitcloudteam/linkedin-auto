import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle } from "@/lib/articles";
import { loadSettings } from "@/lib/settings";
import { PostEditor } from "@/components/PostEditor";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = getArticle(id);
  if (!article) notFound();

  const settings = loadSettings();
  const paragraphs = article.body.split("\n\n").filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-muted transition hover:text-foreground">
          ← Dashboard
        </Link>
        <StatusBadge status={article.status} />
        <span className="font-mono text-xs text-muted">{article.id}</span>
      </div>

      {article.status === "posted" ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          Dieser Artikel ist bereits veröffentlicht und wird nie erneut gepostet.
          {article.post_urn ? (
            <>
              {" "}
              <a
                href={`https://www.linkedin.com/feed/update/${article.post_urn}/`}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Post auf LinkedIn ansehen
              </a>
            </>
          ) : null}
        </div>
      ) : null}

      {article.last_error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          <strong className="font-semibold">Letzter Fehler:</strong> {article.last_error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Links: der Originalartikel */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Originalartikel
          </h2>

          <article className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
            <div className="text-xs text-muted">
              {new Date(`${article.date}T00:00:00Z`).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </div>

            <h3 className="text-lg font-semibold leading-snug">{article.title}</h3>

            {article.intro ? (
              <p className="text-sm font-medium leading-relaxed">{article.intro}</p>
            ) : null}

            <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-2 border-t border-border pt-3 text-xs text-muted">
              {article.body.length.toLocaleString("de-DE")} Zeichen ·{" "}
              {article.source_image_url ? (
                <a
                  href={article.source_image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  Bild im Artikel
                </a>
              ) : (
                "kein Bild im Artikel"
              )}{" "}
              ·{" "}
              <a
                href="https://unit.cloud/news-blog/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Quelle
              </a>
            </div>
          </article>
        </section>

        {/* Rechts: Editor und Vorschau */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            LinkedIn-Post
          </h2>
          <PostEditor
            id={article.id}
            status={article.status}
            initialText={article.post_text ?? ""}
            organizationName={settings.linkedinOrganizationUrn ?? "unit.cloud"}
          />
        </section>
      </div>
    </div>
  );
}
