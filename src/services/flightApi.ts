// Typed client wrappers for every /api/* route.

import { getIdToken } from "../authSetup";

export interface NormalizedSegment {
  from: string;
  to: string;
  airline: string;
  airlineCode?: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  durationMin: number;
  aircraft?: string;
}

export interface NormalizedOffer {
  id: string;
  source: "duffel" | "amadeus" | "travelpayouts";
  segments: NormalizedSegment[];
  totalDurationMin: number;
  layovers: number;
  layoverAirports: string[];
  layoverMinutes: number[];
  price: { amount: number; currency: string };
  bookable: boolean;
  bookingUrl?: string;
  offerId?: string;
  refundable?: boolean;
  co2Kg?: number;
  optimizationType?: "native" | "self-transfer" | "hidden-city";
  warnings?: string[];
}

export interface SearchParams {
  from: string;
  to: string;
  date: string;
  returnDate?: string;
  passengers?: number;
  cabin?: "economy" | "premium_economy" | "business" | "first";
  currency?: string;
}

async function post<T>(path: string, body: unknown, auth = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const tok = await getIdToken();
    if (tok) headers["Authorization"] = `Bearer ${tok}`;
  }
  const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  searchFlights: (params: SearchParams) =>
    post<{ offers: NormalizedOffer[]; sources?: string[]; missing?: string[]; message?: string }>("/api/search-flights", params),

  createFlightOrder: (offerId: string, passengers: unknown[]) =>
    post<{ id: string; booking_reference: string }>("/api/create-flight-order", { offerId, passengers }, true),

  carbon: (from: string, to: string, passengers = 1, cabin = "economy") =>
    post<{ co2Kg: number | null }>("/api/carbon", { from, to, passengers, cabin }),

  convertCurrency: (from: string, to: string, amount: number) =>
    post<{ rate: number | null; converted: number | null }>("/api/convert-currency", { from, to, amount }),

  hotelsAffiliate: (city: string, checkIn: string, checkOut: string, adults = 2) =>
    post<{ url: string }>("/api/hotels-affiliate", { city, checkIn, checkOut, adults }),

  airports: (q: string) =>
    get<{ results: Array<{ code: string; name: string; city: string; country: string; type: string }> }>(
      `/api/airports?q=${encodeURIComponent(q)}`
    ),

  aiExplainBestPick: (offers: NormalizedOffer[], priorities?: Record<string, number>) =>
    post<{ recommendedOfferId: string; reasoning: string; runnerUpId?: string; runnerUpReason?: string }>(
      "/api/ai/explain-best-pick",
      { offers, priorities }
    ),

  aiFareTrend: (from: string, to: string, date: string, cabin = "economy", currentPrice?: number) =>
    post<{
      recommendation: "buy" | "wait" | "monitor";
      confidence: number;
      expectedChangePct7d: number;
      expectedChangePct30d: number;
      reasoning: string;
    }>("/api/ai/fare-trend", { from, to, date, cabin, currentPrice }),

  aiAssistant: (messages: Array<{ role: "user" | "assistant"; content: string }>, context?: unknown) =>
    post<{ reply: string }>("/api/ai/assistant", { messages, context }),

  priceWatchCreate: (route: unknown, threshold?: number, currency = "USD", fcmToken?: string) =>
    post<{ watchId: string }>("/api/price-watch/create", { route, threshold, currency, fcmToken }, true),

  priceWatchDelete: (watchId: string) =>
    post<{ ok: true }>("/api/price-watch/delete", { watchId }, true),
};
