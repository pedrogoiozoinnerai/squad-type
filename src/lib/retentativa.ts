/**
 * Quando vale tentar de novo a reserva no CRM — e quando não vale.
 *
 * O defeito que isto conserta: `reservarVaga` fazia UMA chamada com 8 segundos
 * de limite e desistia. Quem preencheu os sete passos do funil e chegou até o
 * clique final lia "não conseguimos concluir o agendamento agora" e ficava sem
 * saída — o lead mais caro que existe, o que já fez todo o trabalho, perdido
 * por uma piscada de rede.
 *
 * **Repetir um POST só é seguro porque a reserva é idempotente.** O CRM tem
 * `@@unique([meetingId, leadId])` e devolve `jaEstava: true` quando a pessoa já
 * está inscrita. Então a chamada que "falhou" por tempo esgotado mas na verdade
 * gravou não vira uma segunda inscrição: a repetição encontra a primeira. Se um
 * dia essa garantia sair do CRM, este arquivo passa a duplicar reunião — está
 * escrito aqui porque é aqui que alguém vai olhar.
 *
 * Puro e sem relógio — o que decide é o resultado, e quem espera é quem chama.
 */

export type Veredicto =
  /// Deu certo, ou deu um "não" definitivo que o lead precisa ver.
  | "aceitar"
  /// Falha passageira: a mesma chamada de novo pode dar certo.
  | "tentarDeNovo"
  /// Não adianta insistir — insistir só faz o lead esperar mais pelo mesmo não.
  | "desistir";

export type Resultado = {
  /// Ausente quando a requisição nem chegou a ter resposta (rede, tempo).
  status?: number;
  semResposta?: boolean;
};

/**
 * Quantas vezes no total, contando a primeira.
 *
 * Três. A conta é do tempo que a pessoa fica olhando um botão girando: com os
 * limites abaixo, o pior caso é ~21s. Uma quarta tentativa passaria de trinta
 * segundos, e aí o problema deixa de ser a rede e passa a ser a espera.
 */
export const TENTATIVAS = 3;

/**
 * Quanto tempo cada tentativa espera por resposta.
 *
 * A primeira é a mais generosa porque é a que quase sempre funciona; as
 * seguintes são mais curtas porque, se a primeira estourou, insistir com o
 * mesmo limite só multiplica a espera.
 */
export const LIMITES_MS = [8000, 6000, 6000];

/**
 * Quanto esperar ANTES da tentativa `n` (base zero).
 *
 * Sem espera na primeira, e crescendo depois: se o CRM está sobrecarregado,
 * bater de novo no mesmo instante piora exatamente o que se quer que melhore.
 * Curto mesmo assim — há uma pessoa esperando do outro lado.
 */
export function esperaAntesDe(tentativa: number): number {
  return [0, 400, 1200][tentativa] ?? 1200;
}

/**
 * O que fazer com este resultado.
 *
 * O que NÃO se repete é tão importante quanto o que se repete:
 *
 * - **409** é a sessão que lotou ou foi cancelada entre a escolha e o clique.
 *   É uma corrida normal, e a resposta certa é recarregar a lista — repetir
 *   devolveria o mesmo 409 três vezes e faria o lead esperar por nada.
 * - **401 e 400** são erro NOSSO de configuração ou de campo. Repetir não
 *   conserta chave errada.
 * - **404** é sessão que não existe.
 *
 * O que se repete é o que é passageiro por natureza: rede, tempo esgotado,
 * 5xx (o CRM reiniciando, o banco fechando conexão) e 429.
 */
export function comoTratar(resultado: Resultado): Veredicto {
  if (resultado.semResposta) return "tentarDeNovo";

  const status = resultado.status ?? 0;
  if (status >= 200 && status < 300) return "aceitar";
  if (status === 429) return "tentarDeNovo";
  if (status >= 500) return "tentarDeNovo";
  return "desistir";
}

/** Espera de verdade. Separada para o teste não precisar dormir. */
export function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
