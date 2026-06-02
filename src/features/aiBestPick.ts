// AI best-pick recommendation panel.

import { api, type NormalizedOffer } from "../services/flightApi";
import type { Priorities } from "./ranking";

export async function renderAiBestPick(
  offers: NormalizedOffer[],
  priorities: Priorities
): Promise<{ html: string; recommendedOfferId?: string }> {
  if (offers.length === 0) return { html: "" };
  try {
    const r = await api.aiExplainBestPick(offers.slice(0, 10), priorities as unknown as Record<string, number>);
    const html = `
      <div class="best-pick">
        <h3>🤖 AI Recommendation</h3>
        <p class="best-pick-reason">${escapeHtml(r.reasoning)}</p>
        ${r.runnerUpReason ? `<p class="best-pick-runnerup"><small>Runner-up: ${escapeHtml(r.runnerUpReason)}</small></p>` : ""}
      </div>
    `;
    return { html, recommendedOfferId: r.recommendedOfferId };
  } catch (e) {
    return { html: `<div class="best-pick best-pick-error"><small>AI pick unavailable: ${escapeHtml(String(e))}</small></div>` };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
