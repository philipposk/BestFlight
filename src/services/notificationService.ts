// FCM registration helper.

import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { auth, firestore, getMessagingIfSupported } from "../firebase";

export async function registerFcmToken(): Promise<string | null> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;
  const vapid = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapid) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(messaging, { vapidKey: vapid, serviceWorkerRegistration: reg });
    if (!token) return null;
    const u = auth.currentUser;
    if (u) {
      await setDoc(
        doc(firestore, "users", u.uid),
        { fcmTokens: arrayUnion(token), updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }
    return token;
  } catch (e) {
    console.error("fcm register", e);
    return null;
  }
}

export async function listenForeground(cb: (n: { title?: string; body?: string }) => void) {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    cb({ title: payload.notification?.title, body: payload.notification?.body });
  });
}
