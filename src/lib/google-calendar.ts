/**
 * Link de "salvar na agenda" do Google.
 *
 * O CRM manda o convite por e-mail, mas entre agendar e o e-mail chegar a
 * pessoa já saiu da página — e quem não tem o Google Agenda conectado à caixa
 * de entrada nunca vê o compromisso aparecer sozinho. Este link resolve isso no
 * momento em que a intenção ainda está quente.
 *
 * Formato do Google: `dates=<início>/<fim>` em UTC básico (YYYYMMDDTHHMMSSZ).
 */

export type ReuniaoAgendada = {
  inicio: Date;
  /** Quando a duração não vem junto, assumimos a padrão da sessão. */
  fim: Date;
  titulo: string;
  descricao?: string;
  local?: string;
};

const DURACAO_PADRAO_MIN = 60;

function utcBasico(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function calcularFim(inicio: Date, fim?: Date | null, duracaoMin?: number | null): Date {
  if (fim && !Number.isNaN(fim.getTime())) return fim;
  const minutos = duracaoMin && duracaoMin > 0 ? duracaoMin : DURACAO_PADRAO_MIN;
  return new Date(inicio.getTime() + minutos * 60_000);
}

export function linkGoogleAgenda(r: ReuniaoAgendada): string {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", r.titulo);
  url.searchParams.set("dates", `${utcBasico(r.inicio)}/${utcBasico(r.fim)}`);
  if (r.descricao) url.searchParams.set("details", r.descricao);
  if (r.local) url.searchParams.set("location", r.local);
  return url.toString();
}

/** "segunda-feira, 15 de setembro às 14:00" — no fuso de quem está lendo. */
export function dataPorExtenso(d: Date): string {
  const dia = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}
