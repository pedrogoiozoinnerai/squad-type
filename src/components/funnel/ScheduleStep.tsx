"use client";

import { useEffect, useRef, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import type { StepAnswers } from "@/lib/funnel";
import { BRAND_NAME } from "@/lib/funnel";

type BookingSuccessEventDetail = {
  data: {
    booking: unknown;
    date: string;
  };
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
  onScheduled: (payload: {
    calBookingUid: string;
    scheduledAt: string;
    meetingLocation?: string;
  }) => void;
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
          const booking = data.booking as { uid?: string } | null;
          const uid = booking?.uid;
          if (uid) {
            setScheduled(true);
            onScheduledRef.current({
              calBookingUid: uid,
              scheduledAt: data.date ?? new Date().toISOString(),
            });
          }
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
    return (
      <div className="rounded-2xl border border-waz-70 bg-white p-5 text-sm text-waz-20 shadow-sm">
        Reunião agendada! Você vai receber a confirmação por e-mail e WhatsApp.
      </div>
    );
  }

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
        config={{
          name: answers.fullName ?? "",
          email: answers.email ?? "",
          notes: [
            answers.company && `Empresa: ${answers.company}`,
            answers.segment && `Segmento: ${answers.segment}`,
            answers.role && `Cargo: ${answers.role}`,
          ]
            .filter(Boolean)
            .join(" | "),
          // Ecoado de volta no payload do webhook (BOOKING_CREATED) — é assim que
          // correlacionamos a reserva do Cal.com com o lead certo no nosso banco.
          metadata: { sessionId },
        }}
      />
    </div>
  );
}
