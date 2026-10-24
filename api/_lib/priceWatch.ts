// Price watch evaluation logic — pure functions.

export interface PriceWatch {
  id: string;
  userId: string;
  route: {
    from: string;
    to: string;
    depart: string;
    return?: string;
    cabin: "economy" | "premium_economy" | "business" | "first";
    pax: number;
  };
  threshold?: number;
  currency: string;
  lastPrice?: number;
  lowestPrice?: number;
  fcmTokens?: string[];
  active: boolean;
  history: Array<{ at: string; price: number; source: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface PriceCheckResult {
  watchId: string;
  newPrice: number;
  source: string;
  triggered: boolean;
  isNewLow: boolean;
  delta: number;
}

export function evaluatePriceCheck(watch: PriceWatch, newPrice: number, source: string): PriceCheckResult {
  const delta = watch.lastPrice ? newPrice - watch.lastPrice : 0;
  const triggered = typeof watch.threshold === "number" && newPrice <= watch.threshold;
  const isNewLow = !watch.lowestPrice || newPrice < watch.lowestPrice;
  return { watchId: watch.id, newPrice, source, triggered, isNewLow, delta };
}

export function buildAlertPayload(watch: PriceWatch, res: PriceCheckResult): {
  title: string;
  body: string;
  data: Record<string, string>;
} {
  const what = `${watch.route.from}→${watch.route.to} ${watch.route.depart}`;
  const title = res.triggered
    ? `Price drop: ${watch.currency} ${res.newPrice}`
    : `New low: ${watch.currency} ${res.newPrice}`;
  const body = `${what} — was ${watch.currency} ${watch.lastPrice ?? "—"}, now ${watch.currency} ${res.newPrice}`;
  return {
    title,
    body,
    data: { watchId: watch.id, price: String(res.newPrice) },
  };
}
