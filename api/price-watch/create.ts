import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, requireMethod, badRequest, serverError } from "../_helpers";
import { db, verifyIdToken } from "../_lib/firestoreAdmin";
import type { PriceWatch } from "../_lib/priceWatch";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const uid = await verifyIdToken(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: "auth required" });

  const { route, threshold, currency = "USD", fcmToken } = req.body || {};
  if (!route?.from || !route?.to || !route?.depart) return badRequest(res, "route.from/to/depart required");

  const now = new Date().toISOString();
  const ref = db().collection("priceWatches").doc();
  const watch: PriceWatch = {
    id: ref.id,
    userId: uid,
    route: {
      from: route.from,
      to: route.to,
      depart: route.depart,
      return: route.return,
      cabin: route.cabin || "economy",
      pax: route.pax || 1,
    },
    threshold,
    currency,
    fcmTokens: fcmToken ? [fcmToken] : [],
    active: true,
    history: [],
    createdAt: now,
    updatedAt: now,
  };

  try {
    await ref.set(watch);
    res.status(200).json({ watchId: ref.id, watch });
  } catch (e) {
    serverError(res, e);
  }
}
