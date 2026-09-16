"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StepAnswers } from "@/lib/funnel";
import { BRAND_NAME } from "@/lib/funnel";
import { calcularFim, linkGoogleAgenda } from "@/lib/google-calendar";

/** As sessões são coletivas e acontecem no horário de Brasília, sempre. */
const TZ = "America/Sao_Paulo";

type Sessao = {
  id: string;
  inicioEm: string;
  duracaoMin: number;
  lotacao: number;
  inscritos: number;
  vagas: number;
};

export type DadosAgendamento = {
  meetingId: string;
  comecaEm: string;
  duracaoMin: number;
  convite: string;
};

// `inicioEm` chega em UTC. Todo formatador abaixo declara o fuso: sem isso a
// Vercel, que roda em UTC, mostraria 07:00 numa sessão das 10:00.
const fmtDiaCompleto = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});
/** Chave de agrupamento por dia civil em São Paulo (en-CA dá AAAA-MM-DD). */
const fmtChaveDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Rótulo curto do chip: "hoje", "amanhã", ou "qui 18/09". */
const fmtDiaCurto = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

type Dia = { chave: string; rotulo: string; curto: string; sessoes: Sessao[] };

/**
 * Agrupa por dia civil de São Paulo.
 *
 * Passou a devolver a CHAVE junto porque a lista virou dois passos: com 12
 * horários por dia e a agenda indo até o fim do mês, empilhar tudo dava ~170
 * botões num scroll de 420px. Ninguém escolhe assim no celular.
 */
function agruparPorDia(sessoes: Sessao[], hojeChave: string, amanhaChave: string): Dia[] {
  const dias = new Map<string, Dia>();
  for (const s of sessoes) {
    const d = new Date(s.inicioEm);
    if (Number.isNaN(d.getTime())) continue;
    const chave = fmtChaveDia.format(d);
    if (!dias.has(chave)) {
      const curto =
        chave === hojeChave ? "hoje" : chave === amanhaChave ? "amanhã" : fmtDiaCurto.format(d);
      dias.set(chave, { chave, rotulo: fmtDiaCompleto.format(d), curto, sessoes: [] });
    }
    dias.get(chave)!.sessoes.push(s);
  }
  return [...dias.values()];
}

/** Devolve as sessões, ou `null` quando a agenda não respondeu. */
async function buscarSessoes(): Promise<Sessao[] | null> {
  try {
    const res = await fetch("/api/agenda", { cache: "no-store" });
    const corpo = (await res.json()) as { sessoes?: Sessao[] };
    if (!res.ok) return null;
    return corpo.sessoes ?? [];
  } catch {
    return null;
  }
}

export function SessoesDisponiveis({
  sessionId,
  answers,
  jaAgendado,
  onAgendado,
}: {
  sessionId: string;
  answers: StepAnswers;
  jaAgendado?: boolean;
  onAgendado: (dados: DadosAgendamento) => void;
}) {
  const [sessoes, setSessoes] = useState<Sessao[] | null>(null);
  const [falhaAoCarregar, setFalhaAoCarregar] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);

  // Trava sincrônica: `escolhida` só vale no render seguinte, e dois toques
  // rápidos cabem antes disso. Duas reservas seguidas não criariam duas
  // inscrições (o CRM é idempotente pela sessão do funil), mas criariam dois
  // eventos de pixel e uma tela piscando.
  const emVoo = useRef(false);

  // "Hoje" e "amanhã" saem do relógio, que muda sozinho: lê-lo durante o render
  // tornaria o componente impuro (dois renders seguidos poderiam discordar sobre
  // que dia é hoje). Uma vez na montagem basta — ninguém atravessa a meia-noite
  // com esta tela aberta, e se atravessar o rótulo errado é inofensivo perto de
  // uma lista que se reordena sozinha embaixo do dedo.
  const [chavesRelativas] = useState(() => ({
    hoje: fmtChaveDia.format(new Date()),
    amanha: fmtChaveDia.format(new Date(Date.now() + 86_400_000)),
  }));

  const aplicar = useCallback((lista: Sessao[] | null) => {
    setFalhaAoCarregar(lista === null);
    setSessoes(lista ?? []);
    // Preserva o dia que a pessoa já tinha escolhido, se ele ainda tiver vaga.
    // Perder o dia numa corrida ("lotou enquanto você escolhia") seria pior
    // que a lista achatada de antes: ela voltaria ao começo do mês.
    setDiaEscolhido((atual) => {
      if (!atual || !lista) return null;
      return lista.some((s) => fmtChaveDia.format(new Date(s.inicioEm)) === atual) ? atual : null;
    });
  }, []);

  useEffect(() => {
    if (jaAgendado) return;
    // `vivo` evita escrever estado num componente que já saiu da tela — dá para
    // fechar o funil enquanto a busca está no ar.
    let vivo = true;
    void buscarSessoes().then((lista) => {
      if (vivo) aplicar(lista);
    });
    return () => {
      vivo = false;
    };
  }, [jaAgendado, aplicar]);

  /** Volta a lista para "carregando" antes de buscar — só para quem pediu. */
  const recarregar = useCallback(() => {
    setSessoes(null);
    void buscarSessoes().then(aplicar);
  }, [aplicar]);

  async function escolher(sessao: Sessao) {
    if (emVoo.current) return;
    emVoo.current = true;
    setEscolhida(sessao.id);
    setAviso(null);

    try {
      const res = await fetch(`/api/leads/${sessionId}/reservar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: sessao.id }),
      });
      const corpo = (await res.json().catch(() => null)) as {
        convite?: string;
        reuniao?: { id: string; comecaEm: string };
        erro?: string;
        lotada?: boolean;
      } | null;

      if (res.ok && corpo?.convite && corpo.reuniao) {
        onAgendado({
          meetingId: corpo.reuniao.id,
          comecaEm: corpo.reuniao.comecaEm,
          duracaoMin: sessao.duracaoMin,
          convite: corpo.convite,
        });
        return;
      }

      // Lotou entre a consulta e o clique, ou a sessão saiu do ar. Os dois casos
      // pedem a mesma coisa: lista nova e uma escolha nova.
      setAviso(
        corpo?.lotada
          ? "Essa sessão lotou enquanto você escolhia. Veja os horários que sobraram:"
          : (corpo?.erro ?? "Não conseguimos reservar. Escolha outro horário:")
      );
      recarregar();
    } catch {
      setAviso("Sua conexão oscilou. Tente escolher de novo:");
    } finally {
      emVoo.current = false;
      setEscolhida(null);
    }
  }

  if (jaAgendado) return <Confirmacao answers={answers} />;

  if (sessoes === null) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-waz-50" />
        Buscando os próximos horários...
      </div>
    );
  }

  if (falhaAoCarregar || sessoes.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[15px] font-semibold text-slate-900">
          {falhaAoCarregar ? "Não carregamos os horários" : "Sem horários abertos agora"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {falhaAoCarregar
            ? "Pode ter sido a conexão. Tente de novo em um instante."
            : "As próximas turmas ainda vão abrir. Nosso time entra em contato pelo WhatsApp com as datas."}
        </p>
        <button
          type="button"
          onClick={recarregar}
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Procurar de novo
        </button>
      </div>
    );
  }

  const dias = agruparPorDia(sessoes, chavesRelativas.hoje, chavesRelativas.amanha);
  const dia = dias.find((d) => d.chave === diaEscolhido) ?? dias[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Escolha o melhor horário</p>
        <p className="text-xs text-slate-500">
          Apresentação ao vivo com o time {BRAND_NAME} · horário de Brasília
        </p>
      </div>

      {aviso && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {aviso}
        </p>
      )}

      {/* Passo 1: o dia. Uma fileira que rola na horizontal, com encaixe —
          no celular o polegar percorre os dias sem sair da tela. */}
      <div
        role="tablist"
        aria-label="Dias com horário disponível"
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto border-b border-slate-200 px-4 py-3"
      >
        {dias.map((d) => {
          const ativo = d.chave === dia?.chave;
          return (
            <button
              key={d.chave}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setDiaEscolhido(d.chave)}
              className={`flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ${
                ativo
                  ? "border-waz-50 bg-waz-50 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="capitalize">{d.curto}</span>
              <span
                className={`text-xs font-medium ${ativo ? "text-white/80" : "text-slate-400"}`}
              >
                {d.sessoes.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Passo 2: a hora. Doze pastilhas cabem numa tela sem rolagem — era o
          ponto de separar os dois passos. */}
      {dia && (
        <div className="px-4 py-4">
          <p className="mb-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {dia.rotulo}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {dia.sessoes.map((s) => {
              const reservando = escolhida === s.id;
              const ultimasVagas = s.vagas <= 3;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={escolhida !== null}
                  onClick={() => void escolher(s)}
                  className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-1 py-2 shadow-sm transition hover:border-waz-50 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60"
                >
                  {reservando ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-waz-50" />
                  ) : (
                    <>
                      <span className="text-[15px] font-semibold text-slate-900">
                        {fmtHora.format(new Date(s.inicioEm))}
                      </span>
                      <span
                        className={`text-[11px] ${ultimasVagas ? "text-amber-600" : "text-slate-500"}`}
                      >
                        {s.vagas === 1 ? "última vaga" : `${s.vagas} vagas`}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            {dia.sessoes[0]?.duracaoMin ?? 45} minutos · ao vivo
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Confirmação: o que a pessoa precisa fazer a seguir, em duas ações.
 *
 * Entrar na sala é a primeira, porque é o que ela veio buscar. Salvar na agenda
 * é a segunda, e tentamos abrir sozinhos numa aba nova — sem tirá-la daqui, que
 * é onde o link da sala está guardado.
 */
function Confirmacao({ answers }: { answers: StepAnswers }) {
  const inicio = answers.scheduledAt ? new Date(answers.scheduledAt) : null;
  const inicioValido = inicio && !Number.isNaN(inicio.getTime()) ? inicio : null;
  const convite = answers.meetingLocation;

  const link = inicioValido
    ? linkGoogleAgenda({
        inicio: inicioValido,
        fim: calcularFim(
          inicioValido,
          answers.scheduledEndAt ? new Date(answers.scheduledEndAt) : null
        ),
        titulo: answers.meetingTitle || `Apresentação ${BRAND_NAME}`,
        descricao: convite
          ? `Apresentação ao vivo com o time ${BRAND_NAME}. Entre por: ${convite}`
          : `Apresentação ao vivo com o time ${BRAND_NAME}.`,
        local: convite,
      })
    : null;

  useEffect(() => {
    if (!link) return;
    // Só a aba nova: um redirecionamento na própria aba levaria embora o link da
    // sala, que é a informação mais importante desta tela.
    const aba = window.open(link, "_blank");
    if (aba) aba.opener = null;
  }, [link]);

  return (
    <div className="rounded-2xl border border-waz-70 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-waz-90 text-waz-20">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-slate-900">Vaga garantida!</p>
          {inicioValido && (
            <p className="mt-0.5 text-sm text-slate-600">
              {fmtDiaCompleto.format(inicioValido)} às {fmtHora.format(inicioValido)}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">
            O link também chega no seu e-mail e WhatsApp.
          </p>
        </div>
      </div>

      {convite && (
        <a
          href={convite}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-waz-50 px-4 text-[15px] font-semibold text-waz-10 shadow-sm transition hover:bg-waz-40"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m23 7-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" />
          </svg>
          Entrar na reunião
        </a>
      )}

      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
          </svg>
          Salvar no Google Agenda
        </a>
      )}
    </div>
  );
}
