import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, requireMethod, badRequest, serverError } from "../_helpers";
import { db, verifyIdToken } from "../_lib/firestoreAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const uid = await verifyIdToken(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: "auth required" });

  const { watchId } = req.body || {};
  if (!watchId) return badRequest(res, "watchId required");

  try {
    const ref = db().collection("priceWatches").doc(watchId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "not found" });
    if ((snap.data() as any).userId !== uid) return res.status(403).json({ error: "forbidden" });
    await ref.delete();
    res.status(200).json({ ok: true });
  } catch (e) {
    serverError(res, e);
  }
}
