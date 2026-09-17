import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { crmConfigurado, reservarVaga } from "@/lib/crm";
import { podeReservar, respostaDeExcesso } from "@/lib/limite";

/**
 * Reserva a vaga do lead numa sessão coletiva do CRM.
 *
 * A chamada ao CRM sai daqui, do servidor, porque ela leva a chave
 * compartilhada. O navegador manda só o `meetingId`: todo o resto — nome,
 * contato, empresa, UTMs — vem do que já está gravado no `Lead`, que é a fonte
 * de verdade e não pode ser falsificada por quem abrir o console.
 *
 * Este é o único caminho de escrita do agendamento. Antes havia dois (o
 * cliente pelo `/schedule` e o webhook do Cal.com) e eles podiam divergir.
 */
export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  meetingId: z.string().trim().min(1).max(100),
});

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/leads/[sessionId]/reservar">
) {
  const { sessionId } = await ctx.params;
  if (sessionId.length < 10 || sessionId.length > 100) {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 400 });
  }

  // Antes de qualquer coisa: esta rota OCUPA um assento numa sessão real, de 20
  // lugares, que um vendedor vai conduzir. Ela é pública porque é o navegador
  // do lead que a chama — e sem freio um laço de vinte requisições esvazia a
  // sessão. Isso foi medido: seis requisições, seis assentos.
  const podeVaga = await podeReservar(request);
  if (!podeVaga.permitido) return respostaDeExcesso(podeVaga);

  if (!crmConfigurado()) {
    return NextResponse.json(
      { erro: "Agendamento não configurado." },
      { status: 503 }
    );
  }

  const json = await request.json().catch(() => null);
  const corpo = corpoSchema.safeParse(json);
  if (!corpo.success) {
    return NextResponse.json({ erro: "Informe a sessão escolhida." }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { sessionId } });
  if (!lead) {
    return NextResponse.json({ erro: "Sessão não encontrada." }, { status: 404 });
  }
  // Nome, contato e empresa. O funil já pede os três ANTES de mostrar os
  // horários, então nenhuma pessoa real esbarra nisto — mas para um robô cada
  // assento passa a custar quatro requisições em vez de duas, e um assento
  // reservado sem nenhum jeito de falar com a pessoa não vale nada para o
  // closer de qualquer forma.
  if (!lead.fullName || (!lead.email && !lead.phoneE164)) {
    return NextResponse.json(
      { erro: "Complete o cadastro antes de agendar." },
      { status: 409 }
    );
  }

  const resultado = await reservarVaga({
    meetingId: corpo.data.meetingId,
    typeSessionId: sessionId,
    // A mesma ponte que o cron do CRM usa para casar os registros. Sem ela, o
    // funil cria um lead lá e a sincronização criaria outro dez minutos depois.
    typeLeadId: lead.id,
    nome: lead.fullName,
    email: lead.email ?? undefined,
    telefone: lead.phoneE164 ?? undefined,
    empresa: lead.company ?? undefined,
    segmento: lead.segment ?? undefined,
    cargo: lead.role ?? undefined,
    faturamento: lead.revenueRange ?? undefined,
    utmSource: lead.utmSource ?? undefined,
    utmMedium: lead.utmMedium ?? undefined,
    utmCampaign: lead.utmCampaign ?? undefined,
  });

  if (resultado.tipo === "lotada") {
    return NextResponse.json(
      { erro: "Esta sessão lotou enquanto você escolhia.", lotada: true },
      { status: 409 }
    );
  }

  if (resultado.tipo === "indisponivel") {
    return NextResponse.json({ erro: resultado.mensagem }, { status: 409 });
  }

  if (resultado.tipo === "erro") {
    return NextResponse.json({ erro: resultado.mensagem }, { status: 502 });
  }

  const comecaEm = new Date(resultado.reuniao.comecaEm);

  await prisma.lead.update({
    where: { sessionId },
    data: {
      scheduledAt: Number.isNaN(comecaEm.getTime()) ? undefined : comecaEm,
      crmMeetingId: resultado.reuniao.id,
      crmConviteUrl: resultado.convite,
      status: "COMPLETED",
      // Reenvio não reescreve o instante em que o funil foi concluído.
      completedAt: lead.completedAt ?? new Date(),
      // Só registra o evento quando a inscrição é nova. Reenviar o mesmo pedido
      // devolve a mesma vaga, e a trilha de auditoria não deve crescer por isso.
      events: resultado.jaEstava
        ? undefined
        : {
            create: {
              step: "SCHEDULE",
              payload: JSON.stringify({
                origem: "crm",
                meetingId: resultado.reuniao.id,
                comecaEm: resultado.reuniao.comecaEm,
              }),
            },
          },
    },
  });

  return NextResponse.json({
    ok: true,
    jaEstava: resultado.jaEstava,
    convite: resultado.convite,
    reuniao: resultado.reuniao,
  });
}
