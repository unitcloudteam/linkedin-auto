"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { EMPTY_STATE, retryArticleAction } from "@/app/actions";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-border px-3 py-1 text-xs font-medium transition hover:border-accent disabled:opacity-50"
    >
      {pending ? "Moment …" : "Erneut versuchen"}
    </button>
  );
}

/** Setzt einen fehlgeschlagenen Artikel zurück in die Warteschlange. */
export function RetryButton({ id }: { id: string }) {
  const [state, action] = useActionState(retryArticleAction, EMPTY_STATE);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Inner />
      {state.message ? (
        <span
          className={`text-xs ${
            state.ok ? "text-muted" : "text-red-600 dark:text-red-400"
          }`}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
