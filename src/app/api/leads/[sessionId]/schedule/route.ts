import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stepValueSchemas } from "@/lib/funnel";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/leads/[sessionId]/schedule">
) {
  const { sessionId } = await ctx.params;

  const json = await request.json().catch(() => null);
  const parsed = stepValueSchemas.SCHEDULE.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { sessionId } });
  if (!lead) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  const { calBookingUid, scheduledAt, meetingLocation } = parsed.data;

  // Tanto o evento client-side (bookingSuccessful) quanto o webhook do Cal.com
  // podem confirmar a mesma reserva — evita duplicar o LeadEvent e a nota no HubSpot.
  if (lead.calBookingUid === calBookingUid) {
    return NextResponse.json({ lead });
  }

  const updated = await prisma.lead.update({
    where: { sessionId },
    data: {
      calBookingUid,
      scheduledAt: new Date(scheduledAt),
      meetingLocation,
      status: "COMPLETED",
      completedAt: new Date(),
      events: {
        create: {
          step: "SCHEDULE",
          payload: JSON.stringify(parsed.data),
        },
      },
    },
  });

  return NextResponse.json({ lead: updated });
}
