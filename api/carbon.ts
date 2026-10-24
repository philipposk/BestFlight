// CO2 per route (Climatiq).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, requireMethod, badRequest, serverError } from "./_helpers";
import { carbonFlight } from "./_lib/climatiq";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const { from, to, passengers = 1, cabin = "economy" } = req.body || {};
  if (!from || !to) return badRequest(res, "from, to required");
  if (!process.env.CLIMATIQ_TOKEN) return res.status(200).json({ co2Kg: null });

  try {
    const result = await carbonFlight(process.env.CLIMATIQ_TOKEN, from, to, passengers, cabin);
    res.status(200).json(result || { co2Kg: null });
  } catch (e) {
    serverError(res, e);
  }
}
