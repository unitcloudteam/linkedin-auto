"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  EMPTY_STATE,
  reopenArticleAction,
  savePostTextAction,
  skipArticleAction,
} from "@/app/actions";
import type { ArticleStatus } from "@/lib/db";

/** LinkedIn kappt den Text in der Vorschau ungefähr hier. */
const FOLD = 210;
const LIMIT = 3000;

function SubmitButton({
  children,
  className,
  pendingLabel,
}: {
  children: React.ReactNode;
  className: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function PostEditor({
  id,
  status,
  initialText,
  organizationName,
}: {
  id: string;
  status: ArticleStatus;
  initialText: string;
  organizationName: string;
}) {
  const [text, setText] = useState(initialText);
  const [expanded, setExpanded] = useState(false);

  const [saveState, saveAction] = useActionState(savePostTextAction, EMPTY_STATE);
  const [skipState, skipAction] = useActionState(skipArticleAction, EMPTY_STATE);
  const [reopenState, reopenAction] = useActionState(reopenArticleAction, EMPTY_STATE);

  const locked = status === "posted";
  const overLimit = text.length > LIMIT;
  const feedback = [saveState, skipState, reopenState].find((s) => s.message);

  const visible = expanded ? text : text.slice(0, FOLD);
  const truncated = !expanded && text.length > FOLD;

  return (
    <div className="flex flex-col gap-4">
      {/* Editor */}
      <form action={saveAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />

        <div className="flex items-baseline justify-between">
          <label htmlFor="postText" className="text-sm font-medium">
            LinkedIn-Text
          </label>
          <span
            className={`font-mono text-xs ${
              overLimit ? "text-red-600 dark:text-red-400" : "text-muted"
            }`}
          >
            {text.length.toLocaleString("de-DE")} / {LIMIT.toLocaleString("de-DE")}
          </span>
        </div>

        <textarea
          id="postText"
          name="postText"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={locked}
          rows={14}
          placeholder={
            "Noch kein Text. Die automatische Komposition aus Titel, Intro und " +
            "Hashtags kommt in Stufe 3 — bis dahin lässt sich der Text hier von " +
            "Hand schreiben."
          }
          className="w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-sm leading-relaxed outline-none focus:border-accent disabled:opacity-60"
        />

        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton
            pendingLabel="Speichert …"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Speichern
          </SubmitButton>

          <button
            type="button"
            disabled
            title="Wird in Stufe 4 aktiviert, sobald die LinkedIn-Anbindung steht."
            className="cursor-not-allowed rounded-md border border-border px-4 py-2 text-sm font-medium text-muted opacity-60"
          >
            Jetzt posten (Stufe 4)
          </button>
        </div>
      </form>

      {/* Überspringen bzw. reaktivieren — eigenes Formular, da geschachtelte
          Formulare im HTML nicht erlaubt sind. */}
      {!locked ? (
        <form action={status === "skipped" ? reopenAction : skipAction}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton
            pendingLabel="Moment …"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-50"
          >
            {status === "skipped" ? "Wieder aktivieren" : "Überspringen"}
          </SubmitButton>
        </form>
      ) : null}

      {feedback?.message ? (
        <p
          className={`text-sm ${
            feedback.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      {/* Vorschau im echten Post-Layout */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Vorschau</span>

        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center gap-3 p-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">
              uc
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{organizationName}</div>
              <div className="text-xs text-muted">Unternehmensseite</div>
              <div className="text-xs text-muted">Jetzt · 🌐 Öffentlich</div>
            </div>
          </div>

          <div className="px-4 pb-3 text-sm leading-relaxed">
            {text.length === 0 ? (
              <span className="text-muted">Noch kein Text eingegeben.</span>
            ) : (
              <p className="whitespace-pre-wrap break-words">
                {visible}
                {truncated ? (
                  <>
                    <span className="text-muted">… </span>
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="text-muted underline-offset-2 hover:underline"
                    >
                      mehr anzeigen
                    </button>
                  </>
                ) : null}
              </p>
            )}
          </div>

          {text.length > FOLD ? (
            <p className="px-4 pb-3 text-xs text-muted">
              Der Falz liegt bei rund {FOLD} Zeichen — alles davor entscheidet, ob
              jemand aufklappt.
            </p>
          ) : null}

          <div className="mx-4 mb-3 grid aspect-[1200/627] place-items-center rounded-md border border-dashed border-border bg-background text-center text-xs text-muted">
            Bild 1200 × 627
            <br />
            wird in Stufe 3 erzeugt
          </div>

          <div className="flex items-center gap-6 border-t border-border px-4 py-2 text-xs text-muted">
            <span>👍 Gefällt mir</span>
            <span>💬 Kommentieren</span>
            <span>🔁 Teilen</span>
            <span>📨 Senden</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            title="Die Bildpipeline kommt in Stufe 3."
            className="cursor-not-allowed rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted opacity-60"
          >
            Bild neu generieren (Stufe 3)
          </button>
          <button
            type="button"
            disabled
            title="Der Upload kommt zusammen mit der Bildpipeline in Stufe 3."
            className="cursor-not-allowed rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted opacity-60"
          >
            Eigenes Bild hochladen (Stufe 3)
          </button>
        </div>
      </div>
    </div>
  );
}
