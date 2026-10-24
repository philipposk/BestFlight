// Airport / city autocomplete via Amadeus locations.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, badRequest, serverError } from "./_helpers";
import { searchAmadeusLocations } from "./_lib/amadeus";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const q = (req.query.q as string) || "";
  if (q.length < 2) return badRequest(res, "q ≥ 2 chars");
  if (!process.env.AMADEUS_CLIENT_ID || !process.env.AMADEUS_CLIENT_SECRET) {
    return res.status(200).json({ results: [] });
  }
  try {
    const locs = await searchAmadeusLocations(
      process.env.AMADEUS_CLIENT_ID,
      process.env.AMADEUS_CLIENT_SECRET,
      q
    );
    res.status(200).json({
      results: locs.map((l) => ({
        code: l.iataCode,
        name: l.name,
        city: l.address.cityName,
        country: l.address.countryName,
        type: l.subType,
      })),
    });
  } catch (e) {
    serverError(res, e);
  }
}
