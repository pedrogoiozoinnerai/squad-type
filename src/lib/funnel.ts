import { z } from "zod";

export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "Squad.com";

export const STEP_ORDER = [
  "NAME",
  "PHONE",
  "EMAIL",
  "COMPANY",
  "SEGMENT",
  "ROLE",
  "REVENUE",
  "SCHEDULE",
] as const;

export type StepKey = (typeof STEP_ORDER)[number];

export function stepIndex(step: StepKey): number {
  return STEP_ORDER.indexOf(step);
}

export function nextStep(step: StepKey): StepKey | null {
  const idx = stepIndex(step);
  return idx >= 0 && idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : null;
}

export const SEGMENT_OPTIONS = [
  "Agência",
  "Agronegócio",
  "Alimentação e bebidas",
  "Automotivo",
  "Beleza e estética",
  "Construção e engenharia",
  "Consultoria",
  "E-commerce",
  "Educação",
  "Financeiro e contábil",
  "Imobiliário",
  "Indústria",
  "Jurídico",
  "Logística e transporte",
  "Marketing",
  "Saúde",
  "Tecnologia (SaaS/Software)",
  "Varejo",
  "Outro",
] as const;

export const ROLE_OPTIONS = [
  "Sócio ou Fundador",
  "Presidente ou CEO",
  "C-Level",
  "Diretor",
  "Gerente",
  "Analista",
] as const;

export const DECISION_MAKER_ROLES: readonly string[] = [
  "Sócio ou Fundador",
  "Presidente ou CEO",
  "C-Level",
];

export const REVENUE_OPTIONS = [
  "Até R$500 mil/ano",
  "R$500 mil a R$1 milhão/ano",
  "R$1 a R$5 milhões/ano",
  "R$5 a R$20 milhões/ano",
  "R$20 a R$50 milhões/ano",
  "R$50 a R$100 milhões/ano",
  "Acima de R$100 milhões/ano",
] as const;

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

// --- Validação por passo (compartilhada entre client e server) ---

export const stepValueSchemas = {
  NAME: z.object({
    fullName: z
      .string()
      .trim()
      .min(2, "Informe seu nome completo")
      .max(120)
      .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  }),
  PHONE: z.object({
    phoneCountryCode: z.string().trim().min(2).max(5),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\d{10,11}$/, "Telefone inválido"),
  }),
  EMAIL: z.object({
    email: z.string().trim().email("E-mail inválido"),
  }),
  COMPANY: z.object({
    company: z.string().trim().min(2, "Informe o nome da empresa").max(160),
  }),
  SEGMENT: z.object({
    segment: z.enum(SEGMENT_OPTIONS),
  }),
  ROLE: z.object({
    role: z.enum(ROLE_OPTIONS),
  }),
  REVENUE: z.object({
    revenueRange: z.enum(REVENUE_OPTIONS),
  }),
  SCHEDULE: z.object({
    calBookingUid: z.string().trim().min(1),
    scheduledAt: z.string().trim().min(1),
    meetingLocation: z.string().trim().optional(),
  }),
} satisfies Record<StepKey, z.ZodType>;

export type StepAnswers = {
  fullName?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  city?: string | null;
  state?: string | null;
  email?: string;
  company?: string;
  segment?: string;
  role?: string;
  revenueRange?: string;
  /** true assim que o Cal.com confirma o agendamento — evita reabrir o calendário ao retomar a sessão. */
  scheduledConfirmed?: boolean;
};

// --- Roteiro de mensagens do bot (personalizado conforme respostas anteriores) ---

export const introMessages = (): string[] => [
  "Empresas que aplicam IA da forma certa estão reduzindo custos em até 40% e aumentando receita sem aumentar time. Quer descobrir como implementar IA de forma eficaz pode mudar o seu negócio?",
  "Então bora começar! Qual seu nome?",
];

export function messageAfterName(a: StepAnswers): string[] {
  return [`Prazer, ${firstName(a.fullName ?? "")}! Qual seu WhatsApp?`];
}

const CITY_FLAVOR: Record<string, string> = {
  "São Paulo": "São Paulo, capital econômica do país.",
  "Rio de Janeiro": "Rio de Janeiro, com um mercado cada vez mais digital.",
  "Belo Horizonte": "Belo Horizonte, polo em plena expansão de negócios.",
  Curitiba: "Curitiba, referência em inovação no Sul do país.",
  "Porto Alegre": "Porto Alegre, com empresas cada vez mais orientadas a dados.",
  Brasília: "Brasília, no centro das decisões do país.",
  Salvador: "Salvador, com o comércio local em plena transformação digital.",
  Recife: "Recife, um dos polos de tecnologia que mais cresce no Nordeste.",
  Fortaleza: "Fortaleza, com empresas cada vez mais competitivas.",
  Florianópolis: "Florianópolis, uma das capitais mais digitais do Brasil.",
};

export function messageAfterPhone(a: StepAnswers): string[] {
  const cityLine = a.city
    ? (CITY_FLAVOR[a.city] ?? `${a.city}${a.state ? `/${a.state}` : ""}, saindo na frente de quem ainda não usa IA.`)
    : null;
  const valueProp =
    "IA aqui deixou de ser diferencial — virou padrão mínimo pra competir. O que você não automatiza agora, o concorrente automatiza.";
  const lead = cityLine ? `${cityLine} ${valueProp}` : valueProp;
  return [`${lead} Qual seu e-mail?`];
}

export function messageAfterEmail(): string[] {
  return ["Ótimo! Qual o nome da sua empresa?"];
}

export function messageAfterCompany(a: StepAnswers): string[] {
  return [`Legal, ${a.company}! Qual o segmento da sua empresa?`];
}

export function messageAfterSegment(a: StepAnswers): string[] {
  return [`Ótimo! E qual é o seu cargo na ${a.company}?`];
}

export function messageAfterRole(a: StepAnswers): string[] {
  const name = firstName(a.fullName ?? "");
  const isDecisionMaker = DECISION_MAKER_ROLES.includes(a.role ?? "");
  const paragraph = isDecisionMaker
    ? `Perfeito, ${name}! Quem está no comando consegue enxergar rápido onde a IA gera impacto real no faturamento e já implementa sem burocracias. Vou montar um plano focado em resultados que falam direto pro seu P&L.`
    : `Show, ${name}! Profissionais como você são essenciais pra puxar a mudança de dentro — vou te mostrar como aplicar IA na prática pra gerar resultado rápido pro seu time.`;
  return [paragraph, "Hoje, qual é o faturamento anual da sua empresa?"];
}

export function messageAfterRevenue(): string[] {
  return [
    `Agende uma reunião e veja como aplicar IA no seu negócio com a Plataforma ${BRAND_NAME}.`,
  ];
}

export function messagesForStep(step: StepKey, a: StepAnswers): string[] {
  switch (step) {
    case "NAME":
      return messageAfterName(a);
    case "PHONE":
      return messageAfterPhone(a);
    case "EMAIL":
      return messageAfterEmail();
    case "COMPANY":
      return messageAfterCompany(a);
    case "SEGMENT":
      return messageAfterSegment(a);
    case "ROLE":
      return messageAfterRole(a);
    case "REVENUE":
      return messageAfterRevenue();
    case "SCHEDULE":
      return [];
  }
}
