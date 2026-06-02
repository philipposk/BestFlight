// Gemini analyses the top N offers + user priorities → picks best with reasoning.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, requireMethod, badRequest, serverError } from "../_helpers";
import { geminiJSON } from "../lib/gemini";

interface Body {
  offers: Array<{
    id: string;
    source: string;
    price: { amount: number; currency: string };
    totalDurationMin: number;
    layovers: number;
    layoverAirports?: string[];
    segments: Array<{ airline: string; from: string; to: string; departure: string; arrival: string }>;
    co2Kg?: number;
  }>;
  priorities?: { price?: number; speed?: number; carbon?: number; comfort?: number };
}

interface Result {
  recommendedOfferId: string;
  reasoning: string;
  runnerUpId?: string;
  runnerUpReason?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const { offers, priorities } = (req.body || {}) as Body;
  if (!Array.isArray(offers) || offers.length === 0) return badRequest(res, "offers[] required");

  const top = offers.slice(0, 10);
  const prompt = `
You are a travel-savvy AI choosing the BEST flight for a user. Pick exactly ONE recommendation and one runner-up.

User priorities (0-1 weights):
${JSON.stringify(priorities || { price: 0.4, speed: 0.3, carbon: 0.2, comfort: 0.1 })}

Offers (JSON):
${JSON.stringify(top)}

Consider: total price, total duration, layover count and length, airline reputation, CO2 if present, departure time reasonableness.

Return STRICT JSON:
{
  "recommendedOfferId": "<one offer id from above>",
  "reasoning": "<2-3 short sentences, plain English, mention 2-3 concrete numbers>",
  "runnerUpId": "<another offer id>",
  "runnerUpReason": "<one sentence>"
}
`.trim();

  try {
    const result = await geminiJSON<Result>(prompt);
    res.status(200).json(result);
  } catch (e) {
    serverError(res, e);
  }
}
