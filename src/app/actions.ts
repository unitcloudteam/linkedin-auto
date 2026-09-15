"use server";

import { revalidatePath } from "next/cache";
import {
  clearArticleError,
  savePostText,
  setArticleStatus,
} from "@/lib/articles";
import { loadSettings, saveSettings } from "@/lib/settings";
import { scrapeArticles } from "@/lib/scraper";
import { log } from "@/lib/db";

/** Einheitliche Rückmeldung an die Maske. */
export interface ActionState {
  ok: boolean;
  message: string;
}

export const EMPTY_STATE: ActionState = { ok: true, message: "" };

function fail(error: unknown): ActionState {
  return {
    ok: false,
    message: error instanceof Error ? error.message : String(error),
  };
}

/** „Jetzt scrapen" — läuft sofort, unabhängig von der Automatik. */
export async function runScrapeAction(
  _previous: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const result = await scrapeArticles();

    revalidatePath("/");
    revalidatePath("/verlauf");

    if (result.notModified) {
      return { ok: true, message: "Blogseite unverändert (HTTP 304)." };
    }

    return {
      ok: true,
      message:
        `${result.found} Artikel gefunden · ${result.created} neu · ` +
        `${result.updated} aktualisiert` +
        (result.firstRun ? ' · Erstlauf: alles auf "übersprungen"' : ""),
    };
  } catch (error) {
    revalidatePath("/");
    return fail(error);
  }
}

/** Roter Notaus beziehungsweise Wiederanschalten. */
export async function toggleAutomationAction(
  _previous: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const current = loadSettings().automationEnabled;
    saveSettings({ automationEnabled: !current });
    log(
      "warn",
      current
        ? "Automatik über den Notaus in der Maske pausiert."
        : "Automatik in der Maske wieder aktiviert.",
    );

    revalidatePath("/");
    revalidatePath("/einstellungen");

    return {
      ok: true,
      message: current ? "Automatik pausiert." : "Automatik aktiviert.",
    };
  } catch (error) {
    return fail(error);
  }
}

/** Bearbeiteten Post-Text speichern. */
export async function savePostTextAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const id = String(formData.get("id") ?? "");
    const text = String(formData.get("postText") ?? "");

    if (text.length > 3000) {
      return {
        ok: false,
        message: `Text ist ${text.length} Zeichen lang — LinkedIn erlaubt höchstens 3.000.`,
      };
    }

    savePostText(id, text);
    revalidatePath(`/artikel/${id}`);
    revalidatePath("/");

    return { ok: true, message: "Gespeichert." };
  } catch (error) {
    return fail(error);
  }
}

/** Artikel überspringen — er wird dann nie gepostet. */
export async function skipArticleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const id = String(formData.get("id") ?? "");
    setArticleStatus(id, "skipped");

    revalidatePath(`/artikel/${id}`);
    revalidatePath("/");

    return { ok: true, message: "Artikel übersprungen." };
  } catch (error) {
    return fail(error);
  }
}

/** Übersprungenen Artikel wieder als neu markieren. */
export async function reopenArticleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const id = String(formData.get("id") ?? "");
    setArticleStatus(id, "new");

    revalidatePath(`/artikel/${id}`);
    revalidatePath("/");

    return { ok: true, message: "Artikel wieder aktiviert." };
  } catch (error) {
    return fail(error);
  }
}

/**
 * „Erneut versuchen" im Verlauf: Fehler zurücksetzen und zurück in die
 * Warteschlange. Artikel mit vorhandener Post-URN weist setArticleStatus ab.
 */
export async function retryArticleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const id = String(formData.get("id") ?? "");
    setArticleStatus(id, "queued");
    clearArticleError(id);

    revalidatePath("/verlauf");
    revalidatePath(`/artikel/${id}`);
    revalidatePath("/");

    return { ok: true, message: "Artikel steht wieder in der Warteschlange." };
  } catch (error) {
    return fail(error);
  }
}

/** Einstellungsformular speichern. */
export async function saveSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const days = formData
      .getAll("postingDays")
      .map((value) => Number.parseInt(String(value), 10))
      .filter((value) => value >= 1 && value <= 7);

    const interval = Number.parseInt(String(formData.get("scrapeIntervalMinutes")), 10);
    const maxPerDay = Number.parseInt(String(formData.get("maxPostsPerDay")), 10);
    const start = String(formData.get("postingStart") ?? "");
    const end = String(formData.get("postingEnd") ?? "");
    const template = String(formData.get("textTemplate") ?? "");
    const hashtags = String(formData.get("baseHashtags") ?? "");

    if (Number.isNaN(interval) || interval < 5) {
      return { ok: false, message: "Scrape-Intervall muss mindestens 5 Minuten sein." };
    }
    if (Number.isNaN(maxPerDay) || maxPerDay < 1) {
      return { ok: false, message: "Es muss mindestens ein Post pro Tag erlaubt sein." };
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) {
      return { ok: false, message: "Zeitfenster bitte als HH:MM angeben." };
    }
    if (start >= end) {
      return { ok: false, message: "Das Zeitfenster endet vor seinem Beginn." };
    }
    if (days.length === 0) {
      return { ok: false, message: "Mindestens ein Wochentag muss erlaubt sein." };
    }
    if (!template.includes("{{titel}}")) {
      return {
        ok: false,
        message: "Die Textvorlage muss mindestens den Platzhalter {{titel}} enthalten.",
      };
    }

    saveSettings({
      scrapeIntervalMinutes: interval,
      maxPostsPerDay: maxPerDay,
      postingStart: start,
      postingEnd: end,
      postingDays: days,
      textTemplate: template,
      baseHashtags: hashtags
        .split(/[,\s]+/)
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
    });

    revalidatePath("/einstellungen");
    revalidatePath("/");

    return { ok: true, message: "Einstellungen gespeichert." };
  } catch (error) {
    return fail(error);
  }
}
