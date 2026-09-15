"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  REVENUE_OPTIONS,
  SEGMENT_OPTIONS,
  STEP_ORDER,
  firstName,
  introMessages,
  messagesForStep,
  nextStep,
  stepIndex as indexOfStep,
  type StepAnswers,
  type StepKey,
} from "@/lib/funnel";
import { extractDdd, lookupDdd } from "@/lib/ddd";
import { formatBRPhone } from "@/lib/phone-format";
import { getOrCreateSessionId, loadFunnelState, saveFunnelState } from "@/lib/session";
import { captureAttribution } from "@/lib/attribution";
import { initLead, submitSchedule, submitStep } from "@/lib/api-client";
import { fbAdvancedMatch, fbTrack } from "@/lib/fb-pixel";
import { ProgressBar } from "./ProgressBar";
import { BotBubble, UserBubble } from "./ChatBubble";
import { TypingIndicator } from "./TypingIndicator";
import { TextFieldStep } from "./inputs/TextFieldStep";
import { PhoneStep } from "./inputs/PhoneStep";
import { SelectDropdown } from "./inputs/SelectDropdown";
import { RoleFullscreenStep } from "./inputs/RoleFullscreenStep";
import { ScheduleStep, type DadosAgendamento } from "./ScheduleStep";

/** `at` é o instante em que a mensagem entrou na conversa. Guardar isso na
 * mensagem (em vez de chamar `new Date()` na hora de desenhar) é o que impede
 * que o horário de todos os balões pule para "agora" a cada nova resposta. */
type ChatMessage = { role: "bot" | "user"; text: string; read?: boolean; at?: number };

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function FunnelChat() {
  // Este componente só é montado no client (ver dynamic import em app/page.tsx
  // com ssr:false), então é seguro ler localStorage já no estado inicial.
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const [resumed] = useState(() => {
    const persisted = loadFunnelState();
    return persisted && persisted.sessionId === sessionId ? persisted : null;
  });
  const [chatLog, setChatLog] = useState<ChatMessage[]>(() => resumed?.chatLog ?? []);
  const [answers, setAnswers] = useState<StepAnswers>(
    () => (resumed?.answers as StepAnswers) ?? {}
  );
  const [currentStep, setCurrentStep] = useState<StepKey>(() =>
    resumed ? STEP_ORDER[resumed.stepIndex] ?? "NAME" : "NAME"
  );
  const [typing, setTyping] = useState(false);
  const [ready, setReady] = useState(() => !!resumed);

  // `busy` cobre a transição inteira de um passo: começa no envio da resposta e
  // só termina quando o bot acaba de falar e o passo seguinte já está no ar.
  // Sem isso o campo do passo *anterior* reaparecia no respiro entre duas falas
  // do bot (`typing` pisca false ali no meio), convidando a responder duas vezes.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const hasStartedIntro = useRef(false);

  // Rola só a lista de mensagens, não a página: o campo de resposta vive fora
  // dessa área e precisa continuar ancorado no rodapé, visível o tempo todo.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chatLog, typing, currentStep, ready]);

  const pushBotMessages = useCallback(async (messages: string[]) => {
    for (const text of messages) {
      setTyping(true);
      await new Promise((r) => setTimeout(r, 500 + Math.min(text.length * 6, 700)));
      setTyping(false);
      setChatLog((log) => [...log, { role: "bot", text, at: Date.now() }]);
    }
  }, []);

  // Sincroniza atribuição (UTMs/click ids) a cada visita — mesmo em sessão
  // retomada, para não perder uma campanha nova que trouxe o lead de volta.
  // A intro animada do bot só roda para sessão nova (sem progresso salvo).
  useEffect(() => {
    if (hasStartedIntro.current) return;
    hasStartedIntro.current = true;

    const attribution = captureAttribution();
    const identificacao = {
      sessionId,
      utmSource: attribution.utmSource ?? null,
      utmMedium: attribution.utmMedium ?? null,
      utmCampaign: attribution.utmCampaign ?? null,
      utmTerm: attribution.utmTerm ?? null,
      utmContent: attribution.utmContent ?? null,
      fbclid: attribution.fbclid ?? null,
      gclid: attribution.gclid ?? null,
      referrer: attribution.firstReferrer ?? null,
      landingUrl: attribution.firstLandingUrl ?? null,
    };

    void initLead({
      ...identificacao,
      fbp: readCookie("_fbp"),
      fbc: readCookie("_fbc"),
    });

    // `_fbp`/`_fbc` são gravados pelo script do Pixel, que carrega depois da
    // hidratação: na primeira leitura eles quase sempre ainda não existem. Uma
    // segunda passada alguns segundos depois é o que faz o pareamento com o
    // Facebook realmente chegar ao banco.
    const tentarClickIds = window.setTimeout(() => {
      const fbp = readCookie("_fbp");
      const fbc = readCookie("_fbc");
      if (fbp || fbc) void initLead({ ...identificacao, fbp, fbc });
    }, 3000);

    if (resumed) return () => window.clearTimeout(tentarClickIds);

    void (async () => {
      await pushBotMessages(introMessages());
      setReady(true);
    })();

    return () => window.clearTimeout(tentarClickIds);
  }, [resumed, sessionId, pushBotMessages]);

  // Persiste o progresso a cada mudança relevante (permite retomar ao recarregar).
  useEffect(() => {
    if (!ready) return;
    saveFunnelState({
      sessionId,
      stepIndex: indexOfStep(currentStep),
      answers,
      chatLog,
    });
  }, [sessionId, ready, currentStep, answers, chatLog]);

  // Marca a última mensagem do usuário como lida (setinha azul) — feito com um
  // pequeno atraso, dissociado da resposta do bot, pra imitar o double-check
  // "visualizado" do WhatsApp em vez de já nascer lida.
  const markLastUserMessageRead = useCallback(() => {
    setChatLog((log) => {
      const idx = [...log].reverse().findIndex((m) => m.role === "user" && !m.read);
      if (idx === -1) return log;
      const realIdx = log.length - 1 - idx;
      const copy = [...log];
      copy[realIdx] = { ...copy[realIdx], read: true };
      return copy;
    });
  }, []);

  const advance = useCallback(
    async (step: StepKey, updatedAnswers: StepAnswers, userDisplayText: string) => {
      // O ref trava já na primeira chamada; `busy` sozinho só valeria no render
      // seguinte, e dois toques rápidos no botão cabem folgadamente antes disso.
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);

      setChatLog((log) => [
        ...log,
        { role: "user", text: userDisplayText, read: false, at: Date.now() },
      ]);
      setAnswers(updatedAnswers);
      setTimeout(markLastUserMessageRead, 900);

      const upcoming = nextStep(step);
      const botMessages = messagesForStep(step, updatedAnswers);
      await pushBotMessages(botMessages);
      if (upcoming) setCurrentStep(upcoming);

      busyRef.current = false;
      setBusy(false);
    },
    [pushBotMessages, markLastUserMessageRead]
  );

  const handleScheduled = useCallback(
    (payload: DadosAgendamento) => {
      setAnswers((a) => ({
        ...a,
        scheduledConfirmed: true,
        scheduledAt: payload.scheduledAt,
        scheduledEndAt: payload.scheduledEndAt,
        meetingLocation: payload.meetingLocation,
        meetingTitle: payload.meetingTitle,
      }));
      // O endpoint valida três campos; horário de término e título ficam só no
      // cliente, que é quem monta o link da agenda.
      void submitSchedule(sessionId, {
        calBookingUid: payload.calBookingUid,
        scheduledAt: payload.scheduledAt,
        meetingLocation: payload.meetingLocation,
      });
      fbTrack("Schedule");
    },
    [sessionId]
  );

  const mostrarEntrada = ready && !busy;
  // O calendário do Cal.com passa de mil pixels de altura: ele pertence ao fluxo
  // rolável junto das mensagens, não à barra fixa do rodapé.
  const passoAgendamento = currentStep === "SCHEDULE";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col bg-background">
      <ProgressBar stepIndex={indexOfStep(currentStep)} />

      <div
        ref={scrollRef}
        aria-live="polite"
        className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-6"
        style={{
          backgroundImage:
            "radial-gradient(rgba(29, 78, 53, 0.08) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        {chatLog.map((m, i) =>
          m.role === "bot" ? (
            <BotBubble key={i} text={m.text} at={m.at} />
          ) : (
            <UserBubble key={i} text={m.text} read={m.read} at={m.at} />
          )
        )}
        {typing && <TypingIndicator />}

        {mostrarEntrada && passoAgendamento && (
          <ScheduleStep
            sessionId={sessionId}
            answers={answers}
            alreadyScheduled={answers.scheduledConfirmed}
            onScheduled={handleScheduled}
          />
        )}
      </div>

      {!passoAgendamento && (
        <div
          className="shrink-0 border-t border-slate-200 bg-background px-4 pt-3"
          style={{ paddingBottom: "calc(0.75rem + var(--safe-bottom))" }}
        >
          {/* Altura mínima reservada: sem ela a barra colapsa enquanto o bot
              digita e a conversa inteira dá um pulo a cada passo. */}
          <div className="flex min-h-[78px] flex-col justify-center">
            {mostrarEntrada && (
              <>
                {currentStep === "NAME" && (
                  <TextFieldStep
                    label="Nome completo"
                    placeholder="Digite seu nome e sobrenome..."
                    autoComplete="name"
                    showConsent
                    validate={(v) =>
                      v.split(/\s+/).length < 2 ? "Informe nome e sobrenome" : null
                    }
                    onSubmit={(value) => {
                      const updated = { ...answers, fullName: value };
                      fbAdvancedMatch(firstName(value), value.split(/\s+/).slice(1).join(" "));
                      void submitStep(sessionId, "NAME", { fullName: value });
                      void advance("NAME", updated, value);
                    }}
                  />
                )}

                {currentStep === "PHONE" && (
                  <PhoneStep
                    onSubmit={(phoneNumber) => {
                      const ddd = extractDdd(phoneNumber);
                      const info = ddd ? lookupDdd(ddd) : null;
                      const updated: StepAnswers = {
                        ...answers,
                        phoneCountryCode: "+55",
                        phoneNumber,
                        city: info?.city ?? null,
                        state: info?.state ?? null,
                      };
                      void submitStep(sessionId, "PHONE", {
                        phoneCountryCode: "+55",
                        phoneNumber,
                      });
                      fbTrack("Contact");
                      void advance("PHONE", updated, `+55 ${formatBRPhone(phoneNumber)}`);
                    }}
                  />
                )}

                {currentStep === "EMAIL" && (
                  <TextFieldStep
                    label="E-mail"
                    placeholder="seu@email.com"
                    type="email"
                    autoComplete="email"
                    validate={(v) => (!/^\S+@\S+\.\S+$/.test(v) ? "E-mail inválido" : null)}
                    onSubmit={(value) => {
                      const updated = { ...answers, email: value };
                      void submitStep(sessionId, "EMAIL", { email: value });
                      void advance("EMAIL", updated, value);
                    }}
                  />
                )}

                {currentStep === "COMPANY" && (
                  <TextFieldStep
                    label="Empresa"
                    placeholder="Nome da sua empresa..."
                    autoComplete="organization"
                    validate={(v) => (v.length < 2 ? "Informe o nome da empresa" : null)}
                    onSubmit={(value) => {
                      const updated = { ...answers, company: value };
                      void submitStep(sessionId, "COMPANY", { company: value });
                      void advance("COMPANY", updated, value);
                    }}
                  />
                )}

                {currentStep === "SEGMENT" && (
                  <SelectDropdown
                    label="Segmento"
                    placeholder="Selecione o segmento da sua empresa"
                    options={SEGMENT_OPTIONS}
                    onSubmit={(value) => {
                      const updated = { ...answers, segment: value };
                      void submitStep(sessionId, "SEGMENT", { segment: value });
                      void advance("SEGMENT", updated, value);
                    }}
                  />
                )}

                {currentStep === "ROLE" && (
                  <RoleFullscreenStep
                    company={answers.company}
                    onSubmit={(value) => {
                      const updated = { ...answers, role: value };
                      void submitStep(sessionId, "ROLE", { role: value });
                      fbTrack("CompleteRegistration");
                      void advance("ROLE", updated, value);
                    }}
                  />
                )}

                {currentStep === "REVENUE" && (
                  <SelectDropdown
                    label="Faturamento anual"
                    placeholder="Selecione o faturamento"
                    options={REVENUE_OPTIONS}
                    onSubmit={(value) => {
                      const updated = { ...answers, revenueRange: value };
                      void submitStep(sessionId, "REVENUE", { revenueRange: value });
                      void advance("REVENUE", updated, value);
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
