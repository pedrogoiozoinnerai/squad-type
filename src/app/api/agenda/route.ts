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
      {
        erro: "Não conseguimos carregar os horários agora.",
        // Por que falhou, em uma palavra. O log da Vercel tem o detalhe, mas
        // quem está configurando o ambiente costuma só ter esta resposta na
        // mão — e "ENOTFOUND" separa em um segundo um endereço errado de um
        // CRM fora do ar. Nunca ecoa CRM_URL: o diagnóstico não vale um valor
        // de configuração exposto num endpoint público.
        causa: causaProvavel(erro),
        sessoes: [],
      },
      { status: 502 }
    );
  }
}

/**
 * Traduz a falha para um rótulo curto e sem segredo dentro.
 *
 * `fetch` embrulha erros de rede: o código real (ENOTFOUND, ECONNREFUSED) mora
 * em `cause`, não na mensagem de cima.
 */
function causaProvavel(erro: unknown): string {
  const causa = (erro as { cause?: { code?: string } } | null)?.cause;
  if (causa?.code) return causa.code;

  const msg = erro instanceof Error ? erro.message : String(erro);
  // "CRM respondeu 404 na disponibilidade." — o endereço existe mas a rota não.
  const status = msg.match(/respondeu (\d{3})/)?.[1];
  if (status) return `CRM respondeu ${status}`;
  if (erro instanceof Error && erro.name === "TimeoutError") return "TIMEOUT";
  if (msg.includes("CRM_URL")) return "CRM_URL ausente";
  return "desconhecida";
}
