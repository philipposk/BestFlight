// Amadeus Self-Service API — flights only for BestFlight.

const AMADEUS_BASE = "https://test.api.amadeus.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAmadeusToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
  const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  });
  if (!res.ok) throw new Error(`Amadeus auth ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export interface AmadeusFlightOffer {
  id: string;
  price: { total: string; currency: string };
  itineraries: Array<{
    duration: string;
    segments: Array<{
      departure: { iataCode: string; at: string };
      arrival: { iataCode: string; at: string };
      carrierCode: string;
      number: string;
      duration: string;
      aircraft?: { code: string };
    }>;
  }>;
}

export async function searchAmadeusFlights(
  clientId: string,
  clientSecret: string,
  from: string,
  to: string,
  date: string,
  passengers: number,
  returnDate?: string,
  cabinClass?: string
): Promise<AmadeusFlightOffer[]> {
  const token = await getAmadeusToken(clientId, clientSecret);
  const url = new URL(`${AMADEUS_BASE}/v2/shopping/flight-offers`);
  url.searchParams.set("originLocationCode", from);
  url.searchParams.set("destinationLocationCode", to);
  url.searchParams.set("departureDate", date);
  if (returnDate) url.searchParams.set("returnDate", returnDate);
  url.searchParams.set("adults", String(passengers));
  url.searchParams.set("max", "20");
  if (cabinClass) url.searchParams.set("travelClass", cabinClass.toUpperCase());
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Amadeus flights ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: AmadeusFlightOffer[] };
  return json.data || [];
}

export interface AmadeusLocation {
  iataCode: string;
  name: string;
  detailedName: string;
  subType: "AIRPORT" | "CITY";
  address: { cityName: string; countryName: string; countryCode: string };
}

export async function searchAmadeusLocations(
  clientId: string,
  clientSecret: string,
  keyword: string
): Promise<AmadeusLocation[]> {
  const token = await getAmadeusToken(clientId, clientSecret);
  const url = new URL(`${AMADEUS_BASE}/v1/reference-data/locations`);
  url.searchParams.set("subType", "AIRPORT,CITY");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("page[limit]", "10");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const json = (await res.json()) as { data: AmadeusLocation[] };
  return json.data || [];
}
