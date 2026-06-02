// One-card affiliate hotel/transfer add-on after a flight is selected.

import { api } from "../services/flightApi";

export async function renderHotelCard(
  destinationCity: string,
  arrivalDate: string,
  nights = 3
): Promise<string> {
  const checkOut = addDays(arrivalDate, nights);
  let url = "#";
  try {
    const r = await api.hotelsAffiliate(destinationCity, arrivalDate, checkOut, 2);
    url = r.url;
  } catch {/* fall through */}
  return `
    <div class="addon-card">
      <h4>🏨 Need a hotel in ${escapeHtml(destinationCity)}?</h4>
      <p>${nights} nights from ${arrivalDate} via Hotellook.</p>
      <a class="btn btn-outline" href="${url}" target="_blank" rel="noopener noreferrer">Compare hotel deals →</a>
    </div>
  `;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
