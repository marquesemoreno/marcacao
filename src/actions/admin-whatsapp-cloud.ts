"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import { t, type Lang } from "@/lib/i18n-review";
import {
  createCloudTemplate,
  exchangeEmbeddedSignupCode,
  getPhoneNumberInfo,
  listCloudTemplates,
  listWabaPhoneNumbers,
  registerPhoneNumber,
  requestCoexistenceSync,
  sendCloudTemplate,
  sendCloudText,
  subscribeAppToWaba,
  type CloudPhoneNumber,
  type CloudTemplate,
} from "@/lib/whatsapp-cloud";

export type CloudAccountRow = {
  clinicId: string;
  clinicName: string;
  account: {
    wabaId: string;
    phoneNumberId: string;
    displayPhoneNumber: string | null;
    verifiedName: string | null;
    coexistence: boolean;
    active: boolean;
    connectedAt: string;
    reminderTemplateName: string | null;
    reminderTemplateLanguage: string | null;
  } | null;
};

/** Conta da clínica com o token já aberto (só no servidor — nunca sai daqui nem vai pra log). */
async function accountFor(clinicId: string) {
  const account = await prisma.whatsappCloudAccount.findUnique({ where: { clinicId } });
  if (!account) return null;
  return { ...account, token: decryptToken(account.accessToken) };
}

/** Clínicas e a conta da API oficial de cada uma (tela /admin/whatsapp). */
export async function listCloudAccounts(): Promise<CloudAccountRow[]> {
  await requireAdminSession();
  const clinics = await prisma.clinic.findMany({
    orderBy: { tradeName: "asc" },
    select: {
      id: true,
      tradeName: true,
      whatsappCloudAccount: {
        select: { wabaId: true, phoneNumberId: true, displayPhoneNumber: true, verifiedName: true, coexistence: true, active: true, createdAt: true, reminderTemplateName: true, reminderTemplateLanguage: true },
      },
    },
  });
  return clinics.map((c) => ({
    clinicId: c.id,
    clinicName: c.tradeName,
    account: c.whatsappCloudAccount
      ? {
          wabaId: c.whatsappCloudAccount.wabaId,
          phoneNumberId: c.whatsappCloudAccount.phoneNumberId,
          displayPhoneNumber: c.whatsappCloudAccount.displayPhoneNumber,
          verifiedName: c.whatsappCloudAccount.verifiedName,
          coexistence: c.whatsappCloudAccount.coexistence,
          active: c.whatsappCloudAccount.active,
          reminderTemplateName: c.whatsappCloudAccount.reminderTemplateName,
          reminderTemplateLanguage: c.whatsappCloudAccount.reminderTemplateLanguage,
          connectedAt: c.whatsappCloudAccount.createdAt.toISOString(),
        }
      : null,
  }));
}

/** Fim do Embedded Signup: troca o código pelo token, assina o webhook na WABA, registra o
 * número (só número novo — coexistência não registra), lê número/nome verificado e salva
 * a conta com o token criptografado (desligada no Chat até ser testada). Em coexistência,
 * pede a sincronização de contatos e histórico (prazo de 24 h da Meta). */
export async function connectWhatsappCloud(input: {
  clinicId: string;
  code: string;
  wabaId: string;
  phoneNumberId: string;
  coexistence: boolean;
  /** Idioma das mensagens devolvidas (a gravação da análise da Meta é em inglês). */
  lang?: Lang;
}): Promise<{ success: true; displayPhoneNumber: string | null; warnings: string[] } | { success: false; error: string }> {
  await requireAdminSession();
  const lang = input.lang ?? "pt";
  if (!input.code || !input.wabaId) return { success: false, error: t(lang, "err.missingIds") };
  if (!input.phoneNumberId) return { success: false, error: t(lang, "err.onlyWaba") };

  const existingForNumber = await prisma.whatsappCloudAccount.findUnique({ where: { phoneNumberId: input.phoneNumberId } });
  if (existingForNumber && existingForNumber.clinicId !== input.clinicId) {
    return { success: false, error: t(lang, "err.numberTaken") };
  }

  const exchange = await exchangeEmbeddedSignupCode(input.code);
  if (!exchange.success) return { success: false, error: t(lang, "err.codeRejected", { detail: exchange.error }) };
  const token = exchange.data.access_token;

  const warnings: string[] = [];
  const sub = await subscribeAppToWaba(input.wabaId, token);
  if (!sub.success) warnings.push(t(lang, "warn.webhook", { detail: sub.error }));

  let pin: string | null = null;
  if (!input.coexistence) {
    pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const reg = await registerPhoneNumber(input.phoneNumberId, token, pin);
    if (!reg.success) warnings.push(t(lang, "warn.register", { detail: reg.error }));
  }

  const info = await getPhoneNumberInfo(input.phoneNumberId, token);
  const displayPhoneNumber = info.success ? (info.data.display_phone_number ?? null) : null;
  const verifiedName = info.success ? (info.data.verified_name ?? null) : null;

  const data = {
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
    displayPhoneNumber,
    verifiedName,
    accessToken: encryptToken(token),
    coexistence: input.coexistence,
    ...(pin ? { twoStepPin: encryptToken(pin) } : {}),
  };
  await prisma.whatsappCloudAccount.upsert({
    where: { clinicId: input.clinicId },
    update: data,
    create: { clinicId: input.clinicId, ...data, active: false },
  });

  if (input.coexistence) {
    for (const type of ["smb_app_state_sync", "history"] as const) {
      const r = await requestCoexistenceSync(input.phoneNumberId, token, type);
      if (!r.success) warnings.push(t(lang, "warn.sync", { type, detail: r.error }));
    }
  }

  revalidatePath("/admin/whatsapp");
  return { success: true, displayPhoneNumber, warnings };
}

/** Liga/desliga a API oficial no Chat da clínica: ligada, tudo (chat, lembretes, avisos,
 * IA) sai e entra por ela; a Evolution da clínica deve estar desconectada antes, senão cada
 * mensagem chega duas vezes. */
export async function setCloudAccountActive(clinicId: string, active: boolean) {
  await requireAdminSession();
  await prisma.whatsappCloudAccount.update({ where: { clinicId }, data: { active } });
  revalidatePath("/admin/whatsapp");
  return { success: true as const };
}

/** Modelo aprovado do lembrete D-1 ({{1}} nome, {{2}} data, {{3}} horário, {{4}} médico). */
export async function setCloudReminderTemplate(clinicId: string, name: string, language: string) {
  await requireAdminSession();
  const n = name.trim();
  await prisma.whatsappCloudAccount.update({
    where: { clinicId },
    data: { reminderTemplateName: n || null, reminderTemplateLanguage: n ? language.trim() || "pt_BR" : null },
  });
  revalidatePath("/admin/whatsapp");
  return { success: true as const };
}

/** Teste rápido da conexão: modelo "hello_world" (existe em toda conta nova da Meta). */
export async function sendCloudTestMessage(clinicId: string, to: string, lang: Lang = "pt"): Promise<{ success: boolean; error?: string }> {
  await requireAdminSession();
  const r = await sendTemplateLogged(clinicId, to, { name: "hello_world", language: "en_US", bodyParams: [] }, "Hello World");
  if (r.success) return { success: true };
  // Erros nossos vêm em pt — traduz os conhecidos; os da Meta já vêm em inglês.
  const known: Record<string, Parameters<typeof t>[1]> = {
    "Clínica sem conta da API oficial.": "err.noAccount",
    "Informe o número com DDI e DDD (ex: 5577999998888).": "err.badNumber",
  };
  return { success: false, error: known[r.error] ? t(lang, known[r.error]) : r.error };
}

/** Desconecta no nosso lado (apaga a conta e o token). Em coexistência, a clínica
 * desconecta no app: Configurações > Conta > Plataforma Business. */
export async function disconnectWhatsappCloud(clinicId: string): Promise<{ success: boolean }> {
  await requireAdminSession();
  await prisma.whatsappCloudAccount.deleteMany({ where: { clinicId } });
  revalidatePath("/admin/whatsapp");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Telas de teste (envio e modelos) — usadas na análise do app pela Meta.
// ---------------------------------------------------------------------------

export type CloudAssets = {
  clinicId: string;
  clinicName: string;
  wabaId: string;
  phoneNumbers: CloudPhoneNumber[];
  defaultPhoneNumberId: string;
  error?: string;
};

/** Contas conectadas com a WABA e os números dela (seletor visível na tela de envio). */
export async function listCloudAssets(): Promise<CloudAssets[]> {
  await requireAdminSession();
  const accounts = await prisma.whatsappCloudAccount.findMany({ include: { clinic: { select: { tradeName: true } } } });
  return Promise.all(
    accounts.map(async (a) => {
      // Token ilegível (chave WHATSAPP_TOKEN_ENCRYPTION_KEY ausente ou diferente da usada
      // pra gravar) não pode derrubar a página inteira — vira aviso no card da conta.
      let token: string | null = null;
      try {
        token = decryptToken(a.accessToken);
      } catch {
        token = null;
      }
      const numbers = token
        ? await listWabaPhoneNumbers(a.wabaId, token)
        : { success: false as const, error: "Não deu para ler o token: confira WHATSAPP_TOKEN_ENCRYPTION_KEY na Vercel (mesmo valor usado ao conectar)." };
      return {
        clinicId: a.clinicId,
        clinicName: a.clinic.tradeName,
        wabaId: a.wabaId,
        defaultPhoneNumberId: a.phoneNumberId,
        phoneNumbers: numbers.success
          ? numbers.data.data
          : [{ id: a.phoneNumberId, display_phone_number: a.displayPhoneNumber ?? a.phoneNumberId, verified_name: a.verifiedName ?? undefined }],
        ...(numbers.success ? {} : { error: numbers.error }),
      };
    })
  );
}

function onlyDigits(to: string): string | null {
  const digits = to.replace(/\D/g, "");
  return digits.length >= 12 && digits.length <= 15 ? digits : null;
}

async function logAndSend(
  clinicId: string,
  phoneNumberId: string,
  to: string,
  kind: "TEXT" | "TEMPLATE",
  body: string,
  templateName: string | null,
  send: (token: string) => Promise<{ success: true; data: { messages?: { id: string }[] } } | { success: false; error: string }>
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const account = await accountFor(clinicId);
  if (!account) return { success: false, error: "Clínica sem conta da API oficial." };
  const row = await prisma.cloudTestMessage.create({ data: { clinicId, phoneNumberId, to, kind, body, templateName } });
  const r = await send(account.token);
  if (!r.success) {
    await prisma.cloudTestMessage.update({ where: { id: row.id }, data: { status: "FAILED", error: r.error } });
    return { success: false, error: r.error };
  }
  await prisma.cloudTestMessage.update({ where: { id: row.id }, data: { status: "SENT", wamid: r.data.messages?.[0]?.id ?? null } });
  return { success: true, id: row.id };
}

async function sendTemplateLogged(
  clinicId: string,
  to: string,
  template: { name: string; language: string; bodyParams: string[] },
  bodyPreview: string,
  phoneNumberId?: string
) {
  const account = await accountFor(clinicId);
  if (!account) return { success: false as const, error: "Clínica sem conta da API oficial." };
  const digits = onlyDigits(to);
  if (!digits) return { success: false as const, error: "Informe o número com DDI e DDD (ex: 5577999998888)." };
  const pnid = phoneNumberId || account.phoneNumberId;
  return logAndSend(clinicId, pnid, digits, "TEMPLATE", bodyPreview, template.name, (token) => sendCloudTemplate(pnid, token, digits, template));
}

/** Envio de texto livre pela tela "Send message" (vale na janela de 24 h do destinatário). */
export async function sendCloudTestText(input: { clinicId: string; phoneNumberId: string; to: string; text: string }) {
  await requireAdminSession();
  const digits = onlyDigits(input.to);
  if (!digits) return { success: false as const, error: "Informe o número com DDI e DDD (ex: 5577999998888)." };
  if (!input.text.trim()) return { success: false as const, error: "Escreva a mensagem." };
  return logAndSend(input.clinicId, input.phoneNumberId, digits, "TEXT", input.text.trim(), null, (token) =>
    sendCloudText(input.phoneNumberId, token, digits, input.text.trim())
  );
}

/** Envio de modelo aprovado preenchendo as variáveis {{1}}, {{2}}… */
export async function sendCloudTestTemplate(input: {
  clinicId: string;
  phoneNumberId: string;
  to: string;
  name: string;
  language: string;
  bodyText: string;
  params: string[];
}) {
  await requireAdminSession();
  const preview = input.bodyText.replace(/\{\{(\d+)\}\}/g, (_, n: string) => input.params[Number(n) - 1] ?? `{{${n}}}`);
  return sendTemplateLogged(input.clinicId, input.to, { name: input.name, language: input.language, bodyParams: input.params }, preview, input.phoneNumberId);
}

/** Últimos envios de teste com o status atualizado pelo webhook. */
export async function listCloudTestMessages(clinicId: string) {
  await requireAdminSession();
  const rows = await prisma.cloudTestMessage.findMany({ where: { clinicId }, orderBy: { createdAt: "desc" }, take: 20 });
  return rows.map((r) => ({
    id: r.id,
    to: r.to,
    kind: r.kind,
    body: r.body,
    templateName: r.templateName,
    status: r.status,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export type TemplateRow = CloudTemplate & { bodyText: string; variableCount: number };

/** Modelos da WABA (nome, categoria, idioma, status) com o texto do corpo. */
export async function listClinicCloudTemplates(clinicId: string): Promise<{ success: true; templates: TemplateRow[] } | { success: false; error: string }> {
  await requireAdminSession();
  const account = await accountFor(clinicId);
  if (!account) return { success: false, error: "Clínica sem conta da API oficial." };
  const r = await listCloudTemplates(account.wabaId, account.token);
  if (!r.success) return { success: false, error: r.error };
  return {
    success: true,
    templates: r.data.data.map((t) => {
      const body = (t as CloudTemplate & { components?: { type: string; text?: string }[] }).components?.find((c) => c.type === "BODY")?.text ?? "";
      return { ...t, bodyText: body, variableCount: new Set(body.match(/\{\{\d+\}\}/g) ?? []).size };
    }),
  };
}

/** Cria modelo (vai pra análise da Meta; o status volta pelo webhook e pelo "Atualizar"). */
export async function createClinicCloudTemplate(input: {
  clinicId: string;
  name: string;
  category: "UTILITY" | "MARKETING";
  language: string;
  body: string;
  examples: string[];
}) {
  await requireAdminSession();
  const account = await accountFor(input.clinicId);
  if (!account) return { success: false as const, error: "Clínica sem conta da API oficial." };
  const name = input.name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "");
  if (!name) return { success: false as const, error: "Dê um nome ao modelo (letras minúsculas, números e _)." };
  const vars = new Set(input.body.match(/\{\{\d+\}\}/g) ?? []).size;
  if (vars > 0 && input.examples.filter((e) => e.trim()).length < vars) {
    return { success: false as const, error: `Preencha um exemplo para cada variável ({{1}} até {{${vars}}}).` };
  }
  const r = await createCloudTemplate(account.wabaId, account.token, {
    name,
    category: input.category,
    language: input.language,
    body: input.body,
    example: vars ? input.examples.slice(0, vars) : undefined,
  });
  return r.success ? { success: true as const, id: r.data.id, status: r.data.status, name } : { success: false as const, error: r.error };
}
