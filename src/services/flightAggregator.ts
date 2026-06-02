// Light client cache + deduplication wrapper around /api/search-flights.

import { api, type NormalizedOffer, type SearchParams } from "./flightApi";

const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  offers: NormalizedOffer[];
  ts: number;
}

const cache = new Map<string, CacheEntry>();

function key(p: SearchParams): string {
  return JSON.stringify(p);
}

export async function searchFlights(params: SearchParams): Promise<NormalizedOffer[]> {
  const k = key(params);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.offers;
  const res = await api.searchFlights(params);
  const offers = dedupe(res.offers);
  cache.set(k, { offers, ts: Date.now() });
  return offers;
}

function dedupe(offers: NormalizedOffer[]): NormalizedOffer[] {
  const grouped = new Map<string, NormalizedOffer[]>();
  for (const o of offers) {
    const sig = signature(o);
    if (!grouped.has(sig)) grouped.set(sig, []);
    grouped.get(sig)!.push(o);
  }
  const result: NormalizedOffer[] = [];
  for (const group of grouped.values()) {
    // Prefer bookable (Duffel) at similar price; else cheapest
    const bookable = group.find((g) => g.bookable);
    const cheapest = group.reduce((a, b) => (a.price.amount < b.price.amount ? a : b));
    result.push(bookable && bookable.price.amount <= cheapest.price.amount * 1.05 ? bookable : cheapest);
  }
  return result.sort((a, b) => a.price.amount - b.price.amount);
}

function signature(o: NormalizedOffer): string {
  return o.segments
    .map((s) => `${s.flightNumber}@${s.departure.slice(0, 16)}`)
    .join("|");
}

export function clearFlightCache() { cache.clear(); }
