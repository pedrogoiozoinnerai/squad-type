import "server-only";

/**
 * Conversa do funil com o CRM (MeetSquad), que é quem guarda as sessões de
 * apresentação e as inscrições.
 *
 * Duas regras moram aqui e não podem escorregar para o cliente:
 *
 * A `FUNIL_API_KEY` só existe no servidor. Quem tiver essa chave inscreve
 * qualquer pessoa em qualquer sessão, então nada neste arquivo pode ser
 * importado por um componente — `server-only` transforma esse descuido em erro
 * de build em vez de vazamento em produção.
 *
 * E o endereço do CRM também fica aqui: o navegador fala com as nossas rotas,
 * que falam com o CRM. Se ele sair do ar, é um lugar só para tratar.
 */

const TEMPO_LIMITE_MS = 8000;

export type SessaoDisponivel = {
  id: string;
  /** UTC. Formate sempre com timeZone explícito — a Vercel roda em UTC. */
  inicioEm: string;
  duracaoMin: number;
  lotacao: number;
  inscritos: number;
  vagas: number;
};

export type Disponibilidade = {
  timezone: string;
  sessoes: SessaoDisponivel[];
};

export type DadosDaReserva = {
  meetingId: string;
  typeSessionId: string;
  typeLeadId?: string;
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  segmento?: string;
  cargo?: string;
  faturamento?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export type ResultadoReserva =
  | {
      tipo: "ok";
      jaEstava: boolean;
      convite: string;
      reuniao: { id: string; comecaEm: string };
    }
  /** A sessão encheu entre a escolha e o clique. Não é erro: é corrida normal. */
  | { tipo: "lotada" }
  /** Cancelada, já começada ou inexistente — a lista precisa ser recarregada. */
  | { tipo: "indisponivel"; mensagem: string }
  | { tipo: "erro"; mensagem: string };

function baseDoCrm(): string | null {
  const url = process.env.CRM_URL?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

export function crmConfigurado(): boolean {
  return Boolean(baseDoCrm() && process.env.FUNIL_API_KEY?.trim());
}

/**
 * Sessões com vaga. Endpoint público do CRM — não mandamos a chave aqui, porque
 * ler a agenda não muda nada e a resposta não traz nome de ninguém.
 */
export async function buscarDisponibilidade(): Promise<Disponibilidade> {
  const base = baseDoCrm();
  if (!base) throw new Error("CRM_URL não configurada.");

  const res = await fetch(`${base}/api/agenda/disponibilidade`, {
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    // A rota do CRM já manda `cache-control: max-age=30`; não guardamos nada
    // além disso, senão mostraríamos vaga em sessão lotada.
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`CRM respondeu ${res.status} na disponibilidade.`);

  const corpo = (await res.json()) as Partial<Disponibilidade>;
  return {
    timezone: corpo.timezone ?? "America/Sao_Paulo",
    sessoes: Array.isArray(corpo.sessoes) ? corpo.sessoes : [],
  };
}

export async function reservarVaga(dados: DadosDaReserva): Promise<ResultadoReserva> {
  const base = baseDoCrm();
  const chave = process.env.FUNIL_API_KEY?.trim();
  if (!base || !chave) {
    return { tipo: "erro", mensagem: "Agendamento não configurado neste ambiente." };
  }

  let res: Response;
  try {
    res = await fetch(`${base}/api/agenda/reservar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chave}`,
      },
      body: JSON.stringify(dados),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      cache: "no-store",
    });
  } catch {
    return { tipo: "erro", mensagem: "Não conseguimos falar com a agenda agora." };
  }

  const corpo = (await res.json().catch(() => null)) as
    | {
        ok?: boolean;
        jaEstava?: boolean;
        convite?: string;
        reuniao?: { id: string; comecaEm: string };
        erro?: string;
        lotada?: boolean;
      }
    | null;

  if (res.ok && corpo?.convite && corpo.reuniao) {
    return {
      tipo: "ok",
      jaEstava: Boolean(corpo.jaEstava),
      convite: corpo.convite,
      reuniao: corpo.reuniao,
    };
  }

  if (res.status === 409 && corpo?.lotada) return { tipo: "lotada" };

  if (res.status === 409 || res.status === 404) {
    return {
      tipo: "indisponivel",
      mensagem: corpo?.erro ?? "Esta sessão não está mais disponível.",
    };
  }

  // 401 (chave errada), 400 (faltou campo), 503 (CRM sem chave) e o resto são
  // problemas nossos de configuração — o lead não tem o que fazer com o detalhe.
  console.error("[crm] reserva falhou", { status: res.status, erro: corpo?.erro });
  return { tipo: "erro", mensagem: "Não conseguimos concluir o agendamento agora." };
}
