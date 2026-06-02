// App bootstrap: router (search / watches / about), auth, FCM.

import { onAuthChange, signInWithGoogle, signOutUser } from "./authSetup";
import { renderSearchForm, attachSearchHandler } from "./features/flightSearch";
import { subscribeUserWatches, deleteWatch, renderWatchCard } from "./features/priceWatch";
import { listenForeground } from "./services/notificationService";

const app = document.getElementById("app") as HTMLElement;
const authSlot = document.getElementById("auth-slot") as HTMLElement;

type Tab = "search" | "watches" | "about";

function currentTab(): Tab {
  const h = location.hash.replace("#", "");
  return h === "watches" || h === "about" ? h : "search";
}

function render() {
  const tab = currentTab();
  if (tab === "search") renderSearchTab();
  else if (tab === "watches") renderWatchesTab();
  else renderAboutTab();
  document.querySelectorAll<HTMLAnchorElement>("nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.tab === tab);
  });
}

function renderSearchTab() {
  app.innerHTML = `<section class="hero"><h1>Find the best flight — not just the cheapest</h1><p>AI-ranked, carbon-aware, connection-smart search across Duffel, Amadeus & Travelpayouts.</p></section>${renderSearchForm()}`;
  attachSearchHandler(app);
}

let watchUnsub: (() => void) | null = null;
function renderWatchesTab() {
  app.innerHTML = `<h2>Price watches</h2><div id="watch-list">Loading…</div>`;
  const list = app.querySelector<HTMLElement>("#watch-list")!;
  if (watchUnsub) { watchUnsub(); watchUnsub = null; }
  const unsub = subscribeUserWatches((watches) => {
    list.innerHTML = watches.length
      ? watches.map(renderWatchCard).join("")
      : `<p>No watches yet. Click <em>Watch price</em> on any flight result.</p>`;
  });
  if (unsub) watchUnsub = unsub;
  else list.innerHTML = `<p>Sign in to view your price watches.</p>`;

  list.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-watch-delete]");
    if (!btn) return;
    if (!confirm("Delete this watch?")) return;
    try { await deleteWatch(btn.dataset.watchDelete!); }
    catch (err) { alert("Delete failed: " + (err as Error).message); }
  });
}

function renderAboutTab() {
  app.innerHTML = `
    <section class="about">
      <h2>About BestFlight</h2>
      <p>BestFlight finds the best flight for you, not just the cheapest, by combining:</p>
      <ul>
        <li><strong>Multi-source search</strong> — Duffel + Amadeus + Travelpayouts in parallel.</li>
        <li><strong>Smart ranking</strong> — cheapest, fastest, lowest-carbon, comfort, weighted by what matters to you.</li>
        <li><strong>Connection optimizer</strong> — optional self-transfer and hidden-city tickets, with full warnings.</li>
        <li><strong>AI fare-trend</strong> — buy now or wait, based on historical prices.</li>
        <li><strong>AI best-pick</strong> — one offer, with a 2-sentence reason.</li>
        <li><strong>Price watches</strong> — get a push when your route drops.</li>
      </ul>
      <p><small>Open-source. <a href="https://github.com/philipposk/BestFlight" target="_blank" rel="noopener">GitHub</a>.</small></p>
    </section>
  `;
}

function renderAuthSlot(user: { displayName?: string | null; email?: string | null } | null) {
  if (user) {
    authSlot.innerHTML = `
      <span class="who">${user.displayName || user.email}</span>
      <button class="btn btn-ghost" id="sign-out">Sign out</button>
    `;
    authSlot.querySelector("#sign-out")?.addEventListener("click", () => signOutUser());
  } else {
    authSlot.innerHTML = `<button class="btn btn-outline" id="sign-in">Sign in</button>`;
    authSlot.querySelector("#sign-in")?.addEventListener("click", async () => {
      try { await signInWithGoogle(); } catch (e) { alert("Sign-in failed: " + (e as Error).message); }
    });
  }
}

window.addEventListener("hashchange", render);
onAuthChange((u) => {
  renderAuthSlot(u);
  if (currentTab() === "watches") render();
});
render();

listenForeground((n) => {
  if (Notification.permission === "granted") {
    new Notification(n.title || "BestFlight", { body: n.body });
  }
});
