// Connecting-flights optimizer.
//
// Builds synthesized "virtual offers" by combining native results:
//   - self-transfer: two separate tickets that connect via an intermediate airport
//   - hidden-city: book A→C, where C's intermediate stop is the user's real destination B
//
// Both are opt-in per search. Each virtual offer carries warnings[].

import type { NormalizedOffer, NormalizedSegment } from "../services/flightApi";

const MIN_CONNECTION_MIN = 90;
const MAX_CONNECTION_MIN = 720; // 12h

export interface OptimizerOptions {
  selfTransfer?: boolean;
  hiddenCity?: boolean;
  minConnectionMin?: number;
}

export function optimize(
  offers: NormalizedOffer[],
  from: string,
  to: string,
  opts: OptimizerOptions = {}
): NormalizedOffer[] {
  const synthesized: NormalizedOffer[] = [];

  if (opts.selfTransfer) synthesized.push(...buildSelfTransfers(offers, from, to, opts.minConnectionMin ?? MIN_CONNECTION_MIN));
  if (opts.hiddenCity) synthesized.push(...buildHiddenCity(offers, from, to));

  return synthesized;
}

function buildSelfTransfers(
  offers: NormalizedOffer[],
  from: string,
  to: string,
  minConn: number
): NormalizedOffer[] {
  const fromOrigin = offers.filter((o) => firstSeg(o).from === from && lastSeg(o).to !== to);
  const toDest = offers.filter((o) => firstSeg(o).from !== from && lastSeg(o).to === to);

  const out: NormalizedOffer[] = [];
  for (const leg1 of fromOrigin) {
    for (const leg2 of toDest) {
      if (lastSeg(leg1).to !== firstSeg(leg2).from) continue;
      const gap = minutesBetween(lastSeg(leg1).arrival, firstSeg(leg2).departure);
      if (gap < minConn || gap > MAX_CONNECTION_MIN) continue;

      const segs: NormalizedSegment[] = [...leg1.segments, ...leg2.segments];
      const totalMin = leg1.totalDurationMin + gap + leg2.totalDurationMin;
      const totalPrice = leg1.price.amount + leg2.price.amount;

      out.push({
        id: `self-${leg1.id}+${leg2.id}`,
        source: leg1.source,
        segments: segs,
        totalDurationMin: totalMin,
        layovers: segs.length - 1,
        layoverAirports: segs.slice(0, -1).map((s) => s.to),
        layoverMinutes: segs.slice(1).map((s, i) => minutesBetween(segs[i].arrival, s.departure)),
        price: { amount: totalPrice, currency: leg1.price.currency },
        bookable: false,
        optimizationType: "self-transfer",
        warnings: [
          "Two separate tickets — baggage will NOT be transferred automatically; you must collect and re-check.",
          "Missed-connection risk is on you. Allow extra buffer.",
          `Connection in ${lastSeg(leg1).to}: ${formatGap(gap)}.`,
        ],
      });
    }
  }

  // Keep top 10 cheapest self-transfers
  return out.sort((a, b) => a.price.amount - b.price.amount).slice(0, 10);
}

function buildHiddenCity(offers: NormalizedOffer[], from: string, to: string): NormalizedOffer[] {
  // Offers where 'to' appears as an intermediate stop, priced lower than direct A→to offers.
  const directPrices = offers
    .filter((o) => firstSeg(o).from === from && lastSeg(o).to === to)
    .map((o) => o.price.amount);
  const cheapestDirect = directPrices.length ? Math.min(...directPrices) : Infinity;

  const out: NormalizedOffer[] = [];
  for (const o of offers) {
    if (firstSeg(o).from !== from) continue;
    if (lastSeg(o).to === to) continue;
    // Does 'to' appear as an intermediate destination?
    const stopIdx = o.segments.findIndex((s) => s.to === to);
    if (stopIdx === -1 || stopIdx === o.segments.length - 1) continue;
    if (o.price.amount >= cheapestDirect) continue;

    const segs = o.segments.slice(0, stopIdx + 1);
    out.push({
      ...o,
      id: `hidden-${o.id}`,
      segments: segs,
      totalDurationMin: minutesBetween(segs[0].departure, segs[segs.length - 1].arrival),
      layovers: segs.length - 1,
      layoverAirports: segs.slice(0, -1).map((s) => s.to),
      layoverMinutes: segs.slice(1).map((s, i) => minutesBetween(segs[i].arrival, s.departure)),
      bookable: false,
      optimizationType: "hidden-city",
      warnings: [
        "Hidden-city ticket: book to a city beyond your real destination and exit at the layover.",
        "Carry-on only — checked bags go to the final ticketed city.",
        "If you have a return on the same ticket, it will be cancelled when you skip a leg.",
        "Some airlines penalize repeat use. Use sparingly and not under your frequent-flyer account.",
      ],
    });
  }

  return out.sort((a, b) => a.price.amount - b.price.amount).slice(0, 5);
}

function firstSeg(o: NormalizedOffer): NormalizedSegment { return o.segments[0]; }
function lastSeg(o: NormalizedOffer): NormalizedSegment { return o.segments[o.segments.length - 1]; }
function minutesBetween(aIso: string, bIso: string): number {
  return Math.max(0, Math.round((Date.parse(bIso) - Date.parse(aIso)) / 60000));
}
function formatGap(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}h ${m}m`;
}
