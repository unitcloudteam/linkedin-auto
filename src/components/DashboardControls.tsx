"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  EMPTY_STATE,
  runScrapeAction,
  toggleAutomationAction,
} from "@/app/actions";

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

/** „Jetzt scrapen" und der rote Notaus, nebeneinander. */
export function DashboardControls({ automationEnabled }: { automationEnabled: boolean }) {
  const [scrapeState, scrapeAction] = useActionState(runScrapeAction, EMPTY_STATE);
  const [toggleState, toggleAction] = useActionState(toggleAutomationAction, EMPTY_STATE);

  const message = scrapeState.message || toggleState.message;
  const ok = scrapeState.message ? scrapeState.ok : toggleState.ok;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <form action={scrapeAction}>
          <SubmitButton
            pendingLabel="Läuft …"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Jetzt scrapen
          </SubmitButton>
        </form>

        <form action={toggleAction}>
          {automationEnabled ? (
            <SubmitButton
              pendingLabel="Wird pausiert …"
              className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              ⏻ Automatik pausieren
            </SubmitButton>
          ) : (
            <SubmitButton
              pendingLabel="Wird aktiviert …"
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-50"
            >
              Automatik starten
            </SubmitButton>
          )}
        </form>
      </div>

      {message ? (
        <p
          className={`text-sm ${ok ? "text-muted" : "text-red-600 dark:text-red-400"}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
