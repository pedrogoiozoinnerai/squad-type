import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Freio das rotas públicas do funil.
 *
 * O funil inteiro é público por definição — é uma landing page. Só que três
 * rotas dele ESCREVEM: `POST /api/leads` cria um lead, o `PATCH` preenche, e
 * `POST .../reservar` ocupa um assento numa sessão de verdade, com 20 lugares,
 * que um vendedor de verdade vai conduzir.
 *
 * Sem freio, um laço de vinte requisições lota uma sessão e um laço sobre a
 * agenda lota a semana — e cada lead falso ainda atravessa para o CRM, é
 * distribuído a um closer e vira tarefa. Isso foi medido, não suposto: seis
 * requisições, seis assentos.
 *
 * **Sem tabela nova.** O contador é o próprio `Lead`: o abuso é justamente
 * criar linhas demais, então a linha criada É o registro do abuso. Uma tabela
 * de baldes seria mais precisa e exigiria migração, coluna de expiração e
 * limpeza — para medir o que já está medido.
 */

/// Quantos funis a mesma origem pode começar por hora.
///
/// Vinte é folgado para gente: um escritório inteiro atrás do mesmo NAT não
/// começa vinte diagnósticos em uma hora. E é apertado para robô — sem isto o
/// teto é a velocidade da rede.
const FUNIS_POR_HORA = 20;

/// Quantos assentos a mesma origem pode reservar por hora.
///
/// Cinco. Uma pessoa reserva um; alguém remarcando reserva dois ou três. Cinco
/// cobre a família inteira decidindo junto e ainda impede que uma sessão de
/// vinte lugares seja esvaziada de um endereço só.
const RESERVAS_POR_HORA = 5;

const UMA_HORA = 60 * 60 * 1000;

/**
 * De onde veio a requisição — **a única definição**.
 *
 * Quem GRAVA `Lead.ipAddress` e quem CONTA por origem precisam usar esta mesma
 * função. A primeira versão do freio tinha duas definições: a rota gravava o
 * primeiro `x-forwarded-for` e o contador lia `x-real-ip`. Os dois valores
 * divergiam, o contador somava um balde que nunca era preenchido, e o limite
 * simplesmente não existia — dez reservas seguidas da mesma origem passaram
 * sem um 429. Foi assim que este comentário nasceu.
 *
 * `x-real-ip` primeiro: na Vercel ele é escrito pelo proxy e o cliente não
 * alcança. O `x-forwarded-for` é a segunda opção e vem com uma ressalva — se
 * algum dia houver um proxy à frente que ANEXE em vez de sobrescrever, o
 * primeiro item da lista passa a ser o que o cliente mandou, e aí o freio seria
 * contornado trocando um cabeçalho.
 *
 * Devolve `null` quando não há cabeçalho nenhum, que é o caso do `localhost`.
 * Sem origem não há o que contar, e barrar todo mundo junto num balde
 * "desconhecido" derrubaria o desenvolvimento inteiro. Em produção o cabeçalho
 * sempre existe.
 */
export function origemDe(request: NextRequest): string | null {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 45);
  const encaminhado = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado ? encaminhado.slice(0, 45) : null;
}

export type Veredicto = { permitido: true } | { permitido: false; esperarSegundos: number };

const LIBERADO: Veredicto = { permitido: true };

/** Esta origem já começou funis demais na última hora? */
export async function podeComecarFunil(request: NextRequest): Promise<Veredicto> {
  const origem = origemDe(request);
  if (!origem) return LIBERADO;

  const desde = new Date(Date.now() - UMA_HORA);
  const quantos = await prisma.lead
    .count({ where: { ipAddress: origem, createdAt: { gte: desde } } })
    // Falha ABERTO, como o limite do CRM: este freio protege contra abuso, e
    // derrubar o funil inteiro porque o contador caiu troca um problema
    // pequeno por um grande. O erro vai para o log; a venda não para.
    .catch((erro) => {
      console.error("[limite] contador indisponível, deixando passar:", erro);
      return 0;
    });

  return quantos < FUNIS_POR_HORA ? LIBERADO : { permitido: false, esperarSegundos: 600 };
}

/** Esta origem já reservou assentos demais na última hora? */
export async function podeReservar(request: NextRequest): Promise<Veredicto> {
  const origem = origemDe(request);
  if (!origem) return LIBERADO;

  const desde = new Date(Date.now() - UMA_HORA);
  const quantos = await prisma.lead
    .count({
      where: { ipAddress: origem, crmMeetingId: { not: null }, updatedAt: { gte: desde } },
    })
    .catch((erro) => {
      console.error("[limite] contador indisponível, deixando passar:", erro);
      return 0;
    });

  return quantos < RESERVAS_POR_HORA ? LIBERADO : { permitido: false, esperarSegundos: 900 };
}

/** A resposta de quem passou do teto. */
export function respostaDeExcesso(veredicto: { esperarSegundos: number }) {
  return Response.json(
    { erro: "Muitas tentativas deste endereço. Tente de novo em alguns minutos." },
    { status: 429, headers: { "retry-after": String(veredicto.esperarSegundos) } },
  );
}
