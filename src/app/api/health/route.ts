import { NextResponse } from "next/server";

/**
 * Health-Endpunkt. Meldet vorerst nur, dass der Prozess lebt.
 * Letzter Scrape-Lauf und Token-Restlaufzeit kommen in Stufe 5 dazu.
 */
export async function GET() {
  return NextResponse.json({ status: "ok", time: new Date().toISOString() });
}
