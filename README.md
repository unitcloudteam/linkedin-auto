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
| `npm run scrape` | Manueller Scrape-Lauf, gibt die Artikeltabelle aus |

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

## Erstlauf-Schutz

Beim allerersten `npm run scrape` werden alle bereits vorhandenen Artikel mit
Status `skipped` importiert und dadurch nie gepostet. Gemerkt wird das über den
Schlüssel `initial_import_done` in der Tabelle `settings`. Nur Artikel, die
*danach* neu auftauchen, bekommen Status `new` und laufen in die Automatik.

Wird `data/app.db` gelöscht, beginnt alles von vorn — inklusive Erstlauf-Schutz.

## Schonendes Scrapen

Ein einziger GET pro Lauf, nie parallel (In-Process-Sperre), 20 s Timeout,
User-Agent `unit.cloud-autoposter/1.0 (+https://unit.cloud)`. Bei HTTP 429 oder
5xx bricht der Lauf ab, statt nachzufassen.

`If-None-Match` und `If-Modified-Since` werden gesendet, sobald der Server
einmal `ETag` oder `Last-Modified` geliefert hat. Stand 15.09.2026 sendet
unit.cloud **keine** dieser beiden Header, der bedingte Abruf läuft daher
derzeit ins Leere.

## Die Maske

| Seite | Inhalt |
|---|---|
| `/` | Statuskacheln, letzte 20 Artikel, „Jetzt scrapen", roter Notaus |
| `/artikel/[id]` | Originalartikel links, editierbarer Post mit Vorschau rechts |
| `/verlauf` | Artikel mit Sendeversuch, Fehlertexte, „Erneut versuchen", Protokoll |
| `/einstellungen` | Zeitfenster, Tageslimit, Intervall, Hashtags, Textvorlage |

Alle Schreibvorgänge laufen über Server Actions direkt gegen SQLite.

Was erst später scharf geschaltet wird, ist in der Maske als solches
gekennzeichnet und deaktiviert: Bildpipeline (Stufe 3), „Jetzt posten" und die
LinkedIn-Verbindung (Stufe 4), die Cron-Jobs (Stufe 5).

## Stand

Stufen 0 bis 2 sind umgesetzt: Repo-Setup, Scraper, Datenhaltung, Maske.
Textkomposition und Bildpipeline folgen in Stufe 3, die LinkedIn-Anbindung in
Stufe 4 und die Automatik in Stufe 5.
