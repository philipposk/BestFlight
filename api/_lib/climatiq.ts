// Climatiq — CO2 emissions for flights. Free tier (Bearer token).

export async function carbonFlight(
  apiKey: string,
  fromIata: string,
  toIata: string,
  passengers = 1,
  travelClass: "economy" | "premium_economy" | "business" | "first" = "economy"
): Promise<{ co2Kg: number } | null> {
  const res = await fetch("https://api.climatiq.io/travel/v1-preview1/flights", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      legs: [{ from: fromIata, to: toIata, passengers, travel_class: travelClass }],
    }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { co2e?: number; total_co2e?: number };
  const co2Kg = j.co2e ?? j.total_co2e;
  if (typeof co2Kg !== "number") return null;
  return { co2Kg };
}

// Frankfurter FX (free, no key). Useful for currency normalization.
export async function fxRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
  if (!res.ok) return null;
  const j = (await res.json()) as { rates: Record<string, number> };
  return j.rates?.[to] ?? null;
}
