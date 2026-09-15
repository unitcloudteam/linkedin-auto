# Projektregeln — LinkedIn-Autoposter

Die vollständige Spezifikation steht in `PROMPT.md`. Diese Datei enthält nur die Dauerregeln.

## Stack
- Node 20+, TypeScript, ESM
- Next.js 15 (App Router) + Tailwind — Maske und API in einem Projekt
- SQLite via `better-sqlite3`, Datei `data/app.db`
- Scraping: `undici` + `cheerio` (kein Headless-Browser)
- Bilder: `sharp` · Scheduler: `node-cron`

## Konventionen
- UI-Texte und Code-Kommentare **deutsch**, Bezeichner im Code **englisch**
- Secrets nur in `.env.local`; `.env.example` bei jeder neuen Variable mitpflegen
- Keine externen SaaS-Dienste einbauen
- Keine Mock-Daten, sobald echte Daten verfügbar sind

## Unverhandelbar
- **Ein Artikel wird nie zweimal gepostet.** Idempotenzprüfung gegen die gespeicherte Post-URN
  vor jedem Sendevorgang, auch nach Neustart.
- **Erstlauf-Schutz:** vorhandene Artikel beim ersten Import auf `skipped` setzen.
- **Trockenlauf zuerst:** `LINKEDIN_DRY_RUN=true` muss funktionieren, bevor echt gepostet wird.
- Scraper-Selektoren aus `PROMPT.md` Abschnitt 2 sind verifiziert. Finden sie nichts,
  ist das ein Fehler — werfen, nicht raten.
- Schonend scrapen: ein Request pro Lauf, ETag/If-Modified-Since, Backoff bei 429/5xx.
- Keine Secrets in Code, Logs oder Commits.

## Arbeitsweise
- Stufenweise vorgehen (Stufe 0–5 in `PROMPT.md`). **Nach jeder Stufe stoppen**, Ergebnis
  zusammenfassen, committen, auf Freigabe warten.
- Stimmt eine Annahme aus `PROMPT.md` nicht mehr: melden statt eigenmächtig umbauen.
