/**
 * Rahmen der Maske: Kopfzeile mit Produktnamen, darunter der Seiteninhalt.
 * Die Navigation kommt mit Stufe 2, sobald es mehr als eine Seite gibt.
 */
export default function MaskeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-baseline gap-3 px-6 py-5">
          <h1 className="text-lg font-semibold tracking-tight">
            LinkedIn-Autoposter
          </h1>
          <span className="text-sm text-muted">unit.cloud</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
