// Cron — runs hourly. Re-prices every active watch, records history, fires FCM on drop.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, serverError } from "../_helpers.js";
import { db, fcm } from "../_lib/firestoreAdmin.js";
import { searchTravelpayoutsFlights } from "../_lib/travelpayouts.js";
import { searchDuffelFlights } from "../_lib/duffel.js";
import {
  evaluatePriceCheck,
  buildAlertPayload,
  type PriceWatch,
  type PriceCheckResult,
} from "../_lib/priceWatch.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  // Vercel Cron sends a header we can optionally verify
  if (req.headers["x-vercel-cron"] !== "1" && process.env.CRON_SECRET) {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  try {
    const snap = await db().collection("priceWatches").where("active", "==", true).get();
    let processed = 0;
    let alerts = 0;

    for (const doc of snap.docs) {
      const watch = doc.data() as PriceWatch;
      try {
        const price = await fetchCheapestPrice(watch);
        if (price == null) continue;
        const result = evaluatePriceCheck(watch, price.amount, price.source);
        await persistAndMaybeAlert(watch, result);
        processed++;
        if (result.triggered || result.isNewLow) alerts++;
      } catch (e) {
        console.error("watch poll fail", watch.id, e);
      }
    }

    res.status(200).json({ ok: true, processed, alerts });
  } catch (e) {
    serverError(res, e);
  }
}

async function fetchCheapestPrice(watch: PriceWatch): Promise<{ amount: number; source: string } | null> {
  const { from, to, depart, cabin, pax } = watch.route;

  // Travelpayouts first — cheap, cached, no rate limits
  if (process.env.TRAVELPAYOUTS_TOKEN && process.env.TRAVELPAYOUTS_MARKER) {
    const tp = await searchTravelpayoutsFlights(
      process.env.TRAVELPAYOUTS_TOKEN,
      process.env.TRAVELPAYOUTS_MARKER,
      from, to, depart, watch.currency
    ).catch(() => []);
    if (tp.length > 0) {
      const cheapest = Math.min(...tp.map((f) => f.price));
      return { amount: cheapest, source: "travelpayouts" };
    }
  }

  // Fallback to Duffel
  if (process.env.DUFFEL_TOKEN) {
    const offers = await searchDuffelFlights(
      process.env.DUFFEL_TOKEN, from, to, depart, pax, cabin
    ).catch(() => []);
    if (offers.length > 0) {
      const cheapest = Math.min(...offers.map((o) => Number(o.total_amount)));
      return { amount: cheapest, source: "duffel" };
    }
  }

  return null;
}

async function persistAndMaybeAlert(watch: PriceWatch, result: PriceCheckResult) {
  const ref = db().collection("priceWatches").doc(watch.id);
  const now = new Date().toISOString();
  const history = [
    ...(watch.history || []),
    { at: now, price: result.newPrice, source: result.source },
  ].slice(-100);

  await ref.update({
    lastPrice: result.newPrice,
    lowestPrice: result.isNewLow ? result.newPrice : (watch.lowestPrice ?? result.newPrice),
    history,
    updatedAt: now,
  });

  if (!result.triggered && !result.isNewLow) return;
  const tokens = watch.fcmTokens || [];
  if (tokens.length === 0) return;

  const payload = buildAlertPayload(watch, result);
  try {
    await fcm().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });
  } catch (e) {
    console.error("fcm fail", e);
  }
}
