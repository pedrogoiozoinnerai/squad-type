import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const initSchema = z.object({
  sessionId: z.string().trim().min(10).max(100),
  utmSource: z.string().trim().max(200).optional().nullable(),
  utmMedium: z.string().trim().max(200).optional().nullable(),
  utmCampaign: z.string().trim().max(200).optional().nullable(),
  utmTerm: z.string().trim().max(200).optional().nullable(),
  utmContent: z.string().trim().max(200).optional().nullable(),
  fbclid: z.string().trim().max(500).optional().nullable(),
  gclid: z.string().trim().max(500).optional().nullable(),
  fbp: z.string().trim().max(200).optional().nullable(),
  fbc: z.string().trim().max(200).optional().nullable(),
  referrer: z.string().trim().max(2000).optional().nullable(),
  landingUrl: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = initSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { sessionId, ...attribution } = parsed.data;
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;

  // Cada campo só é (re)gravado quando o client efetivamente o enviou desta vez —
  // o client já mescla com o que capturou antes (ver src/lib/attribution.ts), então
  // aqui só precisamos não sobrescrever com `undefined` um valor já salvo.
  const attributionFields = {
    utmSource: attribution.utmSource ?? undefined,
    utmMedium: attribution.utmMedium ?? undefined,
    utmCampaign: attribution.utmCampaign ?? undefined,
    utmTerm: attribution.utmTerm ?? undefined,
    utmContent: attribution.utmContent ?? undefined,
    fbclid: attribution.fbclid ?? undefined,
    gclid: attribution.gclid ?? undefined,
    fbp: attribution.fbp ?? undefined,
    fbc: attribution.fbc ?? undefined,
  };

  const lead = await prisma.lead.upsert({
    where: { sessionId },
    update: attributionFields,
    create: {
      sessionId,
      ...attributionFields,
      referrer: attribution.referrer ?? undefined,
      landingUrl: attribution.landingUrl ?? undefined,
      userAgent,
      ipAddress,
    },
  });

  return NextResponse.json({ lead });
}
