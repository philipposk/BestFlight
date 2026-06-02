// Parallel flight search: Duffel + Amadeus + Travelpayouts → normalized offers.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, requireMethod, badRequest, serverError } from "./_helpers";
import { searchDuffelFlights, type DuffelCabin } from "./lib/duffel";
import { searchAmadeusFlights } from "./lib/amadeus";
import { searchTravelpayoutsFlights, buildAviasalesAffiliateUrl } from "./lib/travelpayouts";
import {
  type NormalizedOffer,
  type NormalizedSegment,
  parseIsoDuration,
  minutesBetween,
} from "./lib/normalize";

export const config = { maxDuration: 30 };

interface SearchBody {
  from: string;
  to: string;
  date: string;
  returnDate?: string;
  passengers?: number;
  cabin?: DuffelCabin;
  currency?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const body = (req.body || {}) as SearchBody;
  const { from, to, date, returnDate, passengers = 1, cabin = "economy", currency = "USD" } = body;
  if (!from || !to || !date) return badRequest(res, "from, to, date required");

  const tasks: Array<Promise<NormalizedOffer[]>> = [];

  if (process.env.DUFFEL_TOKEN) {
    tasks.push(
      searchDuffelFlights(process.env.DUFFEL_TOKEN, from, to, date, passengers, cabin, returnDate)
        .then((offers) => offers.map((o) => normalizeDuffel(o)))
        .catch((e) => { console.error("duffel", e); return []; })
    );
  }

  if (process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET) {
    tasks.push(
      searchAmadeusFlights(
        process.env.AMADEUS_CLIENT_ID,
        process.env.AMADEUS_CLIENT_SECRET,
        from, to, date, passengers, returnDate, cabin
      )
        .then((offers) => offers.map((o) => normalizeAmadeus(o)))
        .catch((e) => { console.error("amadeus", e); return []; })
    );
  }

  if (process.env.TRAVELPAYOUTS_TOKEN && process.env.TRAVELPAYOUTS_MARKER) {
    tasks.push(
      searchTravelpayoutsFlights(
        process.env.TRAVELPAYOUTS_TOKEN,
        process.env.TRAVELPAYOUTS_MARKER,
        from, to, date, currency
      )
        .then((flights) => flights.map((f) =>
          normalizeTravelpayouts(f, process.env.TRAVELPAYOUTS_MARKER!)
        ))
        .catch((e) => { console.error("travelpayouts", e); return []; })
    );
  }

  try {
    const results = await Promise.all(tasks);
    const all = results.flat();
    res.status(200).json({ offers: all, sources: results.map((r, i) => ["duffel", "amadeus", "travelpayouts"][i]).filter(Boolean) });
  } catch (e) {
    serverError(res, e);
  }
}

function normalizeDuffel(o: any): NormalizedOffer {
  const slice = o.slices[0];
  const segs: NormalizedSegment[] = (slice?.segments || []).map((s: any) => ({
    from: s.origin.iata_code,
    to: s.destination.iata_code,
    airline: s.marketing_carrier.name,
    airlineCode: s.marketing_carrier.iata_code,
    flightNumber: s.marketing_carrier_flight_number,
    departure: s.departing_at,
    arrival: s.arriving_at,
    durationMin: parseIsoDuration(s.duration),
    aircraft: s.aircraft?.name,
  }));
  return {
    id: `duffel-${o.id}`,
    source: "duffel",
    segments: segs,
    totalDurationMin: parseIsoDuration(slice?.duration || "PT0M"),
    layovers: Math.max(0, segs.length - 1),
    layoverAirports: segs.slice(0, -1).map((s) => s.to),
    layoverMinutes: segs.slice(1).map((s, i) => minutesBetween(segs[i].arrival, s.departure)),
    price: { amount: Number(o.total_amount), currency: o.total_currency },
    bookable: true,
    offerId: o.id,
    optimizationType: "native",
  };
}

function normalizeAmadeus(o: any): NormalizedOffer {
  const it = o.itineraries[0];
  const segs: NormalizedSegment[] = (it?.segments || []).map((s: any) => ({
    from: s.departure.iataCode,
    to: s.arrival.iataCode,
    airline: s.carrierCode,
    airlineCode: s.carrierCode,
    flightNumber: `${s.carrierCode}${s.number}`,
    departure: s.departure.at,
    arrival: s.arrival.at,
    durationMin: parseIsoDuration(s.duration),
    aircraft: s.aircraft?.code,
  }));
  return {
    id: `amadeus-${o.id}`,
    source: "amadeus",
    segments: segs,
    totalDurationMin: parseIsoDuration(it?.duration || "PT0M"),
    layovers: Math.max(0, segs.length - 1),
    layoverAirports: segs.slice(0, -1).map((s) => s.to),
    layoverMinutes: segs.slice(1).map((s, i) => minutesBetween(segs[i].arrival, s.departure)),
    price: { amount: Number(o.price.total), currency: o.price.currency },
    bookable: false,
    bookingUrl: undefined,
    optimizationType: "native",
  };
}

function normalizeTravelpayouts(f: any, marker: string): NormalizedOffer {
  const segs: NormalizedSegment[] = [{
    from: f.origin,
    to: f.destination,
    airline: f.airline,
    airlineCode: f.airline,
    flightNumber: `${f.airline}${f.flight_number}`,
    departure: f.departure_at,
    arrival: f.departure_at, // TP doesn't return arrival; approximate
    durationMin: f.duration || 0,
  }];
  return {
    id: `tp-${f.airline}${f.flight_number}-${f.departure_at}`,
    source: "travelpayouts",
    segments: segs,
    totalDurationMin: f.duration || 0,
    layovers: 0,
    layoverAirports: [],
    layoverMinutes: [],
    price: { amount: f.price, currency: "USD" },
    bookable: false,
    bookingUrl: f.link || buildAviasalesAffiliateUrl(f.origin, f.destination, f.departure_at.slice(0, 10), marker),
    optimizationType: "native",
  };
}
