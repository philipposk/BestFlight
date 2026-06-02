// Duffel booking. Requires auth.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, requireMethod, badRequest, serverError } from "./_helpers";
import { createDuffelOrder } from "./lib/duffel";
import { db, verifyIdToken } from "./lib/firestoreAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const uid = await verifyIdToken(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: "auth required" });

  const { offerId, passengers } = req.body || {};
  if (!offerId || !Array.isArray(passengers) || passengers.length === 0) {
    return badRequest(res, "offerId + passengers[] required");
  }
  if (!process.env.DUFFEL_TOKEN) return serverError(res, "DUFFEL_TOKEN not set");

  try {
    const order = await createDuffelOrder(process.env.DUFFEL_TOKEN, offerId, passengers);
    const orderId = order.data.id;
    await db().collection("flightOrders").doc(orderId).set({
      userId: uid,
      offerId,
      bookingReference: order.data.booking_reference,
      createdAt: new Date().toISOString(),
    });
    res.status(200).json(order.data);
  } catch (e) {
    serverError(res, e);
  }
}
