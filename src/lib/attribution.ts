"use client";

// Captura e persiste a atribuição de marketing (UTMs + click ids) num cookie
// próprio, sobrevivendo à navegação entre páginas mesmo quando uma página
// intermediária não carrega os parâmetros na URL (ex: usuário clica num
// anúncio, cai na home, depois navega até este funil sem os UTMs na URL).
//
// Regra: um parâmetro só é atualizado quando a URL atual efetivamente o traz.
// Se a URL atual não tiver um determinado UTM, o valor já salvo é preservado
// (nunca "zera" a atribuição por causa de uma navegação interna sem UTM).

export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  fbclid?: string;
  gclid?: string;
  firstLandingUrl?: string;
  firstReferrer?: string;
  firstSeenAt?: string;
};

const COOKIE_NAME = "squad_attribution";
const COOKIE_MAX_AGE_DAYS = 90;

// Permite compartilhar a atribuição entre subdomínios do squad.com (ex:
// "diagnostico.squad.com" lendo o que foi capturado em "squad.com"), desde
// que outras páginas do domínio gravem o cookie no mesmo formato.
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_ATTRIBUTION_COOKIE_DOMAIN;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  const domainPart = COOKIE_DOMAIN ? `; domain=${COOKIE_DOMAIN}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/${domainPart}; samesite=lax`;
}

function readStoredAttribution(): Attribution {
  try {
    const raw = readCookie(COOKIE_NAME);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}

/** Lê a URL atual + o que já estava salvo, mescla (URL tem prioridade campo a
 * campo, sem apagar o que não veio de novo) e persiste o resultado. */
export function captureAttribution(): Attribution {
  const existing = readStoredAttribution();
  const params = new URLSearchParams(window.location.search);
  const pick = (key: string, current?: string) => params.get(key) ?? current;

  const merged: Attribution = {
    utmSource: pick("utm_source", existing.utmSource),
    utmMedium: pick("utm_medium", existing.utmMedium),
    utmCampaign: pick("utm_campaign", existing.utmCampaign),
    utmTerm: pick("utm_term", existing.utmTerm),
    utmContent: pick("utm_content", existing.utmContent),
    fbclid: pick("fbclid", existing.fbclid),
    gclid: pick("gclid", existing.gclid),
    firstLandingUrl: existing.firstLandingUrl ?? window.location.href,
    firstReferrer: existing.firstReferrer ?? (document.referrer || undefined),
    firstSeenAt: existing.firstSeenAt ?? new Date().toISOString(),
  };

  writeCookie(COOKIE_NAME, JSON.stringify(merged), COOKIE_MAX_AGE_DAYS);
  return merged;
}
