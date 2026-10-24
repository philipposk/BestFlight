// Fare-trend prediction: Travelpayouts historical prices + Gemini → buy / wait.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, requireMethod, badRequest, serverError } from "../_helpers.js";
import { travelpayoutsPriceCalendar } from "../_lib/travelpayouts.js";
import { geminiJSON } from "../_lib/gemini.js";
import { db } from "../_lib/firestoreAdmin.js";

interface Body {
  from: string;
  to: string;
  date: string;
  cabin?: string;
  currentPrice?: number;
}

interface Prediction {
  recommendation: "buy" | "wait" | "monitor";
  confidence: number;
  expectedChangePct7d: number;
  expectedChangePct30d: number;
  reasoning: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const { from, to, date, cabin = "economy", currentPrice } = (req.body || {}) as Body;
  if (!from || !to || !date) return badRequest(res, "from, to, date required");

  const cacheKey = `${from}-${to}-${date}-${cabin}`;
  try {
    const cacheRef = db().collection("fareTrendCache").doc(cacheKey);
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data() as { prediction: Prediction; ts: number };
      if (Date.now() - data.ts < CACHE_TTL_MS) return res.status(200).json(data.prediction);
    }

    if (!process.env.TRAVELPAYOUTS_TOKEN || !process.env.TRAVELPAYOUTS_MARKER) {
      return res.status(200).json({
        recommendation: "monitor",
        confidence: 0,
        expectedChangePct7d: 0,
        expectedChangePct30d: 0,
        reasoning: "Travelpayouts not configured; cannot estimate trend.",
      } satisfies Prediction);
    }

    const calendar = await travelpayoutsPriceCalendar(
      process.env.TRAVELPAYOUTS_TOKEN,
      process.env.TRAVELPAYOUTS_MARKER,
      from, to
    );

    const daysToDeparture = Math.ceil((Date.parse(date) - Date.now()) / 86400000);
    const dow = new Date(date).getUTCDay();

    const prompt = `
You are a flight-pricing analyst. Given historical cheapest-per-day prices for this route, predict the price trend.

Route: ${from} → ${to}
Travel date: ${date} (day-of-week: ${dow}, days from now: ${daysToDeparture})
Cabin: ${cabin}
Current cheapest offer: ${currentPrice ?? "unknown"} USD

Historical calendar (depart_date → cheapest USD):
${JSON.stringify(calendar.slice(0, 90))}

Output STRICT JSON:
{
  "recommendation": "buy" | "wait" | "monitor",
  "confidence": 0..1,
  "expectedChangePct7d": <number, signed % expected over next 7 days>,
  "expectedChangePct30d": <number, signed % expected over next 30 days>,
  "reasoning": "<2 short sentences, plain English; cite at least one concrete number from the data>"
}
`.trim();

    const prediction = await geminiJSON<Prediction>(prompt);
    await cacheRef.set({ prediction, ts: Date.now() });
    res.status(200).json(prediction);
  } catch (e) {
    serverError(res, e);
  }
}
