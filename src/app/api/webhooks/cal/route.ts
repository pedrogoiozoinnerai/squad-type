import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Webhook do Cal.com (Settings > Developer > Webhooks). Configure a URL desse
// endpoint lá, assine com CAL_WEBHOOK_SECRET, e marque pelo menos o evento
// "Booking Created". Isso confirma o agendamento no nosso banco mesmo se o
// lead fechar a aba antes do evento client-side (bookingSuccessful) disparar.

type CalBookingPayload = {
  uid?: string;
  startTime?: string;
  metadata?: Record<string, unknown>;
  attendees?: { email?: string }[];
};

type CalWebhookEvent = {
  triggerEvent?: string;
  payload?: CalBookingPayload;
};

function isValidSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (secret) {
    const signature = request.headers.get("x-cal-signature-256");
    if (!isValidSignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  const event = JSON.parse(rawBody) as CalWebhookEvent;
  if (event.triggerEvent !== "BOOKING_CREATED") {
    // Só nos importamos com a criação da reserva por enquanto (cancelamento/
    // reagendamento podem ser tratados depois se virar necessário).
    return NextResponse.json({ ok: true, ignored: event.triggerEvent });
  }

  const booking = event.payload;
  const sessionId = booking?.metadata?.sessionId;
  const attendeeEmail = booking?.attendees?.[0]?.email;

  const lead =
    typeof sessionId === "string"
      ? await prisma.lead.findUnique({ where: { sessionId } })
      : attendeeEmail
        ? await prisma.lead.findFirst({
            where: { email: attendeeEmail },
            orderBy: { createdAt: "desc" },
          })
        : null;

  if (!lead || !booking?.uid) {
    return NextResponse.json({ ok: true, matched: false });
  }

  // Idempotente: se o client-side (bookingSuccessful) já processou essa mesma
  // reserva antes do webhook chegar, não duplica o LeadEvent.
  if (lead.calBookingUid === booking.uid) {
    return NextResponse.json({ ok: true, matched: true, alreadyProcessed: true });
  }

  const scheduledAt = booking.startTime ? new Date(booking.startTime) : new Date();

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      calBookingUid: booking.uid,
      scheduledAt,
      status: "COMPLETED",
      completedAt: new Date(),
      events: {
        create: {
          step: "SCHEDULE",
          payload: JSON.stringify({ source: "cal_webhook", ...booking }),
        },
      },
    },
  });

  return NextResponse.json({ ok: true, matched: true });
}
