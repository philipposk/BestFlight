// Enrich offers with CO2 (Climatiq). Per-route, cached per session.

import { api, type NormalizedOffer } from "../services/flightApi";

const co2Cache = new Map<string, number | null>();

export async function enrichWithCarbon(offers: NormalizedOffer[]): Promise<NormalizedOffer[]> {
  await Promise.all(offers.map(async (o) => {
    const key = `${o.segments[0].from}-${o.segments[o.segments.length - 1].to}`;
    if (!co2Cache.has(key)) {
      try {
        const r = await api.carbon(o.segments[0].from, o.segments[o.segments.length - 1].to);
        co2Cache.set(key, r.co2Kg);
      } catch {
        co2Cache.set(key, null);
      }
    }
    const v = co2Cache.get(key);
    if (v != null) o.co2Kg = v;
  }));
  return offers;
}

export function carbonBadge(co2Kg: number | undefined): string {
  if (co2Kg == null) return "";
  const tone = co2Kg < 200 ? "low" : co2Kg < 500 ? "mid" : "high";
  return `<span class="co2 co2-${tone}">🌱 ${Math.round(co2Kg)} kg CO₂</span>`;
}
