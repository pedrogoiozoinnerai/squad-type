import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { extractDdd, lookupDdd } from "@/lib/ddd";
import { STEP_ORDER, nextStep, stepValueSchemas, type StepKey } from "@/lib/funnel";

const bodySchema = z.object({
  step: z.enum(STEP_ORDER),
  value: z.record(z.string(), z.unknown()),
});

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/leads/[sessionId]">
) {
  const { sessionId } = await ctx.params;
  if (sessionId.length < 10 || sessionId.length > 100) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
  }

  const { step, value } = parsedBody.data;
  const schema = stepValueSchemas[step as StepKey];
  const parsedValue = schema.safeParse(value);
  if (!parsedValue.success) {
    return NextResponse.json({ error: parsedValue.error.flatten() }, { status: 400 });
  }

  // O cliente dispara a criação do lead (POST /api/leads) e segue a conversa sem
  // esperar. Numa rede lenta a primeira resposta pode chegar antes da criação —
  // então criamos aqui o que faltar, em vez de devolver 404 e perder o dado.
  // `upsert` com `update: {}` não toca no que já existe.
  const lead = await prisma.lead.upsert({
    where: { sessionId },
    update: {},
    create: {
      sessionId,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        undefined,
    },
  });

  const data: Record<string, unknown> = {};
  const v = parsedValue.data as Record<string, unknown>;

  switch (step) {
    case "NAME":
      data.fullName = v.fullName;
      if (!lead.consentAcceptedAt) {
        data.consentAcceptedAt = new Date();
        data.privacyVersion = "v1";
      }
      break;
    case "PHONE": {
      const countryCode = String(v.phoneCountryCode);
      const phoneNumber = String(v.phoneNumber);
      const ddd = extractDdd(phoneNumber);
      const info = ddd ? lookupDdd(ddd) : null;
      data.phoneCountryCode = countryCode;
      data.phoneNumber = phoneNumber;
      data.phoneE164 = `${countryCode.replace(/[^\d+]/g, "")}${phoneNumber}`;
      data.ddd = ddd ?? undefined;
      data.city = info?.city ?? undefined;
      data.state = info?.state ?? undefined;
      break;
    }
    case "EMAIL":
      data.email = v.email;
      break;
    case "COMPANY":
      data.company = v.company;
      break;
    case "SEGMENT":
      data.segment = v.segment;
      break;
    case "ROLE":
      data.role = v.role;
      break;
    case "REVENUE":
      data.revenueRange = v.revenueRange;
      break;
    case "SCHEDULE":
      // tratado no endpoint dedicado /schedule
      break;
  }

  const advancedTo = nextStep(step as StepKey);
  data.currentStep = advancedTo ?? step;

  const updated = await prisma.lead.update({
    where: { sessionId },
    data: {
      ...data,
      events: {
        create: {
          step,
          payload: JSON.stringify(v),
        },
      },
    },
  });

  return NextResponse.json({ lead: updated });
}

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/leads/[sessionId]">
) {
  const { sessionId } = await ctx.params;
  const lead = await prisma.lead.findUnique({ where: { sessionId } });
  if (!lead) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ lead });
}
