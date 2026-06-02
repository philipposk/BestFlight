import type { VercelRequest, VercelResponse } from "@vercel/node";

export function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function requireMethod(req: VercelRequest, res: VercelResponse, method: string): boolean {
  if (req.method !== method) {
    res.status(405).json({ error: `Method ${req.method} not allowed; use ${method}` });
    return false;
  }
  return true;
}

export function badRequest(res: VercelResponse, msg: string) {
  res.status(400).json({ error: msg });
}

export function serverError(res: VercelResponse, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  res.status(500).json({ error: msg });
}
