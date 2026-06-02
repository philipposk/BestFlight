// Duffel API client — flight search + booking.
// Docs: https://duffel.com/docs/api

const DUFFEL_BASE = "https://api.duffel.com";

export type DuffelCabin = "economy" | "premium_economy" | "business" | "first";

export interface DuffelOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  owner: { iata_code: string; name: string };
  slices: Array<{
    duration: string;
    segments: Array<{
      origin: { iata_code: string };
      destination: { iata_code: string };
      departing_at: string;
      arriving_at: string;
      duration: string;
      marketing_carrier: { name: string; iata_code: string };
      marketing_carrier_flight_number: string;
      aircraft?: { name: string };
    }>;
  }>;
}

async function duffelFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${DUFFEL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": "v2",
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Duffel ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export async function searchDuffelFlights(
  token: string,
  from: string,
  to: string,
  date: string,
  passengers: number,
  cabinClass: DuffelCabin = "economy",
  returnDate?: string
): Promise<DuffelOffer[]> {
  const slices = [{ origin: from, destination: to, departure_date: date }];
  if (returnDate) slices.push({ origin: to, destination: from, departure_date: returnDate });
  const body = {
    data: {
      slices,
      passengers: Array.from({ length: passengers }, () => ({ type: "adult" as const })),
      cabin_class: cabinClass,
    },
  };
  const result = await duffelFetch<{ data: { offers: DuffelOffer[] } }>(
    "/air/offer_requests?return_offers=true",
    token,
    { method: "POST", body: JSON.stringify(body) }
  );
  return result.data.offers || [];
}

export async function createDuffelOrder(
  token: string,
  offerId: string,
  passengers: Array<{
    title: "mr" | "mrs" | "ms" | "miss" | "dr";
    given_name: string;
    family_name: string;
    born_on: string;
    gender: "m" | "f";
    email: string;
    phone_number: string;
  }>
) {
  return duffelFetch<{ data: { id: string; booking_reference: string } }>(
    "/air/orders",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        data: { type: "instant", selected_offers: [offerId], passengers },
      }),
    }
  );
}
