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
import { ScheduleStep } from "./ScheduleStep";

type ChatMessage = { role: "bot" | "user"; text: string; read?: boolean };

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasStartedIntro = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog, typing]);

  const pushBotMessages = useCallback(async (messages: string[]) => {
    for (const text of messages) {
      setTyping(true);
      await new Promise((r) => setTimeout(r, 500 + Math.min(text.length * 6, 700)));
      setTyping(false);
      setChatLog((log) => [...log, { role: "bot", text }]);
    }
  }, []);

  // Sincroniza atribuição (UTMs/click ids) a cada visita — mesmo em sessão
  // retomada, para não perder uma campanha nova que trouxe o lead de volta.
  // A intro animada do bot só roda para sessão nova (sem progresso salvo).
  useEffect(() => {
    if (hasStartedIntro.current) return;
    hasStartedIntro.current = true;

    const attribution = captureAttribution();
    void initLead({
      sessionId,
      utmSource: attribution.utmSource ?? null,
      utmMedium: attribution.utmMedium ?? null,
      utmCampaign: attribution.utmCampaign ?? null,
      utmTerm: attribution.utmTerm ?? null,
      utmContent: attribution.utmContent ?? null,
      fbclid: attribution.fbclid ?? null,
      gclid: attribution.gclid ?? null,
      fbp: readCookie("_fbp"),
      fbc: readCookie("_fbc"),
      referrer: attribution.firstReferrer ?? null,
      landingUrl: attribution.firstLandingUrl ?? null,
    });

    if (resumed) return;

    void (async () => {
      await pushBotMessages(introMessages());
      setReady(true);
    })();
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
      setChatLog((log) => [...log, { role: "user", text: userDisplayText, read: false }]);
      setAnswers(updatedAnswers);
      setTimeout(markLastUserMessageRead, 900);

      const upcoming = nextStep(step);
      const botMessages = messagesForStep(step, updatedAnswers);
      await pushBotMessages(botMessages);
      if (upcoming) setCurrentStep(upcoming);
    },
    [pushBotMessages, markLastUserMessageRead]
  );

  const handleScheduled = useCallback(
    (payload: { calBookingUid: string; scheduledAt: string; meetingLocation?: string }) => {
      setAnswers((a) => ({ ...a, scheduledConfirmed: true }));
      void submitSchedule(sessionId, payload);
      fbTrack("Schedule");
    },
    [sessionId]
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col bg-background">
      <ProgressBar stepIndex={indexOfStep(currentStep)} />

      <div
        className="flex-1 space-y-5 px-4 py-6"
        style={{
          backgroundImage:
            "radial-gradient(rgba(29, 78, 53, 0.08) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        {chatLog.map((m, i) =>
          m.role === "bot" ? (
            <BotBubble key={i} text={m.text} />
          ) : (
            <UserBubble key={i} text={m.text} read={m.read} />
          )
        )}
        {typing && <TypingIndicator />}
        <div ref={bottomRef} />

        {ready && !typing && (
          <div className="pt-2">
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

            {currentStep === "SCHEDULE" && (
              <ScheduleStep
                sessionId={sessionId}
                answers={answers}
                alreadyScheduled={answers.scheduledConfirmed}
                onScheduled={handleScheduled}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
