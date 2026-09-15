import { getDb, getSetting, setSetting } from "./db";

/**
 * Betriebseinstellungen. Liegen als Schlüssel/Wert in der Tabelle `settings`,
 * damit sie ohne Neustart über die Maske änderbar sind.
 */
export interface AppSettings {
  /** Automatik insgesamt aktiv? Der rote Notaus setzt das auf false. */
  automationEnabled: boolean;
  /** Abstand zwischen zwei Scrape-Läufen in Minuten. */
  scrapeIntervalMinutes: number;
  /** Wochentage, an denen gepostet werden darf (1 = Montag … 7 = Sonntag). */
  postingDays: number[];
  /** Frühester Posting-Zeitpunkt, lokale Zeit, Format HH:MM. */
  postingStart: string;
  /** Spätester Posting-Zeitpunkt, lokale Zeit, Format HH:MM. */
  postingEnd: string;
  /** Obergrenze Posts pro Kalendertag. */
  maxPostsPerDay: number;
  /** Hashtags, die immer angehängt werden (ohne #). */
  baseHashtags: string[];
  /** Textvorlage mit Platzhaltern, siehe PROMPT.md Stufe 3. */
  textTemplate: string;
  /** Gewählte LinkedIn-Organisation, z. B. urn:li:organization:12345. */
  linkedinOrganizationUrn: string | null;
}

export const DEFAULT_TEMPLATE = `{{emoji}} {{titel}}

{{intro}}

{{auszug}}

👉 Mehr dazu: {{link}}

{{hashtags}}`;

export const DEFAULTS: AppSettings = {
  automationEnabled: false,
  scrapeIntervalMinutes: 30,
  postingDays: [1, 2, 3, 4, 5],
  postingStart: "08:00",
  postingEnd: "18:00",
  maxPostsPerDay: 2,
  baseHashtags: ["unitcloud"],
  textTemplate: DEFAULT_TEMPLATE,
  linkedinOrganizationUrn: null,
};

const KEYS: Record<keyof AppSettings, string> = {
  automationEnabled: "automation_enabled",
  scrapeIntervalMinutes: "scrape_interval_minutes",
  postingDays: "posting_days",
  postingStart: "posting_start",
  postingEnd: "posting_end",
  maxPostsPerDay: "max_posts_per_day",
  baseHashtags: "base_hashtags",
  textTemplate: "text_template",
  linkedinOrganizationUrn: "linkedin_organization_urn",
};

function readInt(key: string, fallback: number, min: number, max: number): number {
  const raw = getSetting(key);
  const value = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  if (Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function readTime(key: string, fallback: string): string {
  const raw = getSetting(key);
  return raw && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : fallback;
}

/** Liest alle Einstellungen, fehlende Werte kommen aus DEFAULTS. */
export function loadSettings(): AppSettings {
  getDb(); // stellt sicher, dass die Migrationen gelaufen sind

  const days = getSetting(KEYS.postingDays);
  const hashtags = getSetting(KEYS.baseHashtags);
  const template = getSetting(KEYS.textTemplate);
  const org = getSetting(KEYS.linkedinOrganizationUrn);

  return {
    automationEnabled: getSetting(KEYS.automationEnabled) === "1",
    scrapeIntervalMinutes: readInt(KEYS.scrapeIntervalMinutes, DEFAULTS.scrapeIntervalMinutes, 5, 1440),
    postingDays:
      days === null
        ? DEFAULTS.postingDays
        : days
            .split(",")
            .map((d) => Number.parseInt(d, 10))
            .filter((d) => d >= 1 && d <= 7),
    postingStart: readTime(KEYS.postingStart, DEFAULTS.postingStart),
    postingEnd: readTime(KEYS.postingEnd, DEFAULTS.postingEnd),
    maxPostsPerDay: readInt(KEYS.maxPostsPerDay, DEFAULTS.maxPostsPerDay, 1, 20),
    baseHashtags:
      hashtags === null
        ? DEFAULTS.baseHashtags
        : hashtags
            .split(",")
            .map((tag) => tag.trim().replace(/^#/, ""))
            .filter(Boolean),
    textTemplate: template ?? DEFAULTS.textTemplate,
    linkedinOrganizationUrn: org && org.length > 0 ? org : null,
  };
}

/** Schreibt einzelne Einstellungen zurück. */
export function saveSettings(patch: Partial<AppSettings>): void {
  const write = (key: string, value: string) => setSetting(key, value);

  if (patch.automationEnabled !== undefined) {
    write(KEYS.automationEnabled, patch.automationEnabled ? "1" : "0");
  }
  if (patch.scrapeIntervalMinutes !== undefined) {
    write(KEYS.scrapeIntervalMinutes, String(patch.scrapeIntervalMinutes));
  }
  if (patch.postingDays !== undefined) {
    write(KEYS.postingDays, patch.postingDays.join(","));
  }
  if (patch.postingStart !== undefined) write(KEYS.postingStart, patch.postingStart);
  if (patch.postingEnd !== undefined) write(KEYS.postingEnd, patch.postingEnd);
  if (patch.maxPostsPerDay !== undefined) {
    write(KEYS.maxPostsPerDay, String(patch.maxPostsPerDay));
  }
  if (patch.baseHashtags !== undefined) {
    write(KEYS.baseHashtags, patch.baseHashtags.map((t) => t.replace(/^#/, "")).join(","));
  }
  if (patch.textTemplate !== undefined) write(KEYS.textTemplate, patch.textTemplate);
  if (patch.linkedinOrganizationUrn !== undefined) {
    write(KEYS.linkedinOrganizationUrn, patch.linkedinOrganizationUrn ?? "");
  }
}

export const WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Di" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Do" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 7, label: "So" },
];
