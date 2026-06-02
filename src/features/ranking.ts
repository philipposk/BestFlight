// Smart ranking: score each offer on 4 axes, weighted sum.

import type { NormalizedOffer } from "../services/flightApi";

export interface Priorities {
  price: number;
  speed: number;
  carbon: number;
  comfort: number;
}

export const DEFAULT_PRIORITIES: Priorities = { price: 0.4, speed: 0.3, carbon: 0.2, comfort: 0.1 };

export interface RankedOffer extends NormalizedOffer {
  score: number;
  axes: { price: number; speed: number; carbon: number; comfort: number };
}

export function rank(offers: NormalizedOffer[], priorities: Priorities = DEFAULT_PRIORITIES): RankedOffer[] {
  if (offers.length === 0) return [];
  const prices = offers.map((o) => o.price.amount);
  const durs = offers.map((o) => o.totalDurationMin);
  const co2 = offers.map((o) => o.co2Kg ?? 0);
  const layovers = offers.map((o) => o.layovers);

  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const minD = Math.min(...durs), maxD = Math.max(...durs);
  const maxC = Math.max(...co2);
  const maxL = Math.max(...layovers);

  const norm = (v: number, lo: number, hi: number) => (hi === lo ? 1 : 1 - (v - lo) / (hi - lo));

  return offers.map((o) => {
    const axes = {
      price: norm(o.price.amount, minP, maxP),
      speed: norm(o.totalDurationMin, minD, maxD),
      carbon: maxC === 0 ? 1 : 1 - ((o.co2Kg ?? maxC) / maxC),
      comfort: maxL === 0 ? 1 : 1 - (o.layovers / maxL),
    };
    const w = priorities;
    const total = w.price + w.speed + w.carbon + w.comfort || 1;
    const score =
      (axes.price * w.price + axes.speed * w.speed + axes.carbon * w.carbon + axes.comfort * w.comfort) / total;
    return { ...o, score, axes };
  }).sort((a, b) => b.score - a.score);
}

export function findByAxis(offers: RankedOffer[], axis: keyof RankedOffer["axes"]): RankedOffer | undefined {
  return offers.reduce<RankedOffer | undefined>((best, cur) => {
    if (!best) return cur;
    return cur.axes[axis] > best.axes[axis] ? cur : best;
  }, undefined);
}
