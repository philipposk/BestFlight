// Flight search UI: form + results render. The heart of the app.

import { searchFlights } from "../services/flightAggregator";
import type { NormalizedOffer, SearchParams } from "../services/flightApi";
import { optimize, type OptimizerOptions } from "./connectionsOptimizer";
import { enrichWithCarbon, carbonBadge } from "./carbonBadge";
import { rank, DEFAULT_PRIORITIES, type Priorities } from "./ranking";
import { renderAiBestPick } from "./aiBestPick";
import { renderFareTrend } from "./fareTrend";
import { renderHotelCard } from "./affiliateHotelCard";
import { createWatch, type WatchRoute } from "./priceWatch";
import { auth } from "../firebase";

export interface SearchUiState {
  lastParams?: SearchParams;
  lastOffers?: NormalizedOffer[];
  lastPriorities?: Priorities;
  recommendedOfferId?: string;
}

export const uiState: SearchUiState = {};

export function renderSearchForm(): string {
  return `
    <form id="search-form" class="search-form">
      <div class="row">
        <label>From <input name="from" required maxlength="3" placeholder="LHR" pattern="[A-Za-z]{3}" /></label>
        <label>To <input name="to" required maxlength="3" placeholder="JFK" pattern="[A-Za-z]{3}" /></label>
        <label>Depart <input name="date" type="date" required /></label>
        <label>Return <input name="returnDate" type="date" /></label>
        <label>Passengers <input name="passengers" type="number" min="1" max="9" value="1" /></label>
        <label>Cabin
          <select name="cabin">
            <option value="economy">Economy</option>
            <option value="premium_economy">Premium</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </select>
        </label>
      </div>
      <fieldset class="priorities">
        <legend>What matters most?</legend>
        <label>💰 Price <input type="range" name="p-price" min="0" max="100" value="40" /></label>
        <label>⚡ Speed <input type="range" name="p-speed" min="0" max="100" value="30" /></label>
        <label>🌱 Carbon <input type="range" name="p-carbon" min="0" max="100" value="20" /></label>
        <label>🛋 Comfort <input type="range" name="p-comfort" min="0" max="100" value="10" /></label>
      </fieldset>
      <fieldset class="advanced">
        <legend>Connection options <small>(opt-in, see warnings)</small></legend>
        <label><input type="checkbox" name="self-transfer" /> Self-transfer (two tickets)</label>
        <label><input type="checkbox" name="hidden-city" /> Hidden-city tickets</label>
      </fieldset>
      <button type="submit" class="btn btn-primary">Search flights</button>
    </form>
    <div id="search-status" class="search-status"></div>
    <div id="ai-panels"></div>
    <div id="search-results" class="results"></div>
    <div id="addons"></div>
  `;
}

export function attachSearchHandler(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>("#search-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const params: SearchParams = {
      from: String(fd.get("from")).toUpperCase(),
      to: String(fd.get("to")).toUpperCase(),
      date: String(fd.get("date")),
      returnDate: (fd.get("returnDate") as string) || undefined,
      passengers: Number(fd.get("passengers")) || 1,
      cabin: (fd.get("cabin") as SearchParams["cabin"]) || "economy",
    };
    const priorities: Priorities = {
      price: Number(fd.get("p-price")) / 100,
      speed: Number(fd.get("p-speed")) / 100,
      carbon: Number(fd.get("p-carbon")) / 100,
      comfort: Number(fd.get("p-comfort")) / 100,
    };
    const optOpts: OptimizerOptions = {
      selfTransfer: fd.get("self-transfer") === "on",
      hiddenCity: fd.get("hidden-city") === "on",
    };
    await runSearch(root, params, priorities, optOpts);
  });
}

async function runSearch(
  root: HTMLElement,
  params: SearchParams,
  priorities: Priorities,
  optOpts: OptimizerOptions
) {
  const status = root.querySelector<HTMLElement>("#search-status")!;
  const results = root.querySelector<HTMLElement>("#search-results")!;
  const aiPanels = root.querySelector<HTMLElement>("#ai-panels")!;
  const addons = root.querySelector<HTMLElement>("#addons")!;

  status.textContent = "Searching…";
  results.innerHTML = "";
  aiPanels.innerHTML = "";
  addons.innerHTML = "";

  try {
    const searched = await searchFlights(params);
    if (searched.message && searched.offers.length === 0) {
      status.textContent = searched.message;
      return;
    }
    let offers = searched.offers;
    if (optOpts.selfTransfer || optOpts.hiddenCity) {
      offers = offers.concat(optimize(offers, params.from, params.to, optOpts));
    }
    if (offers.length === 0) {
      status.textContent = "No flights found.";
      return;
    }

    status.textContent = `${offers.length} offers from ${new Set(offers.map((o) => o.source)).size} sources. Enriching…`;
    await enrichWithCarbon(offers).catch(() => {});

    const ranked = rank(offers, priorities);
    uiState.lastParams = params;
    uiState.lastOffers = ranked;
    uiState.lastPriorities = priorities;

    results.innerHTML = ranked.map((o) => renderOfferCard(o)).join("");
    attachOfferActions(results, params);
    status.textContent = `${ranked.length} ranked offers`;

    // AI panels in parallel
    renderAiBestPick(ranked, priorities).then(({ html, recommendedOfferId }) => {
      uiState.recommendedOfferId = recommendedOfferId;
      aiPanels.insertAdjacentHTML("afterbegin", html);
      if (recommendedOfferId) {
        const el = results.querySelector(`[data-offer-id="${CSS.escape(recommendedOfferId)}"]`);
        el?.classList.add("offer-recommended");
      }
    });
    renderFareTrend(params.from, params.to, params.date, params.cabin, ranked[0].price.amount)
      .then((html) => aiPanels.insertAdjacentHTML("beforeend", html));

    // Optional add-ons
    renderHotelCard(params.to, params.returnDate ? params.date : params.date, 3)
      .then((html) => { addons.innerHTML = html; });
  } catch (e) {
    status.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function renderOfferCard(o: NormalizedOffer): string {
  const first = o.segments[0], last = o.segments[o.segments.length - 1];
  const dur = `${Math.floor(o.totalDurationMin / 60)}h ${o.totalDurationMin % 60}m`;
  const stops = o.layovers === 0 ? "Nonstop" : `${o.layovers} stop${o.layovers > 1 ? "s" : ""} via ${o.layoverAirports.join(", ")}`;
  const warnings = (o.warnings || []).map((w) => `<li>${escapeHtml(w)}</li>`).join("");
  const tag = o.optimizationType && o.optimizationType !== "native"
    ? `<span class="tag tag-${o.optimizationType}">${o.optimizationType.replace("-", " ")}</span>` : "";
  const action = o.bookable && o.offerId
    ? `<button class="btn btn-primary" data-book="${escapeHtml(o.offerId)}">Book</button>`
    : `<a class="btn btn-primary" href="${escapeHtml(o.bookingUrl || "#")}" target="_blank" rel="noopener noreferrer">Go to site →</a>`;
  return `
    <article class="offer" data-offer-id="${escapeHtml(o.id)}">
      <div class="offer-main">
        <div class="offer-route">
          <strong>${first.departure.slice(11, 16)}</strong> ${first.from}
          <span class="arrow">→</span>
          <strong>${last.arrival.slice(11, 16)}</strong> ${last.to}
          ${tag}
        </div>
        <div class="offer-meta">
          <span>${dur}</span> · <span>${stops}</span> · <span class="airline">${escapeHtml(first.airline)}</span>
          ${carbonBadge(o.co2Kg)}
        </div>
        ${warnings ? `<details class="offer-warnings"><summary>⚠️ ${o.warnings!.length} warning${o.warnings!.length > 1 ? "s" : ""}</summary><ul>${warnings}</ul></details>` : ""}
      </div>
      <div class="offer-side">
        <div class="price"><strong>${o.price.currency} ${o.price.amount.toFixed(0)}</strong></div>
        <small class="source">via ${o.source}</small>
        <div class="actions">
          ${action}
          <button class="btn btn-ghost" data-watch="${escapeHtml(o.id)}">Watch price</button>
        </div>
      </div>
    </article>
  `;
}

function attachOfferActions(root: HTMLElement, params: SearchParams) {
  root.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const watchBtn = target.closest<HTMLElement>("[data-watch]");
    if (watchBtn) {
      if (!auth.currentUser) {
        alert("Sign in to set a price watch.");
        return;
      }
      const route: WatchRoute = {
        from: params.from,
        to: params.to,
        depart: params.date,
        return: params.returnDate,
        cabin: params.cabin || "economy",
        pax: params.passengers || 1,
      };
      const threshold = prompt("Alert me when price drops below (number, blank = any new low):");
      try {
        const id = await createWatch(route, threshold ? Number(threshold) : undefined);
        watchBtn.textContent = "✓ Watching";
        watchBtn.setAttribute("disabled", "");
        console.info("watch created", id);
      } catch (e) {
        alert("Could not create watch: " + (e as Error).message);
      }
    }
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
