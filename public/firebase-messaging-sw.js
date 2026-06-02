// FCM service worker. Receives push notifications when tab is closed.
// Replace the firebase config below with your project's web config.

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// NOTE: This file is plain JS (no Vite). Inject your project's web config here.
// You may swap to a build-time replacement if you prefer not to expose it.
firebase.initializeApp({
  apiKey: "AIzaSyDm8AsnwiX2i_uQFZ8lPXYS1kEq8Js6UAk",
  authDomain: "bestflight-app.firebaseapp.com",
  projectId: "bestflight-app",
  storageBucket: "bestflight-app.firebasestorage.app",
  messagingSenderId: "608230402692",
  appId: "1:608230402692:web:6162b92b1dc59b4c33b0d1",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "BestFlight";
  const body = payload.notification?.body || "";
  self.registration.showNotification(title, { body, icon: "/favicon.svg" });
});
