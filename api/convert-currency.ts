import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, requireMethod, badRequest, serverError } from "./_helpers";
import { fxRate } from "./_lib/climatiq";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const { from, to, amount = 1 } = req.body || {};
  if (!from || !to) return badRequest(res, "from, to required");

  try {
    const rate = await fxRate(from, to);
    if (rate == null) return res.status(200).json({ rate: null, converted: null });
    res.status(200).json({ rate, converted: amount * rate });
  } catch (e) {
    serverError(res, e);
  }
}
