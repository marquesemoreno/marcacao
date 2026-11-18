import "server-only";
import type { Prisma } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { phoneVariants } from "@/lib/lgpd";
import { storageBackupConfig } from "@/lib/storage-backup";
import { WHATSAPP_MEDIA_BUCKET } from "@/lib/supabase-server";

/** Exclusão a pedido do titular (LGPD art. 18) — o que fica FORA de mensagens e cadastro.
 * Auditoria de segurança 16/11/2026 (M8): a exclusão não alcançava Tarefas, inscrições de
 * automação, ficha prévia, senhas, NPS, lista de espera, campanhas, nem o backup das mídias.
 *
 * Três tratamentos:
 * - apaga o que é só do paciente (ficha, aceite do termo, links, NPS, senha, lista de espera,
 *   tarefas e pedidos ligados à conversa);
 * - tira o telefone do que alimenta relatório da clínica (marcação da agenda, lembrete
 *   enviado, vaga oferecida, destinatário de campanha): o número agregado continua, o dado
 *   pessoal sai;
 * - mantém quem pediu para SAIR do SMS (lista de bloqueio), senão o número voltaria a
 *   receber numa próxima importação.
 * Agendamentos não entram aqui: registro clínico tem guarda obrigatória. */
export type PatientDeletionTarget = { clinicId: string; conversationId: string; contactId: string; phone: string | null };

export async function deletePatientRelatedData(tx: Prisma.TransactionClient, t: PatientDeletionTarget) {
  const phones = phoneVariants(t.phone);
  const byConversation = { conversationId: t.conversationId };

  const tasks = await tx.receptionTask.deleteMany({ where: { clinicId: t.clinicId, conversationId: t.conversationId } });
  const enrollments = await tx.tagAutomationEnrollment.deleteMany({ where: byConversation });
  await tx.conversationStageChange.deleteMany({ where: byConversation });
  const bookingRequests = await tx.bookingRequest.deleteMany({ where: byConversation });
  await tx.adClick.deleteMany({ where: byConversation });

  // Ficha, aceite do termo e links guardam telefone E contato: casa por qualquer um.
  const byPhoneOrContact = {
    clinicId: t.clinicId,
    OR: [...(phones.length ? [{ phone: { in: phones } }] : []), { contactId: t.contactId }],
  };
  const forms = await tx.patientFormResponse.deleteMany({ where: byPhoneOrContact });
  await tx.consentAcceptance.deleteMany({ where: byPhoneOrContact });
  await tx.patientToken.deleteMany({ where: byPhoneOrContact });

  let nps = 0;
  let tickets = 0;
  let waitlist = 0;
  if (phones.length) {
    const byPhone = { clinicId: t.clinicId, phone: { in: phones } };
    nps = (await tx.npsResponse.deleteMany({ where: byPhone })).count;
    tickets = (await tx.queueTicket.deleteMany({ where: byPhone })).count;
    waitlist = (await tx.waitlistEntry.deleteMany({ where: byPhone })).count;
    await tx.channelConsent.deleteMany({ where: { clinicId: t.clinicId, channel: "SMS", address: { in: phones }, revokedAt: null } });

    // Ligações (missed-call.ts) entram aqui também: a contagem fica, o número sai.
    for (const model of [tx.agendaMark, tx.bridgeReminderLog, tx.slotOffer, tx.phoneCall] as const) {
      await (model as typeof tx.agendaMark).updateMany({ where: byPhone, data: { phone: null } });
    }

    const recipients = { phone: { in: phones }, campaign: { clinicId: t.clinicId } };
    await tx.broadcastRecipient.updateMany({
      where: { ...recipients, status: "PENDING" },
      data: { status: "SKIPPED_OPT_OUT", errorMessage: "Dados excluídos a pedido do titular" },
    });
    await tx.broadcastRecipient.updateMany({ where: recipients, data: { phone: `excluido-${t.conversationId}`, variables: {} } });
  }

  return {
    tasks: tasks.count,
    automationEnrollments: enrollments.count,
    bookingRequests: bookingRequests.count,
    formResponses: forms.count,
    npsResponses: nps,
    queueTickets: tickets,
    waitlistEntries: waitlist,
  };
}

const PAGE = 1000;
const MAX_PAGES = 50;

/** Apaga TODAS as mídias da conversa no Storage (pasta = id da conversa), página a página —
 * antes só os primeiros 1000 arquivos saíam. Devolve quantos foram apagados. */
export async function removeConversationMedia(supabase: SupabaseClient, conversationId: string): Promise<number> {
  const bucket = supabase.storage.from(WHATSAPP_MEDIA_BUCKET);
  let removed = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data: files } = await bucket.list(conversationId, { limit: PAGE });
    if (!files?.length) break;
    const { error } = await bucket.remove(files.map((f) => `${conversationId}/${f.name}`));
    if (error) break; // sem isto a mesma página voltaria para sempre
    removed += files.length;
  }
  return removed;
}

/** Apaga as cópias das mídias da conversa no bucket de backup (BACKUP_S3_*, chave
 * "<bucket>/<conversa>/<arquivo>" — ver cron storage-backup). `null` = backup não
 * configurado. Em bucket com versões (Backblaze B2), a versão antiga só some de vez com a
 * regra de ciclo de vida "manter só a última versão" ligada no painel do provedor. */
export async function removeConversationBackup(conversationId: string): Promise<number | null> {
  const config = storageBackupConfig(process.env);
  if (!config) return null;
  const s3 = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: true,
  });
  const Prefix = `${WHATSAPP_MEDIA_BUCKET}/${conversationId}/`;
  let removed = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix, MaxKeys: PAGE }));
    const keys = (page.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k);
    if (!keys.length) break;
    const out = await s3.send(new DeleteObjectsCommand({ Bucket: config.bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }));
    if (out.Errors?.length) break;
    removed += keys.length;
  }
  return removed;
}
