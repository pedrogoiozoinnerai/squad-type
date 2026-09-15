"use client";

import type { StepKey } from "@/lib/funnel";

class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

/** Erros 4xx são falhas do próprio pedido (payload inválido, sessão inexistente) —
 * tentar de novo com os mesmos dados nunca vai ter sucesso, então só re-tentamos
 * falhas de rede ou 5xx (erro transitório do servidor). */
function isRetryable(err: unknown): boolean {
  return !(err instanceof HttpError) || err.status >= 500;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i === attempts - 1 || !isRetryable(err)) throw err;
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, i)));
    }
  }
  throw lastError;
}

/** Envolve uma chamada fire-and-forget: registra o erro no console em vez de
 * deixar a rejeição sem tratamento (os call sites não aguardam o resultado). */
async function safe(fn: () => Promise<unknown>, label: string) {
  try {
    await withRetry(fn);
  } catch (err) {
    console.error(`[api-client] ${label} falhou`, err);
  }
}

/**
 * A criação do lead é disparada na montagem do chat e ninguém a aguarda. Se o
 * usuário respondesse o primeiro passo antes de ela terminar, o PATCH chegaria
 * ao servidor antes do POST e a resposta se perderia. Guardamos a promessa aqui
 * e todo envio posterior espera por ela — a fila do funil passa a ser ordenada
 * por construção, sem depender da velocidade da rede do usuário.
 */
let leadCreated: Promise<void> | null = null;

async function afterLeadExists() {
  if (!leadCreated) return;
  try {
    await leadCreated;
  } catch {
    // O servidor cria o lead no próprio PATCH se ele ainda não existir, então
    // vale seguir mesmo quando a criação falhou: é melhor gravar a resposta
    // tarde do que descartá-la.
  }
}

export function initLead(payload: {
  sessionId: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  referrer?: string | null;
  landingUrl?: string | null;
}) {
  const call = withRetry(() =>
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((res) => {
      if (!res.ok) throw new HttpError("init_failed", res.status);
      return res.json();
    })
  ).then(() => undefined);

  leadCreated = call;
  return call.catch((err) => {
    console.error("[api-client] initLead falhou", err);
  });
}

export function submitStep(sessionId: string, step: StepKey, value: Record<string, unknown>) {
  return safe(async () => {
    await afterLeadExists();
    const res = await fetch(`/api/leads/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, value }),
    });
    if (!res.ok) throw new HttpError("submit_failed", res.status);
    return res.json();
  }, `submitStep(${step})`);
}

export function submitSchedule(
  sessionId: string,
  payload: { calBookingUid: string; scheduledAt: string; meetingLocation?: string }
) {
  return safe(async () => {
    await afterLeadExists();
    const res = await fetch(`/api/leads/${sessionId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new HttpError("schedule_failed", res.status);
    return res.json();
  }, "submitSchedule");
}
