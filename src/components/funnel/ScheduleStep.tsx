"use client";

import { useEffect, useRef, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import type { StepAnswers } from "@/lib/funnel";
import { BRAND_NAME } from "@/lib/funnel";
import { calcularFim, dataPorExtenso, linkGoogleAgenda } from "@/lib/google-calendar";

type BookingSuccessEventDetail = {
  data: {
    booking: unknown;
    date: string;
    duration?: number;
  };
};

type ReservaCal = {
  uid?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
};

export type DadosAgendamento = {
  calBookingUid: string;
  scheduledAt: string;
  scheduledEndAt?: string;
  meetingLocation?: string;
  meetingTitle?: string;
};

export function ScheduleStep({
  sessionId,
  answers,
  alreadyScheduled,
  onScheduled,
}: {
  sessionId: string;
  answers: StepAnswers;
  alreadyScheduled?: boolean;
  onScheduled: (payload: DadosAgendamento) => void;
}) {
  const [scheduled, setScheduled] = useState(!!alreadyScheduled);
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK;

  // Mantém a callback mais recente numa ref em vez de nas deps do efeito abaixo:
  // como `onScheduled` é recriada a cada render do componente pai, colocá-la nas
  // deps faria o efeito rodar de novo a cada render e registrar um novo listener
  // "bookingSuccessful" no Cal.com sem remover o anterior — resultando em múltiplas
  // chamadas de agendamento (e eventos de pixel) duplicadas para uma única reunião.
  const onScheduledRef = useRef(onScheduled);
  useEffect(() => {
    onScheduledRef.current = onScheduled;
  }, [onScheduled]);

  useEffect(() => {
    if (!calLink) return;
    let mounted = true;

    (async () => {
      const cal = await getCalApi({ namespace: "diagnostico" });
      if (!mounted) return;
      cal("ui", {
        theme: "light",
        styles: { branding: { brandColor: "#2DC86A" } },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
      cal("on", {
        action: "bookingSuccessful",
        callback: (event: CustomEvent<BookingSuccessEventDetail>) => {
          const { data } = event.detail;
          const booking = (data.booking ?? null) as ReservaCal | null;
          const uid = booking?.uid;
          if (!uid) return;

          const inicio = booking?.startTime ?? data.date;
          const fim = booking?.endTime;

          setScheduled(true);
          onScheduledRef.current({
            calBookingUid: uid,
            scheduledAt: inicio ?? new Date().toISOString(),
            scheduledEndAt: fim,
            meetingLocation: booking?.location,
            meetingTitle: booking?.title,
          });
        },
      });
    })();

    return () => {
      mounted = false;
    };
  }, [calLink]);

  if (!calLink) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
        Configure a variável de ambiente <code>NEXT_PUBLIC_CAL_LINK</code> (ex:{" "}
        <code>seu-usuario/diagnostico-ia</code>) para habilitar o agendamento via
        Cal.com.
      </div>
    );
  }

  if (scheduled) {
    return <Confirmacao answers={answers} />;
  }

  // Tudo que a pessoa já respondeu no funil entra no formulário do Cal.com pronto.
  // As chaves não são inventadas: são os identificadores dos campos do evento
  // "Apresentação Squad.com" — `name`, `email`, e as perguntas personalizadas
  // `company_name` e `attendeePhoneNumber`.
  //
  // `metadata[sessionId]` vai em notação de colchetes de propósito. O embed
  // serializa cada valor com `URLSearchParams.set`, então um objeto aninhado
  // virava a string "[object Object]" — e o webhook ficava sem a chave que liga
  // a reserva ao lead, caindo no e-mail como último recurso.
  const prefill: Record<string, string> = {
    "metadata[sessionId]": sessionId,
  };
  if (answers.fullName) prefill.name = answers.fullName;
  if (answers.email) prefill.email = answers.email;
  if (answers.company) prefill.company_name = answers.company;
  if (answers.phoneNumber) {
    prefill.attendeePhoneNumber = `${answers.phoneCountryCode ?? "+55"}${answers.phoneNumber}`;
  }
  const contexto = [
    answers.segment && `Segmento: ${answers.segment}`,
    answers.role && `Cargo: ${answers.role}`,
    answers.revenueRange && `Faturamento: ${answers.revenueRange}`,
  ].filter(Boolean);
  if (contexto.length) prefill.notes = contexto.join(" | ");

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200 bg-white px-4 py-3">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-waz-50"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className="text-sm font-semibold text-slate-900">
          Agenda {BRAND_NAME}
        </span>
        <span className="text-xs text-slate-500">Para sua reunião gratuita</span>
      </div>
      <Cal
        namespace="diagnostico"
        calLink={calLink}
        // O próprio Cal.com ajusta a altura do iframe conforme o conteúdo; o
        // valor abaixo é só o espaço reservado enquanto ele carrega.
        style={{ width: "100%", minHeight: "420px" }}
        config={prefill}
      />
    </div>
  );
}

/**
 * Tela de confirmação que leva a pessoa ao Google Agenda.
 *
 * A ordem importa. Primeiro tentamos abrir numa aba nova, que é o melhor dos
 * mundos: a pessoa salva o compromisso e volta para a confirmação ainda aberta.
 * Só que `bookingSuccessful` chega do iframe do Cal.com, não de um clique nosso
 * — e sem gesto do usuário o navegador bloqueia a aba nova (verificado: bloqueia
 * mesmo). Quando isso acontece, navegamos na própria aba depois de um respiro
 * curto, tempo de ler que a reunião está marcada.
 *
 * O botão fica visível nos dois caminhos, para quem voltar do Google ou bloquear
 * as duas coisas.
 */
function Confirmacao({ answers }: { answers: StepAnswers }) {

  const inicio = answers.scheduledAt ? new Date(answers.scheduledAt) : null;
  const inicioValido = inicio && !Number.isNaN(inicio.getTime()) ? inicio : null;

  const link = inicioValido
    ? linkGoogleAgenda({
        inicio: inicioValido,
        fim: calcularFim(
          inicioValido,
          answers.scheduledEndAt ? new Date(answers.scheduledEndAt) : null
        ),
        titulo: answers.meetingTitle || `Apresentação ${BRAND_NAME}`,
        descricao: `Reunião com o time ${BRAND_NAME}. O link da chamada chega no seu e-mail.`,
        local: answers.meetingLocation,
      })
    : null;

  useEffect(() => {
    if (!link) return;

    // `noopener` na string de features faz `window.open` devolver null mesmo
    // quando a aba abre — o retorno deixaria de distinguir "abriu" de
    // "bloqueado" e acabaríamos abrindo o Google duas vezes. Então pedimos a
    // aba sem essa flag e cortamos a referência logo em seguida, que dá a mesma
    // proteção sem cegar a detecção.
    const aba = window.open(link, "_blank");
    if (aba) {
      aba.opener = null;
      return;
    }

    const t = window.setTimeout(() => window.location.assign(link), 2500);
    return () => window.clearTimeout(t);
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
          <p className="text-[15px] font-semibold text-slate-900">Reunião agendada!</p>
          {inicioValido && (
            <p className="mt-0.5 text-sm text-slate-600">{dataPorExtenso(inicioValido)}</p>
          )}
          <p className="mt-1 text-sm text-slate-500">
            A confirmação e o link da chamada vão para o seu e-mail e WhatsApp.
          </p>
        </div>
      </div>

      {link && (
        <>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-waz-50 px-4 text-[15px] font-semibold text-waz-10 shadow-sm transition hover:bg-waz-40"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
            </svg>
            Salvar no Google Agenda
          </a>
          <p className="mt-2 text-center text-xs text-slate-400">
            Estamos abrindo o Google Agenda para você. Se não abrir, toque acima.
          </p>
        </>
      )}
    </div>
  );
}
