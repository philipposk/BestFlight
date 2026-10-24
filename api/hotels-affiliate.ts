// Returns a Travelpayouts/Hotellook affiliate URL — no in-app hotel search UI.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, requireMethod, badRequest } from "./_helpers";
import { buildHotellookAffiliateUrl } from "./_lib/travelpayouts";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const { city, checkIn, checkOut, adults = 2 } = req.body || {};
  if (!city || !checkIn || !checkOut) return badRequest(res, "city, checkIn, checkOut required");

  const marker = process.env.TRAVELPAYOUTS_MARKER || "";
  const url = buildHotellookAffiliateUrl(city, checkIn, checkOut, marker, adults);
  res.status(200).json({ url });
}
