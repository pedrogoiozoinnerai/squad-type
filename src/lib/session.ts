"use client";

import { nanoid } from "nanoid";

/**
 * Cada visita é uma conversa nova.
 *
 * O funil já guardou progresso no `localStorage` e retomava de onde parou. Foi
 * retirado de propósito: quem sai e volta recomeça do primeiro campo.
 *
 * O identificador da sessão, por consequência, vive só na memória desta aba —
 * recarregar a página gera outro, e com ele um `Lead` novo. É o preço de não
 * retomar, e é intencional: um identificador guardado faria a pessoa voltar
 * para um cadastro pela metade que a tela não mostra mais.
 */

const CHAVES_ANTIGAS = ["squad_funnel_session_id", "squad_funnel_state_v1"];

export function novaSessao(): string {
  // Limpa o que versões anteriores deixaram gravado no navegador de quem já
  // passou por aqui. Sem isto, o dado morto ficaria para sempre.
  try {
    for (const chave of CHAVES_ANTIGAS) window.localStorage.removeItem(chave);
  } catch {
    // localStorage bloqueado (modo privado, cookies desativados): seguir direto.
  }

  return nanoid();
}
