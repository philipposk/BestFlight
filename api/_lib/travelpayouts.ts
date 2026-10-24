// Travelpayouts (Aviasales + Hotellook) affiliate API.
// Docs: https://support.travelpayouts.com/hc/en-us/categories/200358578

const FLIGHT_BASE = "https://api.travelpayouts.com/aviasales/v3";

export interface TPFlight {
  origin: string;
  destination: string;
  price: number;
  airline: string;
  flight_number: string;
  departure_at: string;
  return_at?: string;
  duration: number; // minutes (flight only)
  duration_to?: number;
  link: string;
}

export async function searchTravelpayoutsFlights(
  token: string,
  marker: string,
  from: string,
  to: string,
  date: string,
  currency = "USD",
  oneWay = true
): Promise<TPFlight[]> {
  const url = new URL(`${FLIGHT_BASE}/prices_for_dates`);
  url.searchParams.set("origin", from);
  url.searchParams.set("destination", to);
  url.searchParams.set("departure_at", date);
  url.searchParams.set("currency", currency);
  url.searchParams.set("token", token);
  url.searchParams.set("marker", marker);
  url.searchParams.set("sorting", "price");
  url.searchParams.set("limit", "30");
  url.searchParams.set("one_way", oneWay ? "true" : "false");
  const res = await fetch(url);
  if (!res.ok) return [];
  const j = (await res.json()) as { data: TPFlight[] };
  return (j.data || []).map((f) => ({
    ...f,
    link: f.link?.startsWith("http") ? f.link : `https://www.aviasales.com${f.link}?marker=${marker}`,
  }));
}

// Calendar of cheapest prices per day (last ~90 days) — basis for trend
export async function travelpayoutsPriceCalendar(
  token: string,
  marker: string,
  from: string,
  to: string,
  currency = "USD"
): Promise<Array<{ date: string; price: number }>> {
  const url = new URL("https://api.travelpayouts.com/v2/prices/month-matrix");
  url.searchParams.set("origin", from);
  url.searchParams.set("destination", to);
  url.searchParams.set("currency", currency);
  url.searchParams.set("token", token);
  url.searchParams.set("marker", marker);
  const res = await fetch(url);
  if (!res.ok) return [];
  const j = (await res.json()) as { data: Array<{ depart_date: string; value: number }> };
  return (j.data || []).map((d) => ({ date: d.depart_date, price: d.value }));
}

export function buildAviasalesAffiliateUrl(
  from: string,
  to: string,
  date: string,
  marker: string
): string {
  return `https://www.aviasales.com/search/${from}${date.replace(/-/g, "").slice(2)}${to}1?marker=${marker}`;
}

export function buildHotellookAffiliateUrl(
  cityName: string,
  checkIn: string,
  checkOut: string,
  marker: string,
  adults = 2
): string {
  const u = new URL("https://search.hotellook.com/");
  u.searchParams.set("destination", cityName);
  u.searchParams.set("checkIn", checkIn);
  u.searchParams.set("checkOut", checkOut);
  u.searchParams.set("adults", String(adults));
  u.searchParams.set("marker", marker);
  return u.toString();
}
