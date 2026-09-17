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

const fmtMes = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, month: "long" });
const fmtAno = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, year: "numeric" });
const fmtDiaMes = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
});
const fmtSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long" });

/** Sobe só a primeira letra — em português o resto fica minúsculo. */
function inicialMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Setembro 2026" */
function rotuloDoMes(mes: string): string {
  const d = aoMeioDia(`${mes}-01`);
  return `${inicialMaiuscula(fmtMes.format(d))} ${fmtAno.format(d)}`;
}

/** "16 de setembro, quarta-feira" — dia primeiro, como se fala. */
function rotuloDoDia(chave: string): string {
  const d = aoMeioDia(chave);
  return `${fmtDiaMes.format(d)}, ${fmtSemana.format(d)}`;
}

/** Iniciais dos dias da semana, do domingo ao sábado — a ordem que a grade desenha. */
const INICIAIS = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Meio-dia UTC do dia informado.
 *
 * Toda conta de calendário passa por aqui de propósito. São Paulo é UTC-3, então
 * meia-noite UTC já é o dia anterior lá; meio-dia fica longe das duas bordas e
 * sobrevive inclusive a um horário de verão que volte.
 */
function aoMeioDia(chave: string): Date {
  return new Date(`${chave}T12:00:00Z`);
}

/** "2026-09-16" -> "2026-09" */
function mesDe(chave: string): string {
  return chave.slice(0, 7);
}

function mesVizinho(mes: string, passo: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(ano, m - 1 + passo, 1, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * As células do mês: nulos para alinhar a primeira semana, depois cada dia.
 * `getUTCDay` num instante de meio-dia devolve o dia da semana civil correto.
 */
function gradeDoMes(mes: string): (string | null)[] {
  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, m - 1, 1, 12));
  const diasNoMes = new Date(Date.UTC(ano, m, 0, 12)).getUTCDate();
  const celulas: (string | null)[] = Array(primeiro.getUTCDay()).fill(null);
  for (let d = 1; d <= diasNoMes; d++) {
    celulas.push(`${mes}-${String(d).padStart(2, "0")}`);
  }
  return celulas;
}

/** Sessões agrupadas pelo dia civil de São Paulo em que acontecem. */
function porDia(sessoes: Sessao[]): Map<string, Sessao[]> {
  const mapa = new Map<string, Sessao[]>();
  for (const s of sessoes) {
    const d = new Date(s.inicioEm);
    if (Number.isNaN(d.getTime())) continue;
    const chave = fmtChaveDia.format(d);
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave)!.push(s);
  }
  return mapa;
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
  const [mesEscolhido, setMesEscolhido] = useState<string | null>(null);

  // Trava sincrônica: `escolhida` só vale no render seguinte, e dois toques
  // rápidos cabem antes disso. Duas reservas seguidas não criariam duas
  // inscrições (o CRM é idempotente pela sessão do funil), mas criariam dois
  // eventos de pixel e uma tela piscando.
  const emVoo = useRef(false);

  // O relógio é lido uma vez, na montagem: consultá-lo durante o render tornaria
  // o componente impuro — dois renders seguidos poderiam discordar sobre que
  // horas são. Ninguém atravessa a meia-noite com esta tela aberta.
  const [agora] = useState(() => {
    const d = new Date();
    const diaDaSemana = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      weekday: "long",
    }).format(d);
    return `${diaDaSemana}, ${fmtHora.format(d)}`;
  });

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

  const dias = porDia(sessoes);
  const comVaga = [...dias.keys()].sort();
  const diaAtivo = diaEscolhido && dias.has(diaEscolhido) ? diaEscolhido : comVaga[0];
  const mesAtivo = mesEscolhido ?? mesDe(diaAtivo);
  const grade = gradeDoMes(mesAtivo);
  const horarios = dias.get(diaAtivo) ?? [];

  // Navegar para antes do primeiro mês com vaga, ou depois do último, só levaria
  // a um calendário vazio — então essa navegação simplesmente não existe.
  const temMesAnterior = comVaga.some((d) => mesDe(d) < mesAtivo);
  const temProximoMes = comVaga.some((d) => mesDe(d) > mesAtivo);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 bg-waz-40 px-4 py-3 text-white">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Agenda {BRAND_NAME}</p>
          <p className="truncate text-xs text-white/80">Para sua reunião gratuita</p>
        </div>
      </div>

      {aviso && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {aviso}
        </p>
      )}

      <div className="flex justify-center px-4 pt-4">
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
          Hoje é {agora}
        </span>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <SetaMes
          direcao="anterior"
          disponivel={temMesAnterior}
          onClick={() => setMesEscolhido(mesVizinho(mesAtivo, -1))}
        />
        <p className="text-[15px] font-semibold text-slate-900">{rotuloDoMes(mesAtivo)}</p>
        <SetaMes
          direcao="proximo"
          disponivel={temProximoMes}
          onClick={() => setMesEscolhido(mesVizinho(mesAtivo, 1))}
        />
      </div>

      <div className="px-4">
        <div className="rounded-2xl border border-slate-200 px-2 py-3">
          <div className="grid grid-cols-7">
            {INICIAIS.map((inicial, i) => (
              <span
                key={i}
                aria-hidden
                className="py-1 text-center text-[11px] font-medium text-slate-400"
              >
                {inicial}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grade.map((chave, i) => {
              if (!chave) return <span key={`vazio-${i}`} />;
              const numero = Number(chave.slice(-2));

              // Dia sem turma aberta continua visível, apagado: o calendário
              // precisa mostrar o mês inteiro para a pessoa se localizar.
              if (!dias.has(chave)) {
                return (
                  <span
                    key={chave}
                    className="flex h-11 items-center justify-center text-sm text-slate-300"
                  >
                    {numero}
                  </span>
                );
              }

              const ativo = chave === diaAtivo;
              return (
                <button
                  key={chave}
                  type="button"
                  aria-pressed={ativo}
                  aria-label={fmtDiaCompleto.format(aoMeioDia(chave))}
                  onClick={() => setDiaEscolhido(chave)}
                  className="flex h-11 items-center justify-center"
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                      ativo ? "bg-waz-40 text-white shadow-sm" : "text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {numero}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm text-slate-600">Horários para {rotuloDoDia(diaAtivo)}</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
            Horário de Brasília
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {horarios.map((s) => {
            const reservando = escolhida === s.id;
            const ultimasVagas = s.vagas <= 3;
            return (
              <button
                key={s.id}
                type="button"
                disabled={escolhida !== null}
                onClick={() => void escolher(s)}
                className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-1 py-2 text-slate-900 shadow-sm transition hover:border-waz-50 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60"
              >
                {reservando ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-waz-50" />
                ) : (
                  <>
                    <span className="text-[15px] font-semibold">
                      {fmtHora.format(new Date(s.inicioEm))}
                    </span>
                    {/* A escassez só aparece quando é verdade: repetir "20 vagas"
                        em cada pastilha vira ruído e não informa nada. */}
                    {ultimasVagas && (
                      <span className="text-[11px] text-amber-600">
                        {s.vagas === 1 ? "última vaga" : `${s.vagas} vagas`}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs text-slate-500">
          Toque em um horário para agendar · {horarios[0]?.duracaoMin ?? 45} minutos ao vivo
        </p>
      </div>
    </div>
  );
}

function SetaMes({
  direcao,
  disponivel,
  onClick,
}: {
  direcao: "anterior" | "proximo";
  disponivel: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!disponivel}
      onClick={onClick}
      aria-label={direcao === "anterior" ? "Mês anterior" : "Próximo mês"}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-slate-100"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={direcao === "anterior" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}

/**
 * O endereço do `.ics`, deduzido do link do convite.
 *
 * O funil recebe do CRM o link da pessoa (`.../convite/<token>`) e não o token
 * solto. Tirar o token daqui evita passar mais um campo pela ponte inteira só
 * para remontar o mesmo endereço do outro lado.
 */
function calendarioIcs(linkDoConvite: string): string {
  try {
    const url = new URL(linkDoConvite);
    const token = url.pathname.split("/convite/")[1];
    if (!token) return linkDoConvite;
    return `${url.origin}/api/agenda/calendario?convite=${token}`;
  } catch {
    return linkDoConvite;
  }
}

function Confirmacao({ answers }: { answers: StepAnswers }) {
  const [copiado, setCopiado] = useState(false);
  const inicio = answers.scheduledAt ? new Date(answers.scheduledAt) : null;
  const inicioValido = inicio && !Number.isNaN(inicio.getTime()) ? inicio : null;
  const convite = answers.meetingLocation;

  const copiar = useCallback(async () => {
    if (!convite) return;
    try {
      await navigator.clipboard.writeText(convite);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Navegador embutido de aplicativo costuma negar a área de transferência.
      // O link continua visível no botão de entrar; não vale quebrar a tela.
      setCopiado(false);
    }
  }, [convite]);

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

  // O Google Agenda NÃO abre mais sozinho.
  //
  // `window.open` sem um clique é exatamente o que todo bloqueador de pop-up
  // barra, então na maioria dos navegadores não acontecia nada — e nos poucos
  // em que acontecia, a aba pulava por cima da tela que tem o link da sala, que
  // é a informação mais importante do funil inteiro. Agora são três botões, e
  // quem escolhe é a pessoa.

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
              {inicialMaiuscula(fmtDiaCompleto.format(inicioValido))} às{" "}
              {fmtHora.format(inicioValido)}
            </p>
          )}
          {/* Aqui dizia "o link também chega no seu e-mail e WhatsApp".
              Não chegava: não há serviço de e-mail nem canal de WhatsApp
              ligado. A frase é o pior tipo de defeito, porque FUNCIONA — ela
              convence o lead de que não precisa guardar nada, ele fecha a aba
              confiando, e a mensagem nunca vem. Enquanto o envio não existir,
              a tela diz a verdade e entrega o que dá para guardar. */}
          <p className="mt-1 text-sm text-slate-500">
            Guarde o link agora — é por ele que você entra.
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

      {convite && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {/* O `.ics` serve para iPhone, Outlook e qualquer calendário — o
              link do Google só serve para quem usa Google, e metade do
              Brasil abre isto no iPhone. E ele leva alarme junto, que é o
              que realmente traz a pessoa de volta. */}
          <a
            href={calendarioIcs(convite)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
            </svg>
            Adicionar ao calendário
          </a>

          <button
            type="button"
            onClick={() => void copiar()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {copiado ? (
                <path d="M20 6 9 17l-5-5" />
              ) : (
                <>
                  <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
                  <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
                </>
              )}
            </svg>
            {copiado ? "Link copiado" : "Copiar o link"}
          </button>
        </div>
      )}

      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-center text-sm font-medium text-slate-500 underline-offset-4 hover:underline"
        >
          Prefere o Google Agenda?
        </a>
      )}
    </div>
  );
}
