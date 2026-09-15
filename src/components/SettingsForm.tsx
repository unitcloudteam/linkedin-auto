"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { EMPTY_STATE, saveSettingsAction } from "@/app/actions";
import type { AppSettings } from "@/lib/settings";

const WEEKDAYS = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Di" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Do" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 7, label: "So" },
];

const FIELD =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Speichert …" : "Einstellungen speichern"}
    </button>
  );
}

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, action] = useActionState(saveSettingsAction, EMPTY_STATE);

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-semibold">Scrapen</legend>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Intervall in Minuten</span>
          <input
            type="number"
            name="scrapeIntervalMinutes"
            min={5}
            max={1440}
            defaultValue={settings.scrapeIntervalMinutes}
            className={FIELD}
          />
          <span className="text-xs text-muted">
            Ein Request pro Lauf. Unter 5 Minuten nicht erlaubt — die Quelle ist
            eine fremde Produktivseite.
          </span>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-semibold">Posting-Zeitfenster</legend>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Wochentage</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day.value}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm has-checked:border-accent has-checked:bg-accent/10"
              >
                <input
                  type="checkbox"
                  name="postingDays"
                  value={day.value}
                  defaultChecked={settings.postingDays.includes(day.value)}
                  className="accent-[var(--accent)]"
                />
                {day.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Von</span>
            <input
              type="time"
              name="postingStart"
              defaultValue={settings.postingStart}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Bis</span>
            <input
              type="time"
              name="postingEnd"
              defaultValue={settings.postingEnd}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Max. Posts pro Tag</span>
            <input
              type="number"
              name="maxPostsPerDay"
              min={1}
              max={20}
              defaultValue={settings.maxPostsPerDay}
              className={FIELD}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-semibold">Text</legend>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Feste Hashtags</span>
          <input
            type="text"
            name="baseHashtags"
            defaultValue={settings.baseHashtags.join(" ")}
            placeholder="unitcloud"
            className={FIELD}
          />
          <span className="text-xs text-muted">
            Ohne Raute, durch Leerzeichen getrennt. Themenbezogene Hashtags kommen
            in Stufe 3 automatisch dazu, insgesamt höchstens fünf.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Textvorlage</span>
          <textarea
            name="textTemplate"
            rows={12}
            defaultValue={settings.textTemplate}
            className={`${FIELD} resize-y font-mono leading-relaxed`}
          />
          <span className="text-xs text-muted">
            Platzhalter: <code>{"{{emoji}}"}</code> <code>{"{{titel}}"}</code>{" "}
            <code>{"{{intro}}"}</code> <code>{"{{auszug}}"}</code>{" "}
            <code>{"{{link}}"}</code> <code>{"{{hashtags}}"}</code>. Ausgewertet
            wird die Vorlage ab Stufe 3.
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton />
        {state.message ? (
          <span
            className={`text-sm ${
              state.ok
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
