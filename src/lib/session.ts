"use client";

import { nanoid } from "nanoid";

const SESSION_KEY = "squad_funnel_session_id";
const STATE_KEY = "squad_funnel_state_v1";

export function getOrCreateSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = nanoid();
    window.localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    // localStorage indisponível (modo privado, storage bloqueado, etc.)
    return nanoid();
  }
}

export type PersistedFunnelState = {
  sessionId: string;
  stepIndex: number;
  answers: Record<string, unknown>;
  /** `at` é o instante da mensagem e `read` o double-check — ambos precisam
   * sobreviver ao recarregamento, senão a conversa volta sem horário. */
  chatLog: { role: "bot" | "user"; text: string; read?: boolean; at?: number }[];
};

export function loadFunnelState(): PersistedFunnelState | null {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedFunnelState;
  } catch {
    return null;
  }
}

export function saveFunnelState(state: PersistedFunnelState): void {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // ignora falha de storage — a conversa continua funcionando nesta sessão
  }
}
