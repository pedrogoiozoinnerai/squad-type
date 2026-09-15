import { NextResponse } from "next/server";
import { buscarDisponibilidade, crmConfigurado } from "@/lib/crm";

/**
 * As sessões disponíveis, para a tela de agendamento do funil.
 *
 * Existe como intermediária de propósito: o navegador não precisa saber onde
 * fica o CRM, e a indisponibilidade dele vira uma resposta só, tratada num
 * lugar só. O endpoint do outro lado é público — aqui não há chave envolvida.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!crmConfigurado()) {
    return NextResponse.json(
      { erro: "Agendamento não configurado.", sessoes: [] },
      { status: 503 }
    );
  }

  try {
    const disponibilidade = await buscarDisponibilidade();
    return NextResponse.json(disponibilidade, {
      // Meio minuto, o mesmo que o CRM devolve. Menos que isso é ir ao CRM à
      // toa; mais que isso é mostrar vaga em sessão que acabou de lotar.
      headers: { "cache-control": "public, max-age=30" },
    });
  } catch (erro) {
    console.error("[api/agenda] CRM indisponível", erro);
    return NextResponse.json(
      { erro: "Não conseguimos carregar os horários agora.", sessoes: [] },
      { status: 502 }
    );
  }
}
