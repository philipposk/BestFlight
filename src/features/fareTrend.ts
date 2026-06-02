// Fare-trend buy/wait widget.

import { api } from "../services/flightApi";

export async function renderFareTrend(
  from: string,
  to: string,
  date: string,
  cabin = "economy",
  currentPrice?: number
): Promise<string> {
  try {
    const p = await api.aiFareTrend(from, to, date, cabin, currentPrice);
    const icon = p.recommendation === "buy" ? "✅" : p.recommendation === "wait" ? "⏳" : "👀";
    const label =
      p.recommendation === "buy" ? "Buy now" :
      p.recommendation === "wait" ? "Wait" : "Monitor";
    const conf = Math.round(p.confidence * 100);
    return `
      <div class="trend trend-${p.recommendation}">
        <div class="trend-head">${icon} <strong>${label}</strong> · ${conf}% confidence</div>
        <div class="trend-body">
          <div>Expected next 7 days: <strong>${signed(p.expectedChangePct7d)}%</strong></div>
          <div>Expected next 30 days: <strong>${signed(p.expectedChangePct30d)}%</strong></div>
          <p>${escapeHtml(p.reasoning)}</p>
          <small>AI estimate based on historical prices. Not a guarantee.</small>
        </div>
      </div>
    `;
  } catch (e) {
    return `<div class="trend trend-error"><small>Fare trend unavailable: ${escapeHtml(String(e))}</small></div>`;
  }
}

function signed(n: number): string { return (n > 0 ? "+" : "") + n.toFixed(1); }
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
