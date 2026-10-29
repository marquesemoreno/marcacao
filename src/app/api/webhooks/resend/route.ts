import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resendEventStatus, shouldApplyDelivery, verifyResendSignature } from "@/lib/resend-webhook";

export const runtime = "nodejs";

/** Status de entrega dos e-mails de campanha (Resend → Webhooks, eventos email.delivered,
 * email.delivery_delayed, email.bounced, email.complained). Casa pelo id que o Resend devolveu
 * no envio (BroadcastRecipient.providerMessageId). "Marcou como spam" também tira o paciente
 * da lista de e-mail da clínica (equivale a pedir para sair). */
export async function POST(request: Request) {
  const body = await request.text();
  const ok = verifyResendSignature({
    secret: process.env.RESEND_WEBHOOK_SECRET ?? "",
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  });
  if (!ok) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });

  let event: { type?: string; created_at?: string; data?: { email_id?: string; bounce?: { message?: string } } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }
  const status = resendEventStatus(event.type ?? "");
  const emailId = event.data?.email_id;
  if (!status || !emailId) return NextResponse.json({ ignored: true });

  const recipient = await prisma.broadcastRecipient.findFirst({
    where: { providerMessageId: emailId },
    select: { id: true, phone: true, deliveryStatus: true, campaign: { select: { clinicId: true } } },
  });
  if (!recipient) return NextResponse.json({ ignored: true });
  if (!shouldApplyDelivery(recipient.deliveryStatus, status)) return NextResponse.json({ ok: true });

  const at = event.created_at ? new Date(event.created_at) : new Date();
  await prisma.broadcastRecipient.update({
    where: { id: recipient.id },
    data: {
      deliveryStatus: status,
      deliveryAt: Number.isNaN(at.getTime()) ? new Date() : at,
      ...(status === "BOUNCED" ? { errorMessage: `E-mail voltou${event.data?.bounce?.message ? `: ${event.data.bounce.message}` : ""}` } : {}),
    },
  });
  if (status === "COMPLAINED") {
    await prisma.channelConsent.updateMany({
      where: { clinicId: recipient.campaign.clinicId, channel: "EMAIL", address: recipient.phone, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
