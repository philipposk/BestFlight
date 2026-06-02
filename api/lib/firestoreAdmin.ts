import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { getAuth, type Auth } from "firebase-admin/auth";

let app: App | null = null;

export function adminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  const saJson = process.env.FIREBASE_ADMIN_SA_JSON;
  if (!saJson) throw new Error("FIREBASE_ADMIN_SA_JSON not set");
  // Allow either raw JSON or base64-encoded JSON
  let parsed: any;
  try {
    parsed = JSON.parse(saJson);
  } catch {
    parsed = JSON.parse(Buffer.from(saJson, "base64").toString("utf-8"));
  }
  app = initializeApp({ credential: cert(parsed) });
  return app;
}

export function db(): Firestore { return getFirestore(adminApp()); }
export function fcm(): Messaging { return getMessaging(adminApp()); }
export function adminAuth(): Auth { return getAuth(adminApp()); }

export async function verifyIdToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice(7);
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}
