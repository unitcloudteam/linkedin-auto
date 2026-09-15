# Projekt-Prompt: LinkedIn-Autoposter für unit.cloud

> **Anwendung:** Diese Datei liegt im Projektordner. In der Claude Code CLI starten mit:
> `claude` → dann `Lies PROMPT.md und setze Stufe 0 und Stufe 1 um.`
> Danach stufenweise weiter: `Setze Stufe 2 um.` usw.
> **Regel: Nach jeder Stufe stoppen, Ergebnis zeigen, committen. Keine zwei Stufen ohne Freigabe.**

---

## 1. Ziel

Ein selbst gehostetes System, das die Blogartikel von **https://unit.cloud/news-blog/** automatisch
abgreift, daraus LinkedIn-Posts erzeugt (Text + Bild) und diese **vollautomatisch** auf der
**LinkedIn-Unternehmensseite** veröffentlicht. Eine Web-Maske dient zur Kontrolle, Historie,
Nachbearbeitung und Notbremse.

Wir haben **keinen CMS-/Server-Zugriff** auf unit.cloud. Die Quelle wird ausschließlich **gescrapt**.

---

## 2. Harte Fakten zur Quelle (bereits verifiziert — nicht neu raten)

Die Seite läuft auf Wagtail (Django). Stand der Analyse vom 15.09.2026:

| Frage | Befund |
|---|---|
| Blog-URL | `https://unit.cloud/news-blog/` |
| RSS/Atom-Feed | **existiert nicht** (`/feed`, `/rss.xml` → nichts) |
| sitemap.xml | **404** |
| Einzel-URLs pro Artikel | **existieren nicht** — alle Artikel stehen komplett auf der Übersichtsseite |
| Anker-IDs pro Artikel | keine |
| Pagination / „mehr laden" | keine — aktuell 8 Artikel, alle im HTML |
| JSON-LD / strukturierte Daten | nein |
| **Bilder in den Artikeln** | **keine** — kein einziges `<img>` in den Artikeln |
| og:image der Seite | `https://unit.cloud/static/img/social-share-default.jpg` (1200×630, für alle Artikel identisch) |

**DOM-Struktur eines Artikels (exakt so verwenden):**

```html
<article class="news-blog-block__article">
  <time class="news-blog-block__date">08.09.2026</time>
  <h2 class="news-blog-block__heading">🔐 mTLS für interne Dienste – unsere kleine PKI mit OpenSSL und nginx</h2>
  <p class="news-blog-block__intro">Nur weil ein Dienst im privaten Netzwerk erreichbar ist, muss er nicht …</p>
  <div class="news-blog-block__text">
    <p>…</p><p>…</p>
  </div>
</article>
```

* Datum im Format `DD.MM.YYYY`.
* Titel enthält führende Emojis — beim Posten **behalten** (passt zu LinkedIn), aber für die ID entfernen.
* Artikellänge ca. 1.000–2.000 Zeichen.

### Konsequenz für die Bilder — das ist die zentrale Designentscheidung

Die Anforderung „die Bilder sollen rüberkommen" lässt sich **nicht** wörtlich erfüllen, weil es in den
Artikeln keine Bilder gibt. Deshalb implementieren wir eine Bildpipeline mit dieser Priorität:

1. **Falls** ein Artikel doch mal ein `<img>` enthält (wenn die Redaktion künftig Bilder einbaut):
   dieses Bild herunterladen und verwenden. *(Code muss das schon jetzt können.)*
2. **Sonst:** ein generiertes **Branded Title Card** (1200×627 PNG) — unit.cloud-Logo, Farbverlauf,
   Artikeltitel, Datum, Kategorie-Emoji. Wird lokal mit `sharp` + SVG gerendert, kein externer Dienst.
3. **Fallback:** das statische `social-share-default.jpg`.

Variante 2 ist der Normalfall. Die Karte muss deshalb gut aussehen — sie ist das Gesicht jedes Posts.

---

## 3. Technikvorgaben

* **Runtime:** Node.js 20+, TypeScript, ESM.
* **App:** Next.js 15 (App Router) — Maske und API in einem Projekt.
* **DB:** SQLite über `better-sqlite3` (Datei `data/app.db`). Kein externer DB-Server.
* **Scraping:** `undici` + `cheerio`. Kein Headless-Browser (die Seite ist serverseitig gerendert).
* **Bilder:** `sharp`.
* **Scheduler:** `node-cron` im Serverprozess.
* **Secrets:** `.env.local`, niemals committen. `.env.example` pflegen.
* **Keine** externen SaaS-Dienste (kein Zapier, kein Buffer). Alles im eigenen Prozess.
* Code-Kommentare und UI auf **Deutsch**, Bezeichner im Code englisch.

---

## Stufe 0 — Repo-Setup

**Aufgaben**

1. `git init`, Next.js-15-Projekt mit TypeScript und Tailwind im aktuellen Ordner aufsetzen.
2. Abhängigkeiten: `better-sqlite3 cheerio undici sharp node-cron zod date-fns`.
3. Ordnerstruktur anlegen:
   ```
   src/lib/db.ts            SQLite-Verbindung + Migrationen
   src/lib/scraper.ts       unit.cloud-Scraper
   src/lib/composer.ts      Artikel -> LinkedIn-Text
   src/lib/image.ts         Bildpipeline
   src/lib/linkedin.ts      LinkedIn-API-Client
   src/lib/scheduler.ts     Cron
   src/app/(maske)/…        UI
   src/app/api/…            interne Endpunkte
   data/                    SQLite + generierte Bilder (gitignored)
   ```
4. `.gitignore` (node_modules, .env*, data/), `.env.example`, `README.md` mit Startanleitung.
5. `CLAUDE.md` mit den Projektregeln aus Abschnitt 3 dieser Datei.

**Fertig wenn:** `npm run dev` startet fehlerfrei und zeigt eine leere Maske mit Titel „LinkedIn-Autoposter".

---

## Stufe 1 — Scraper und Datenhaltung

**Aufgaben**

1. Tabelle `articles`:
   `id TEXT PK` (= SHA256 aus normalisiertem Titel + Datum, 16 Zeichen),
   `title`, `title_clean` (ohne Emojis), `emoji`, `date` (ISO), `intro`, `body`,
   `source_image_url` (nullable), `content_hash`, `first_seen_at`, `status`
   (`new | drafted | queued | posted | failed | skipped`), `raw_html`.
2. `scrapeArticles()` in `src/lib/scraper.ts`:
   * GET `https://unit.cloud/news-blog/` mit User-Agent
     `unit.cloud-autoposter/1.0 (+https://unit.cloud)` und 20 s Timeout.
   * Mit cheerio alle `article.news-blog-block__article` parsen (Selektoren aus Abschnitt 2).
   * Datum `DD.MM.YYYY` → ISO. Emoji aus dem Titel-Anfang extrahieren.
   * `body` = alle `<p>` in `.news-blog-block__text`, leere verwerfen.
   * `source_image_url` = erstes `<img>` im Artikel, absolut gemacht — meist `null`.
   * `content_hash` über Titel+Intro+Body, damit spätere Textänderungen erkannt werden.
3. **Deduplizierung:** Artikel, die schon in der DB sind, nicht erneut anlegen. Bei geändertem
   `content_hash` eines bereits geposteten Artikels **nichts** tun (nicht doppelt posten), nur
   in den Logs vermerken.
4. **Erstlauf-Schutz:** Beim allerersten Durchlauf werden alle 8 vorhandenen Artikel als
   `status = 'skipped'` importiert. Sonst feuert die Automatik acht Posts auf einmal.
   Nur was *nach* dem Erstlauf neu auftaucht, wird gepostet.
5. Tabelle `runs` (Zeitpunkt, gefundene/neue Artikel, Fehler) und `logs` (Zeit, Level, Artikel-ID, Nachricht).
6. CLI-Skript `npm run scrape` für manuelle Läufe.

**Fertig wenn:** `npm run scrape` legt 8 Artikel mit Status `skipped` an; ein zweiter Lauf legt
nichts Neues an. Zeig mir die Tabellenausgabe.

---

## Stufe 2 — Die Maske

Eine Seite, vier Bereiche. Dark/Light nach Systemeinstellung, ruhige Optik, keine Spielereien.

1. **Dashboard** (`/`): Statuskacheln (LinkedIn verbunden ja/nein + Token-Restlaufzeit,
   letzter Scrape-Lauf, Posts heute/diese Woche, Fehler offen), Liste der letzten 20 Artikel mit
   Status-Badge, Buttons „Jetzt scrapen" und **„Automatik pausieren"** (großer roter Notaus).
2. **Artikelansicht** (`/artikel/[id]`): links Originalartikel, rechts die **editierbare
   LinkedIn-Vorschau** im echten Post-Layout (Zeichenzähler, 3.000-Zeichen-Limit, „mehr anzeigen"-Falz
   bei ~210 Zeichen sichtbar markiert), darunter das Bild mit Button „Neu generieren" und Upload für
   ein eigenes Bild. Aktionen: *Speichern*, *Jetzt posten*, *Überspringen*.
3. **Verlauf** (`/verlauf`): alle Posts mit Zeitstempel, Link zum LinkedIn-Post, Status, Fehlertext,
   Button „Erneut versuchen" bei Fehlern.
4. **Einstellungen** (`/einstellungen`): LinkedIn verbinden/trennen, Organisation auswählen,
   Scrape-Intervall, Automatik an/aus, Posting-Zeitfenster (z. B. nur Mo–Fr 08–18 Uhr),
   maximal X Posts pro Tag, Hashtag-Set, Textvorlage.

Alles mit Server Actions gegen SQLite. Erst mit echten Daten aus Stufe 1 arbeiten, keine Mocks.

**Fertig wenn:** Ich kann durch alle vier Bereiche klicken, einen Artikeltext bearbeiten und speichern.

---

## Stufe 3 — Textkomposition und Bildpipeline

**Text** (`composer.ts`) — regelbasiert, kein LLM-Aufruf nötig:

```
{emoji} {titel ohne emoji}

{intro}

{erste 1–2 Sätze aus dem body, sauber abgeschnitten an Satzgrenze}

👉 Mehr dazu: https://unit.cloud/news-blog/

{hashtags}
```

* Harte Grenze 2.800 Zeichen, sauber an Wortgrenze kürzen.
* Hashtags aus einem Schlagwort-Mapping (mTLS/PKI/nginx → `#Security #ZeroTrust`,
  n8n/MCP/KI → `#Automatisierung #KI`, VM/Hosting/IONOS → `#Cloud #Hosting`,
  DECT/SNOM/MobiCall → `#Telefonie #UC`), plus immer `#unitcloud`. Maximal 5.
* Vorlage muss in den Einstellungen überschreibbar sein (Platzhalter `{{emoji}}`, `{{titel}}` …).

**Bild** (`image.ts`) — Priorität wie in Abschnitt 2:

* Title Card 1200×627: SVG mit Farbverlauf in unit.cloud-Blau, Emoji groß links oben,
  Titel in bis zu 3 Zeilen umgebrochen (Schriftgröße automatisch nach Titellänge),
  Datum und „unit.cloud" als Fußzeile. Mit `sharp` nach PNG rendern, in `data/images/{id}.png`.
* Echte Bilder: herunterladen, auf max. 1200 px Breite, JPG/PNG erzwingen, > 5 MB ablehnen.
* Alt-Text automatisch = Artikeltitel (LinkedIn verlangt ihn nicht, aber Barrierefreiheit).

**Fertig wenn:** Für alle 8 Artikel liegt eine Title Card in `data/images/`. **Zeig sie mir**, bevor
es weitergeht — wenn die Karten schlecht aussehen, sieht jeder Post schlecht aus.

---

## Stufe 4 — LinkedIn-Anbindung

> Vorbedingung, die *ich* erledige, nicht du: LinkedIn-App unter
> https://developer.linkedin.com anlegen, mit der Unternehmensseite verknüpfen
> (Verifizierung durch einen Seiten-Admin), Produkt **„Community Management API"** beantragen.
> Ohne diese Freigabe gibt es keinen Organisation-Post. Rechne mit einigen Tagen Bearbeitung.
> Redirect-URL: `http://localhost:3000/api/linkedin/callback`.

**OAuth (3-legged, Authorization Code Flow)**

* Autorisierung: `https://www.linkedin.com/oauth/v2/authorization`
* Token: `https://www.linkedin.com/oauth/v2/accessToken`
* Scopes: `w_organization_social`, `r_organization_social`, `w_member_social`, `rw_organization_admin`
  (welche tatsächlich bewilligt werden, steht nach der App-Freigabe im Developer-Portal —
  **implementiere die Scope-Liste konfigurierbar über `.env`**).
* Access Token hat eine begrenzte Laufzeit (in der Größenordnung von 60 Tagen). Ob Refresh Tokens
  für unsere App freigeschaltet sind, **musst du zur Laufzeit prüfen**: Wenn die Token-Antwort ein
  `refresh_token` enthält, automatisch erneuern, sobald < 7 Tage Restlaufzeit. Wenn nicht,
  in der Maske eine deutliche Warnung ab 7 Tagen Restlaufzeit anzeigen: „LinkedIn-Verbindung
  läuft am TT.MM. ab — neu verbinden."
* Tokens verschlüsselt in der DB ablegen (AES-256-GCM, Schlüssel aus `.env`).

**Organisation ermitteln:** `GET https://api.linkedin.com/rest/organizationAcls?q=roleAssignee`
→ liefert die URNs der Seiten, für die der verbundene Account Admin ist. Auswahl in den Einstellungen
speichern als `urn:li:organization:{id}`.

**Pflicht-Header bei jedem `/rest/`-Aufruf:**
```
Authorization: Bearer {token}
LinkedIn-Version: 202606          ← YYYYMM, konfigurierbar in .env
X-Restli-Protocol-Version: 2.0.0
```

**Bild-Upload — drei Schritte, genau so:**

1. `POST https://api.linkedin.com/rest/images?action=initializeUpload`
   ```json
   { "initializeUploadRequest": { "owner": "urn:li:organization:12345" } }
   ```
   Antwort enthält `value.uploadUrl` und `value.image` (= `urn:li:image:…`).
2. Bild-Binary per `PUT` an die `uploadUrl` hochladen.
3. Die zurückgegebene Image-URN im Post verwenden.

**Post absetzen:** `POST https://api.linkedin.com/rest/posts`
```json
{
  "author": "urn:li:organization:12345",
  "commentary": "…Text aus dem Composer…",
  "visibility": "PUBLIC",
  "distribution": { "feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": [] },
  "content": { "media": { "altText": "…Titel…", "id": "urn:li:image:…" } },
  "lifecycleState": "PUBLISHED",
  "isReshareDisabledByAuthor": false
}
```
Erwartet: **HTTP 201**, Post-URN im Header `x-restli-id` — diesen speichern und in der Maske
als Link `https://www.linkedin.com/feed/update/{urn}/` anzeigen.

**Fehlerbehandlung**

* 401 → Token tot, Automatik pausieren, Warnung in der Maske.
* 429 → Rate Limit (Development Tier: ca. 500 Calls/App/Tag). Exponentielles Backoff,
  Post bleibt in der Queue.
* 4xx sonst → Status `failed`, vollständige Fehlerantwort in `logs`, kein automatischer Retry.
* 5xx → bis zu 3 Versuche mit Backoff.
* **Idempotenz:** Vor jedem Post prüfen, ob für diese Artikel-ID schon eine Post-URN existiert.
  Ein Artikel darf nie zweimal gepostet werden — auch nicht nach Neustart oder Crash.

**Fertig wenn:** Ich kann mich in den Einstellungen mit LinkedIn verbinden, die Organisation wählen,
und ein Testpost mit Bild geht raus. Vorher: Trockenlauf-Modus `LINKEDIN_DRY_RUN=true`, der alle
Requests nur loggt statt sie zu senden — **den zuerst bauen und mir die geloggten Requests zeigen.**

---

## Stufe 5 — Automatik und Betrieb

1. Cron alle 30 Minuten: scrapen → neue Artikel → Text und Bild erzeugen → Status `queued`.
2. Zweiter Cron alle 5 Minuten: `queued`-Artikel posten, **aber nur** wenn
   Automatik aktiv **und** im konfigurierten Zeitfenster **und** Tageslimit nicht erreicht.
   Mindestens 30 Minuten Abstand zwischen zwei Posts.
3. Beim Serverstart: Erstlauf-Schutz aus Stufe 1 respektieren, hängengebliebene `queued` prüfen.
4. Health-Endpunkt `/api/health` mit letztem erfolgreichem Scrape und Token-Restlaufzeit.
5. Benachrichtigung bei Fehlern: einfache SMTP-Mail an eine Adresse aus `.env` (optional per Flag).
6. `docker-compose.yml` + `Dockerfile` für den Betrieb auf eigenem VPS, Volume für `data/`.
7. README: Setup, LinkedIn-App-Beantragung, Betrieb, was tun wenn der Token abläuft.

**Fertig wenn:** Container läuft, Automatik postet einen neuen Testartikel selbständig.

---

## 4. Was du als Claude Code beachten musst

* **Nach jeder Stufe: stoppen.** Kurz zusammenfassen, was läuft und was du geändert hast, dann
  `git commit`. Nicht ungefragt weitermachen.
* Die Scraping-Selektoren aus Abschnitt 2 sind verifiziert — nicht durch geratene ersetzen.
  Wenn der Scraper 0 Artikel findet, hat sich die Seite geändert: **Fehler werfen, nicht raten**,
  und das in der Maske als roten Zustand anzeigen.
* Der Scraper läuft gegen eine fremde Produktivseite: ein Request pro Lauf, nie parallel,
  ETag/`If-Modified-Since` auswerten, bei 429/5xx zurückziehen.
* Nichts posten, was nicht durch den Erstlauf-Schutz und die Idempotenzprüfung gegangen ist.
  Ein doppelter Post auf der Firmenseite ist der peinlichste denkbare Fehler.
* Keine Secrets in Code, Logs oder Commits.
* Wenn eine Annahme dieser Datei sich beim Bauen als falsch herausstellt (z. B. LinkedIn-Scopes
  heißen anders): **melden statt umbauen.**
