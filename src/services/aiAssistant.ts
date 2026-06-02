// Thin assistant wrapper. Stores history client-side.

import { api } from "./flightApi";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

export class AIAssistant {
  history: AssistantMessage[] = [];
  context: unknown = null;

  setContext(ctx: unknown) { this.context = ctx; }

  async ask(message: string): Promise<string> {
    const userMsg: AssistantMessage = { role: "user", content: message, ts: Date.now() };
    this.history.push(userMsg);
    const messages = this.history.map((m) => ({ role: m.role, content: m.content }));
    const { reply } = await api.aiAssistant(messages, this.context);
    this.history.push({ role: "assistant", content: reply, ts: Date.now() });
    return reply;
  }

  reset() { this.history = []; }
}
