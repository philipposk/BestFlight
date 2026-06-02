import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

let cached: GoogleGenerativeAI | null = null;

export function geminiClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  if (!cached) cached = new GoogleGenerativeAI(key);
  return cached;
}

export function geminiModel(name = "gemini-1.5-flash"): GenerativeModel {
  return geminiClient().getGenerativeModel({ model: name });
}

export async function geminiJSON<T>(prompt: string, model = "gemini-1.5-flash"): Promise<T> {
  const m = geminiClient().getGenerativeModel({
    model,
    generationConfig: { responseMimeType: "application/json" },
  });
  const res = await m.generateContent(prompt);
  const text = res.response.text();
  return JSON.parse(text) as T;
}
