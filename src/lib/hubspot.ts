import type { Lead } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Integração HubSpot: cria/atualiza um Contact (por e-mail) e um Deal ("card")
// associado, com uma nota de qualificação. Inativa até HUBSPOT_ACCESS_TOKEN ser
// configurado — todas as chamadas viram no-op nesse caso.
//
// IDs de associação padrão do HubSpot (confirmados na doc oficial):
// Deal -> Contact = 3 | Note -> Contact = 202 | Note -> Deal = 214

const HUBSPOT_API = "https://api.hubapi.com";
const DEFAULT_PIPELINE = process.env.HUBSPOT_PIPELINE_ID || "default";
const DEFAULT_STAGE = process.env.HUBSPOT_STAGE_ID || "appointmentscheduled";

function accessToken(): string | undefined {
  return process.env.HUBSPOT_ACCESS_TOKEN;
}

async function hubspotFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${HUBSPOT_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HubSpot ${init?.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function splitName(fullName?: string | null): { firstname?: string; lastname?: string } {
  if (!fullName) return {};
  const [firstname, ...rest] = fullName.trim().split(/\s+/);
  return { firstname, lastname: rest.join(" ") || undefined };
}

export function qualificationNote(lead: Lead): string {
  const lines = [
    lead.city && `Cidade: ${lead.city}${lead.state ? `/${lead.state}` : ""}`,
    lead.segment && `Segmento: ${lead.segment}`,
    lead.role && `Cargo: ${lead.role}`,
    lead.revenueRange && `Faturamento anual: ${lead.revenueRange}`,
    lead.utmSource &&
      `Origem: ${lead.utmSource}${lead.utmCampaign ? ` / campanha ${lead.utmCampaign}` : ""}`,
  ].filter(Boolean);
  return lines.length > 0
    ? lines.join("\n")
    : "Lead capturado pelo funil de diagnóstico (Squad.com).";
}

async function upsertContact(lead: Lead): Promise<string | undefined> {
  const { firstname, lastname } = splitName(lead.fullName);
  const res = await hubspotFetch("/crm/v3/objects/contacts/batch/upsert", {
    method: "POST",
    body: JSON.stringify({
      inputs: [
        {
          id: lead.email,
          idProperty: "email",
          properties: {
            email: lead.email,
            firstname,
            lastname,
            phone: lead.phoneE164 ?? undefined,
            company: lead.company ?? undefined,
            city: lead.city ?? undefined,
          },
        },
      ],
    }),
  });
  const results = res.results as { id?: string }[] | undefined;
  return results?.[0]?.id;
}

async function upsertDeal(
  lead: Lead,
  contactId: string,
  dealStageId?: string
): Promise<string | undefined> {
  const dealName = `${lead.fullName ?? "Lead"} — ${lead.company ?? "Diagnóstico IA"}`;

  if (lead.hubspotDealId) {
    await hubspotFetch(`/crm/v3/objects/deals/${lead.hubspotDealId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          dealname: dealName,
          ...(dealStageId ? { dealstage: dealStageId } : {}),
        },
      }),
    });
    return lead.hubspotDealId;
  }

  const created = await hubspotFetch("/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        dealname: dealName,
        pipeline: DEFAULT_PIPELINE,
        dealstage: dealStageId ?? DEFAULT_STAGE,
      },
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
        },
      ],
    }),
  });
  return created.id as string | undefined;
}

async function addNote(contactId: string, dealId: string, body: string) {
  await hubspotFetch("/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: { hs_note_body: body, hs_timestamp: Date.now() },
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
        },
        {
          to: { id: dealId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }],
        },
      ],
    }),
  });
}

/**
 * Cria/atualiza o Contact e o Deal do lead no HubSpot. Sem `HUBSPOT_ACCESS_TOKEN`
 * configurado, ou sem e-mail no lead, não faz nada (no-op silencioso).
 * Chame com `await` dentro da rota da API — em ambientes serverless, uma
 * chamada "fire-and-forget" pode ser encerrada antes de terminar.
 */
export async function syncLeadToHubspot(
  lead: Lead,
  opts?: { note?: string; dealStageId?: string }
): Promise<void> {
  if (!accessToken() || !lead.email) return;

  try {
    const contactId = await upsertContact(lead);
    if (!contactId) return;

    const dealId = await upsertDeal(lead, contactId, opts?.dealStageId);
    if (!dealId) return;

    if (opts?.note) {
      await addNote(contactId, dealId, opts.note);
    }

    if (contactId !== lead.hubspotContactId || dealId !== lead.hubspotDealId) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { hubspotContactId: contactId, hubspotDealId: dealId },
      });
    }
  } catch (err) {
    console.error("[hubspot] sync falhou", err);
  }
}
