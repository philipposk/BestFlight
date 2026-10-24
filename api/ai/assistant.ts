// Flight-focused chat assistant.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, requireMethod, badRequest, serverError } from "../_helpers";
import { geminiModel } from "../_lib/gemini";

interface Body {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context?: { activeOffer?: any; search?: any };
}

const SYSTEM = `
You are BestFlight Assistant. You ONLY help with flights: searching, comparing, baggage rules,
connections, layovers, fare trends, airlines, airport tips related to a journey, visa-transit basics.
Politely refuse non-flight topics with a one-line redirect. Be concise, plain-English first.
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const { messages, context } = (req.body || {}) as Body;
  if (!Array.isArray(messages) || messages.length === 0) return badRequest(res, "messages[] required");

  try {
    const model = geminiModel("gemini-1.5-flash");
    const chat = model.startChat({
      history: messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      systemInstruction: { role: "system", parts: [{ text: SYSTEM + (context ? `\n\nContext: ${JSON.stringify(context).slice(0, 4000)}` : "") }] },
    });
    const last = messages[messages.length - 1].content;
    const r = await chat.sendMessage(last);
    res.status(200).json({ reply: r.response.text() });
  } catch (e) {
    serverError(res, e);
  }
}
