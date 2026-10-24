// Shared normalized flight type — server returns this; client consumes directly.

export interface NormalizedSegment {
  from: string;          // IATA
  to: string;
  airline: string;
  airlineCode?: string;
  flightNumber: string;
  departure: string;     // ISO
  arrival: string;       // ISO
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
  bookable: boolean;     // Duffel offers are bookable; Amadeus/TP are link-out
  bookingUrl?: string;
  offerId?: string;      // for Duffel /api/create-flight-order
  refundable?: boolean;
  // optionally enriched downstream
  co2Kg?: number;
  optimizationType?: "native" | "self-transfer" | "hidden-city";
  warnings?: string[];
}

// Parse ISO 8601 duration like "PT2H30M" → minutes
export function parseIsoDuration(iso: string): number {
  if (!iso) return 0;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return 0;
  return (parseInt(m[1] || "0", 10) * 60) + parseInt(m[2] || "0", 10);
}

export function minutesBetween(aIso: string, bIso: string): number {
  return Math.max(0, Math.round((Date.parse(bIso) - Date.parse(aIso)) / 60000));
}
