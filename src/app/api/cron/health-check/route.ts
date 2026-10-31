import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/request-auth";
import { getEvolutionConfig } from "@/lib/whatsapp";
import { sendEmailViaResend } from "@/lib/resend";
import { isBridgeCheckWindow, nextHealthState, type HealthState } from "@/lib/health-alerts";

/** A cada 15 min (vercel.json). Estado de cada item fica no webhook_logs
 * (event "health.state", só grava quando muda) — sem tabela nova. E-mail vai pra
 * HEALTH_ALERT_EMAIL (remetente BROADCAST_EMAIL_FROM); sem ela só registra. */
type Check = { key: string; label: string; healthy: boolean; detail: string };

const TIMEOUT = 10000;

async function checkWhatsapp(clinicId: string): Promise<{ healthy: boolean; detail: string }> {
  const { apiUrl, apiKey, instanceName } = await getEvolutionConfig(clinicId);
  try {
    const res = await fetch(`${apiUrl!.replace(/\/$/, "")}/instance/connectionState/${instanceName}`, {
      headers: { apikey: apiKey! },
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as { instance?: { state?: string } } | null;
    const state = data?.instance?.state ?? `HTTP ${res.status}`;
    return { healthy: state === "open", detail: `conexão: ${state}` };
  } catch {
    return { healthy: false, detail: "servidor da Evolution não respondeu" };
  }
}

async function checkBridge(apiUrl: string): Promise<{ healthy: boolean; detail: string }> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
    return { healthy: res.ok, detail: res.ok ? "online" : `HTTP ${res.status}` };
  } catch {
    return { healthy: false, detail: "sem resposta" };
  }
}

async function checkInstagram(accessToken: string, expiresAt: Date | null): Promise<{ healthy: boolean; detail: string }> {
  if (expiresAt && expiresAt.getTime() - Date.now() < 7 * 86_400_000) {
    return { healthy: false, detail: `token vence em ${expiresAt.toLocaleDateString("pt-BR")} e não foi renovado` };
  }
  try {
    const res = await fetch("https://graph.instagram.com/v23.0/me?fields=user_id", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    return { healthy: res.ok, detail: res.ok ? "token válido" : `Meta recusou o token (HTTP ${res.status})` };
  } catch {
    return { healthy: false, detail: "Meta não respondeu" };
  }
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [instances, cloudClinics, bridges, igAccounts] = await Promise.all([
    // Só clínicas em uso (conversa nos últimos 14 dias): a demo e números abandonados
    // ficariam alertando pra sempre.
    prisma.whatsappInstance.findMany({
      where: { apiUrl: { not: "https://demo.invalid" }, clinic: { active: true, conversations: { some: { updatedAt: { gte: new Date(Date.now() - 14 * 86_400_000) } } } } },
      select: { clinicId: true, clinic: { select: { name: true } } },
    }),
    prisma.whatsappCloudAccount.findMany({ where: { active: true }, select: { clinicId: true } }),
    prisma.hospitalIntegration.findMany({ where: { active: true }, select: { clinicId: true, apiUrl: true, clinic: { select: { name: true } } } }),
    prisma.instagramAccount.findMany({ where: { active: true }, select: { clinicId: true, username: true, accessToken: true, tokenExpiresAt: true } }),
  ]);
  const onCloud = new Set(cloudClinics.map((c) => c.clinicId));

  const jobs: Promise<Check>[] = [];
  for (const i of instances) {
    if (onCloud.has(i.clinicId)) continue; // API oficial não depende de celular conectado
    jobs.push(checkWhatsapp(i.clinicId).then((r) => ({ key: `whatsapp:${i.clinicId}`, label: `WhatsApp — ${i.clinic.name}`, ...r })));
  }
  if (isBridgeCheckWindow()) {
    for (const b of bridges) {
      jobs.push(checkBridge(b.apiUrl).then((r) => ({ key: `bridge:${b.clinicId}`, label: `Sistema da clínica (bridge) — ${b.clinic.name}`, ...r })));
    }
  }
  for (const a of igAccounts) {
    jobs.push(checkInstagram(a.accessToken, a.tokenExpiresAt).then((r) => ({ key: `instagram:${a.clinicId}`, label: `Instagram @${a.username ?? "?"}`, ...r })));
  }
  const checks = await Promise.all(jobs);

  const logs = await prisma.webhookLog.findMany({
    where: { event: "health.state" },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: { payload: true },
  });
  const prev = new Map<string, HealthState>();
  for (const l of logs) {
    const p = l.payload as { key?: string; state?: HealthState };
    if (p?.key && p.state && !prev.has(p.key)) prev.set(p.key, p.state);
  }

  const alerts: { kind: "down" | "recovered"; check: Check }[] = [];
  for (const c of checks) {
    const before = prev.get(c.key);
    const { state, alert } = nextHealthState(before, c.healthy);
    if (state !== (before ?? "ok")) {
      await prisma.webhookLog.create({ data: { event: "health.state", payload: { key: c.key, state, detail: c.detail }, status: state } });
    }
    if (alert) alerts.push({ kind: alert, check: c });
  }

  let emailed = false;
  const to = process.env.HEALTH_ALERT_EMAIL;
  if (alerts.length && to && process.env.RESEND_API_KEY && process.env.BROADCAST_EMAIL_FROM) {
    const down = alerts.filter((a) => a.kind === "down");
    const lines = alerts.map((a) => `${a.kind === "down" ? "🔴 FORA DO AR" : "🟢 VOLTOU"} — ${a.check.label} (${a.check.detail})`);
    const subject = down.length ? `🔴 Conecta Saúde: ${down.map((a) => a.check.label).join(", ")} fora do ar` : `🟢 Conecta Saúde: ${alerts.map((a) => a.check.label).join(", ")} voltou`;
    const text = `${lines.join("\n")}\n\nChecagem automática a cada 15 min — só avisa depois de 2 falhas seguidas.`;
    const r = await sendEmailViaResend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.BROADCAST_EMAIL_FROM,
      to,
      subject,
      text,
      html: `<p>${lines.map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;")).join("<br>")}</p><p style="color:#666;font-size:12px">Checagem automática a cada 15 min — só avisa depois de 2 falhas seguidas.</p>`,
    });
    emailed = r.success;
  }

  return NextResponse.json({ checked: checks.map((c) => ({ key: c.key, healthy: c.healthy, detail: c.detail })), alerts: alerts.length, emailed });
}
