import "server-only";
import { prisma } from "@/lib/prisma";
import { buildMetaEvent } from "@/lib/ad-tracking";
import { computeOutcomes } from "@/lib/lead-outcomes-server";

/** Cliques valem 90 dias (janela máxima de importação do Google Ads; depois são apagados). */
export const CLICK_WINDOW_DAYS = 90;
/** A Meta só aceita eventos de até 7 dias atrás. */
const META_MAX_AGE_DAYS = 7;
const META_API_VERSION = "v21.0";

export type ConversionKind = "SCHEDULED" | "ATTENDED";

/** Nome da conversão no Google Ads (precisa ser IGUAL ao cadastrado lá). Genérico de
 * propósito: nada de especialidade ou procedimento no nome. */
export function googleConversionName(kind: ConversionKind): string {
  return kind === "SCHEDULED"
    ? process.env.GOOGLE_ADS_CONVERSION_SCHEDULED || "Agendamento"
    : process.env.GOOGLE_ADS_CONVERSION_ATTENDED || "Comparecimento";
}

/** Evento padrão da Meta. Comparecimento desligado por padrão (vazio): na categoria de
 * saúde a Meta restringe eventos de fundo de funil — mandamos só "Lead" ao agendar. */
function metaEventName(kind: ConversionKind): string | null {
  const v = kind === "SCHEDULED" ? (process.env.META_CAPI_EVENT_SCHEDULED ?? "Lead") : (process.env.META_CAPI_EVENT_ATTENDED ?? "");
  return v.trim() || null;
}

/** Grava as conversões novas (agendou/compareceu) dos cliques ligados a conversas. */
export async function syncAdConversions(now = new Date()) {
  const clicks = await prisma.adClick.findMany({
    where: { conversationId: { not: null }, createdAt: { gte: new Date(now.getTime() - CLICK_WINDOW_DAYS * 86_400_000) } },
    select: {
      id: true,
      conversions: { select: { kind: true } },
      conversation: {
        select: {
          id: true,
          clinicId: true,
          createdAt: true,
          updatedAt: true,
          funnelStage: true,
          resolutionReason: true,
          resolvedAt: true,
          contact: { select: { phone: true } },
          stageChanges: { where: { toStage: "AGENDADO" }, select: { createdAt: true } },
        },
      },
    },
  });
  const pending = clicks.filter((c) => c.conversation && c.conversions.length < 2);
  const byClinic = new Map<string, typeof pending>();
  for (const c of pending) byClinic.set(c.conversation!.clinicId, [...(byClinic.get(c.conversation!.clinicId) ?? []), c]);

  let created = 0;
  for (const [clinicId, list] of byClinic) {
    const outcomes = await computeOutcomes(
      clinicId,
      list.map(({ conversation: c }) => ({
        id: c!.id,
        createdAt: c!.createdAt,
        updatedAt: c!.updatedAt,
        funnelStage: c!.funnelStage,
        resolutionReason: c!.resolutionReason,
        resolvedAt: c!.resolvedAt,
        phone: c!.contact.phone,
        scheduledStageAt: c!.stageChanges.map((s) => s.createdAt),
      })),
    );
    for (const click of list) {
      const o = outcomes.get(click.conversation!.id);
      const have = new Set(click.conversions.map((x) => x.kind));
      const add: { kind: ConversionKind; at: Date | null }[] = [
        { kind: "SCHEDULED", at: o?.scheduledAt ?? null },
        { kind: "ATTENDED", at: o?.attendedAt ?? null },
      ];
      for (const a of add) {
        if (!a.at || have.has(a.kind)) continue;
        const r = await prisma.adConversion.createMany({
          data: [{ adClickId: click.id, kind: a.kind, occurredAt: a.at > now ? now : a.at }],
          skipDuplicates: true,
        });
        created += r.count;
      }
    }
  }
  return { clicks: clicks.length, created };
}

/** Manda à Meta (Conversions API) as conversões de cliques com fbclid ainda não enviadas. */
export async function sendMetaConversions(now = new Date(), fetchImpl: typeof fetch = fetch) {
  const pixel = process.env.META_CAPI_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixel || !token) return { sent: 0, skipped: "sem META_CAPI_PIXEL_ID/META_CAPI_ACCESS_TOKEN" };

  const pending = await prisma.adConversion.findMany({
    where: {
      metaSentAt: null,
      metaError: null,
      occurredAt: { gte: new Date(now.getTime() - META_MAX_AGE_DAYS * 86_400_000) },
      adClick: { fbclid: { not: null } },
    },
    select: { id: true, kind: true, occurredAt: true, adClick: { select: { fbclid: true, createdAt: true, conversationId: true } } },
    take: 500,
  });
  const events = pending
    .map((p) => {
      const name = metaEventName(p.kind as ConversionKind);
      return name
        ? {
            id: p.id,
            event: buildMetaEvent({
              eventName: name,
              eventId: `${p.adClick.conversationId}:${p.kind}`,
              occurredAt: p.occurredAt,
              fbclid: p.adClick.fbclid!,
              clickedAt: p.adClick.createdAt,
            }),
          }
        : null;
    })
    .filter((e): e is NonNullable<typeof e> => !!e);
  if (events.length === 0) return { sent: 0 };

  const body: Record<string, unknown> = { data: events.map((e) => e.event) };
  if (process.env.META_CAPI_TEST_EVENT_CODE) body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE;
  const res = await fetchImpl(`https://graph.facebook.com/${META_API_VERSION}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const ids = events.map((e) => e.id);
  if (res.ok) {
    await prisma.adConversion.updateMany({ where: { id: { in: ids } }, data: { metaSentAt: now } });
    return { sent: ids.length };
  }
  const detail = (await res.text()).slice(0, 300);
  console.error("Meta Conversions API recusou:", res.status, detail);
  // 4xx = evento recusado (não adianta repetir); 5xx = tenta de novo na próxima hora.
  if (res.status < 500) await prisma.adConversion.updateMany({ where: { id: { in: ids } }, data: { metaError: `${res.status}: ${detail}` } });
  return { sent: 0, error: res.status };
}
