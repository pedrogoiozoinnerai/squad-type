import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Webhook do Cal.com (Settings > Developer > Webhooks). Configure a URL desse
// endpoint lá, assine com CAL_WEBHOOK_SECRET, e marque os eventos
// "Booking Created", "Booking Cancelled" e "Booking Rescheduled".
//
// Criação confirma o agendamento mesmo se o lead fechar a aba antes do evento
// client-side disparar. Cancelamento e remarcação existem porque o CRM lê este
// banco: sem eles, um vendedor ficaria com reunião fantasma na agenda e
// ninguém saberia que a pessoa desmarcou.

type CalBookingPayload = {
  uid?: string;
  /// No reagendamento o Cal manda o uid antigo aqui e um novo em `uid`.
  originalBookingUid?: string;
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
  const tipo = event.triggerEvent;
  if (tipo !== "BOOKING_CREATED" && tipo !== "BOOKING_CANCELLED" && tipo !== "BOOKING_RESCHEDULED") {
    return NextResponse.json({ ok: true, ignored: tipo });
  }

  const booking = event.payload;
  const sessionId = booking?.metadata?.sessionId;
  const attendeeEmail = booking?.attendees?.[0]?.email;

  // Cancelamento e remarcação chegam com o uid da reserva, que é a ligação mais
  // confiável — o `metadata.sessionId` só existe na reserva criada pelo funil.
  const porUid = booking?.uid || booking?.originalBookingUid;

  const lead =
    typeof sessionId === "string"
      ? await prisma.lead.findUnique({ where: { sessionId } })
      : porUid
        ? await prisma.lead.findFirst({ where: { calBookingUid: porUid } })
        : attendeeEmail
          ? await prisma.lead.findFirst({
              where: { email: attendeeEmail },
              orderBy: { createdAt: "desc" },
            })
          : null;

  if (!lead || !booking?.uid) {
    return NextResponse.json({ ok: true, matched: false });
  }

  if (tipo === "BOOKING_CANCELLED") {
    // `scheduledAt` fica como estava de propósito: apagá-lo tornaria este lead
    // indistinguível de quem nunca agendou, e é essa diferença que faz o CRM
    // abrir uma tarefa de retomada em vez de um primeiro contato.
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        calCancelledAt: new Date(),
        events: { create: { step: "SCHEDULE", payload: JSON.stringify({ source: "cal_webhook", tipo, ...booking }) } },
      },
    });
    return NextResponse.json({ ok: true, matched: true, cancelled: true });
  }

  if (tipo === "BOOKING_RESCHEDULED") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        calBookingUid: booking.uid,
        scheduledAt: booking.startTime ? new Date(booking.startTime) : lead.scheduledAt,
        // Remarcou depois de ter cancelado: volta a valer.
        calCancelledAt: null,
        status: "COMPLETED",
        events: { create: { step: "SCHEDULE", payload: JSON.stringify({ source: "cal_webhook", tipo, ...booking }) } },
      },
    });
    return NextResponse.json({ ok: true, matched: true, rescheduled: true });
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
      calCancelledAt: null,
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
