# LinkedIn-Autoposter

Selbst gehostetes System, das die Blogartikel von
[unit.cloud/news-blog](https://unit.cloud/news-blog/) abgreift, daraus
LinkedIn-Posts (Text + Bild) erzeugt und auf der Unternehmensseite
veröffentlicht. Eine Web-Maske dient zur Kontrolle, Historie, Nachbearbeitung
und als Notbremse.

Die vollständige Spezifikation steht in `PROMPT.md`, die Dauerregeln in
`CLAUDE.md`.

## Voraussetzungen

- Node.js 20 oder neuer (entwickelt mit 24.19.0)
- npm

## Start

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev
```

Die Maske läuft dann auf <http://localhost:3000>.

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktions-Build |
| `npm run start` | Produktionsserver (nach `build`) |
| `npm run lint` | ESLint |

## Projektstruktur

```
src/lib/db.ts          SQLite-Verbindung + Migrationen      (Stufe 1)
src/lib/scraper.ts     unit.cloud-Scraper                   (Stufe 1)
src/lib/composer.ts    Artikel -> LinkedIn-Text             (Stufe 3)
src/lib/image.ts       Bildpipeline                         (Stufe 3)
src/lib/linkedin.ts    LinkedIn-API-Client                  (Stufe 4)
src/lib/scheduler.ts   Cron                                 (Stufe 5)
src/app/(maske)/       UI
src/app/api/           interne Endpunkte
data/                  SQLite + generierte Bilder (nicht im Repo)
```

## Konfiguration

Alle Variablen sind in `.env.example` dokumentiert. Secrets gehören
ausschließlich in `.env.local` und niemals ins Repository.

Wichtig: `LINKEDIN_DRY_RUN=true` ist die Voreinstellung. Erst wenn die
geloggten Requests geprüft sind, wird auf `false` umgestellt.

## Stand

Stufe 0 (Repo-Setup) ist umgesetzt. Die Maske ist noch leer; Scraper,
Datenhaltung, Textkomposition, Bildpipeline, LinkedIn-Anbindung und Automatik
folgen in den Stufen 1 bis 5.
