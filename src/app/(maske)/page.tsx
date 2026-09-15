/**
 * Dashboard. Noch leer — die Statuskacheln und die Artikelliste folgen in
 * Stufe 2, sobald der Scraper aus Stufe 1 echte Daten liefert.
 */
export default function DashboardPage() {
  return (
    <div className="rounded-lg border border-border bg-surface p-8">
      <h2 className="text-base font-medium">Dashboard</h2>
      <p className="mt-2 text-sm text-muted">
        Noch keine Daten. Der Scraper wird in Stufe 1 angelegt, die Maske in
        Stufe 2.
      </p>
    </div>
  );
}
