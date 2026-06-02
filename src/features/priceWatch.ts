// Price-watch UI: list + create + delete. Auth required.

import { collection, query, where, orderBy, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { firestore, auth } from "../firebase";
import { api } from "../services/flightApi";
import { registerFcmToken } from "../services/notificationService";

export interface WatchRoute {
  from: string;
  to: string;
  depart: string;
  return?: string;
  cabin: "economy" | "premium_economy" | "business" | "first";
  pax: number;
}

export async function createWatch(route: WatchRoute, threshold?: number, currency = "USD"): Promise<string> {
  const fcmToken = await registerFcmToken().catch(() => null);
  const r = await api.priceWatchCreate(route, threshold, currency, fcmToken || undefined);
  return r.watchId;
}

export async function deleteWatch(watchId: string): Promise<void> {
  await api.priceWatchDelete(watchId);
}

export function subscribeUserWatches(cb: (watches: any[]) => void): Unsubscribe | null {
  const u = auth.currentUser;
  if (!u) return null;
  const q = query(
    collection(firestore, "priceWatches"),
    where("userId", "==", u.uid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function renderWatchCard(w: any): string {
  const r = w.route || {};
  const sparkline = renderSparkline(w.history || []);
  return `
    <article class="watch-card">
      <header>
        <strong>${r.from} → ${r.to}</strong>
        <span class="muted">${r.depart}${r.return ? ` · return ${r.return}` : ""}</span>
      </header>
      <div class="watch-prices">
        <div>Current: <strong>${w.currency} ${w.lastPrice ?? "—"}</strong></div>
        <div>Lowest: <strong>${w.currency} ${w.lowestPrice ?? "—"}</strong></div>
        ${w.threshold ? `<div>Alert ≤ ${w.currency} ${w.threshold}</div>` : ""}
      </div>
      ${sparkline}
      <button class="btn btn-danger" data-watch-delete="${w.id}">Delete</button>
    </article>
  `;
}

function renderSparkline(history: Array<{ at: string; price: number }>): string {
  if (history.length < 2) return "";
  const prices = history.map((h) => h.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const W = 200, H = 36;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = max === min ? H / 2 : H - ((p - min) / (max - min)) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}
