import { linkedinStatus } from "@/lib/articles";
import { loadSettings } from "@/lib/settings";
import { DashboardControls } from "@/components/DashboardControls";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default function EinstellungenPage() {
  const settings = loadSettings();
  const linkedin = linkedinStatus();

  const dryRun = process.env.LINKEDIN_DRY_RUN !== "false";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold">Einstellungen</h2>
        <p className="mt-1 text-sm text-muted">
          Alles hier liegt in der Tabelle <code>settings</code> und gilt sofort —
          kein Neustart nötig.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold">LinkedIn-Verbindung</h3>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
              linkedin.connected
                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300"
                : "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300"
            }`}
          >
            {linkedin.connected ? "Verbunden" : "Nicht verbunden"}
          </span>

          {linkedin.organizationUrn ? (
            <span className="font-mono text-xs text-muted">
              {linkedin.organizationUrn}
            </span>
          ) : null}

          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
              dryRun
                ? "bg-blue-500/10 text-blue-700 ring-blue-500/30 dark:text-blue-300"
                : "bg-red-500/10 text-red-700 ring-red-500/30 dark:text-red-300"
            }`}
          >
            {dryRun ? "Trockenlauf aktiv" : "Trockenlauf AUS — es wird echt gepostet"}
          </span>
        </div>

        <button
          type="button"
          disabled
          className="w-fit cursor-not-allowed rounded-md border border-border px-4 py-2 text-sm font-medium text-muted opacity-60"
        >
          Mit LinkedIn verbinden (Stufe 4)
        </button>

        <p className="text-xs text-muted">
          {"Voraussetzung: LinkedIn-App unter developer.linkedin.com, mit der " +
            "Unternehmensseite verknüpft, Produkt „Community Management API“ " +
            "freigegeben. Erst danach lässt sich hier eine Organisation wählen."}
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold">Automatik</h3>
        <p className="text-sm text-muted">
          {settings.automationEnabled
            ? "Die Automatik ist aktiv. Der rote Knopf hält sie sofort an."
            : "Die Automatik ist pausiert. Es wird nichts automatisch gepostet."}
        </p>
        <DashboardControls automationEnabled={settings.automationEnabled} />
        <p className="text-xs text-muted">
          Die Cron-Jobs selbst kommen in Stufe 5 — der Schalter hier steuert sie
          dann, ohne dass etwas neu gestartet werden muss.
        </p>
      </section>

      <SettingsForm settings={settings} />
    </div>
  );
}
