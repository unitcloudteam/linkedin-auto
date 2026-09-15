import Link from "next/link";
import { loadSettings } from "@/lib/settings";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/verlauf", label: "Verlauf" },
  { href: "/einstellungen", label: "Einstellungen" },
];

/** Rahmen der Maske: Kopfzeile, Navigation, Automatik-Anzeige. */
export default function MaskeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { automationEnabled } = loadSettings();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight">
              LinkedIn-Autoposter
            </span>
            <span className="text-sm text-muted">unit.cloud</span>
          </Link>

          <nav className="flex gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-muted transition hover:bg-background hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <span
            className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
              automationEnabled
                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300"
                : "bg-zinc-500/10 text-zinc-600 ring-zinc-500/30 dark:text-zinc-400"
            }`}
          >
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${
                automationEnabled ? "bg-emerald-500" : "bg-zinc-400"
              }`}
            />
            Automatik {automationEnabled ? "aktiv" : "pausiert"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
