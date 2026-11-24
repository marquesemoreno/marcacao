/** Clínica de DEMONSTRAÇÃO (vídeos de apresentação — docs/roteiro-videos.md) — só dados fictícios.
 * - Telefones 5500900000xx (DDD 00 não existe → nunca é um paciente real).
 * - WhatsApp "falso": instância apontando pra demo.invalid → nenhum envio sai de verdade.
 * - Sem integração de ponte: Faturamento/Financeiro/Estoque usam o modo demo
 *   (src/lib/bi/demo-bridge.ts, números fictícios). Régua criada DESLIGADA; campanha já CONCLUÍDA.
 * - Automações (Disparos › Configurar) aparecem LIGADAS, mas o executor pula a clínica demo:
 *   nada roda nem é enviado. Tarefas e convênios aceitos são só exemplos para os vídeos.
 * Idempotente: apaga TUDO da clínica demo (CNPJ fixo) e recria. Datas relativas a hoje —
 * rode na manhã da gravação.
 *
 * Uso: npx tsx --conditions=react-server scripts/seed-demo-clinic.ts
 * Senha do login: env DEMO_PASSWORD; se faltar, gera uma e grava no .env local. */
import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { appendFileSync, readFileSync } from "fs";
import { join } from "path";
import { DEMO_CLINIC_CNPJ } from "../src/lib/demo-clinic";
import { DEFAULT_ANAMNESE_TEMPLATE } from "../src/lib/patient-journey";
import { DEFAULT_RULE_STEPS } from "../src/lib/automation-rules";
import { WRONG_NUMBER_TAG } from "../src/lib/conversation-tags";
import { hashPatientToken } from "../src/lib/patient-token";
import { encryptToken } from "../src/lib/token-crypto";
import { seriesFor, ticketCode } from "../src/lib/queue-ticket";
import { doctorKey } from "../src/lib/tv-call";
import { DEMO_CLOUD_TEMPLATES } from "../src/lib/demo-regua";
import { NO_CONSENT_MESSAGE } from "../src/lib/marketing-consent";
import type { StoredStep } from "../src/lib/tag-automations";
import { formatDuration, uploadWhatsAppMedia } from "../src/lib/whatsapp-media";
import { getSupabaseServerClient, WHATSAPP_MEDIA_BUCKET } from "../src/lib/supabase-server";
import { formatFileSize } from "../src/lib/format";
import { queueReturnNote } from "../src/lib/queue-return";

const prisma = new PrismaClient();
const CNPJ = DEMO_CLINIC_CNPJ;
const MANAGER_EMAIL = "demo@clinicavida.demo";
const DOMAIN = "clinicavida.demo";

const now = new Date();
const minutes = (n: number) => n * 60_000;
const daysAgo = (d: number, hour = 10, minute = 0) => {
  const x = new Date(now);
  x.setDate(x.getDate() - d);
  x.setHours(hour, minute, 0, 0);
  return x;
};
/** Data (coluna @db.Date) de hoje + n dias. */
const dateOf = (n: number) => new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + n));
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const phone = (i: number) => `5500900000${String(i).padStart(2, "0")}`;
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const first = (name: string) => name.split(" ")[0];
const enc = (o: Record<string, string>) => encryptToken(JSON.stringify(o));
const fakeHash = () => hashPatientToken(randomBytes(24).toString("base64url"));

const PATIENTS = [
  "Mariana Alves", "João Pereira", "Fernanda Costa", "Ricardo Gomes", "Patrícia Rocha", "Lucas Martins",
  "Camila Ribeiro", "André Carvalho", "Juliana Freitas", "Paulo Nogueira", "Beatriz Lopes", "Gustavo Teixeira",
  "Larissa Barbosa", "Rafael Duarte", "Aline Moreira", "Thiago Araújo", "Vanessa Cardoso", "Eduardo Pinto",
  "Renata Melo", "Felipe Castro", "Sabrina Dias", "Marcelo Fernandes", "Tatiane Lima", "Rodrigo Santana",
  "Débora Campos", "Leonardo Vieira", "Priscila Monteiro", "Diego Correia", "Simone Batista", "Fábio Azevedo",
  "Helena Prado", "Otávio Brandão", "Carolina Peixoto", "Márcio Queiroz", "Isabela Rangel", "Vinícius Tavares",
  "Natália Farias", "Sérgio Moura", "Lívia Cunha", "Caio Fonseca", "Elaine Barros", "Gabriel Lacerda",
];
const DOCTORS = ["Dra. Lívia Andrade", "Dr. Henrique Matos", "Dra. Paula Siqueira"];
const ROOMS = ["Consultório 1", "Consultório 2", "Consultório 3"];
const CHANNELS = ["Instagram Ads", "Google", "Indicação", "Site", null];
const CONVENIOS = ["Unimed", "Bradesco Saúde", "Particular", "Cassi"];

type Script = {
  reason: string | null;
  stage: "NOVOS" | "TRIAGEM" | "ORCAMENTO" | "AGENDADO";
  value?: number;
  tags?: string[];
  msgs: [("in" | "out"), string][];
  sentiment: "POSITIVO" | "NEUTRO" | "NEGATIVO";
};

const SCRIPTS: Script[] = [
  { reason: "AGENDAMENTO_CONCLUIDO", stage: "AGENDADO", value: 280, sentiment: "POSITIVO", msgs: [["in", "Oi, gostaria de marcar uma consulta com dermatologista"], ["out", "Olá! Temos horário quinta às 14h ou sexta às 9h com a Dra. Lívia. Qual prefere?"], ["in", "Quinta às 14h, por favor"], ["out", "Agendado! Quinta às 14h com a Dra. Lívia. Chegue 15 min antes com documento e carteirinha."], ["in", "Perfeito, obrigada!"]] },
  { reason: "AGENDAMENTO_CONCLUIDO", stage: "AGENDADO", value: 350, sentiment: "POSITIVO", msgs: [["in", "Vocês fazem ultrassom de abdome?"], ["out", "Fazemos sim! O valor particular é R$ 350 e atendemos Unimed e Bradesco. Quer agendar?"], ["in", "Quero, tenho Unimed"], ["out", "Ótimo, agendado para segunda às 8h30. Precisa de jejum de 8 horas."], ["in", "Combinado"]] },
  { reason: "DUVIDA_ESCLARECIDA", stage: "TRIAGEM", sentiment: "NEUTRO", msgs: [["in", "Qual o horário de funcionamento de vocês?"], ["out", "Atendemos de segunda a sexta das 7h às 19h e sábado das 7h às 12h."], ["in", "Obrigado"]] },
  { reason: "PERDA_PRECO", stage: "ORCAMENTO", value: 900, sentiment: "NEUTRO", msgs: [["in", "Quanto custa a cirurgia de vasectomia?"], ["out", "O pacote particular fica em R$ 900, incluindo consulta e retorno."], ["in", "Achei caro, vou pesquisar mais"]] },
  { reason: "PERDA_CONVENIO", stage: "TRIAGEM", sentiment: "NEUTRO", msgs: [["in", "Aceitam SulAmérica?"], ["out", "No momento não atendemos SulAmérica, só particular, Unimed e Bradesco."], ["in", "Ah, que pena"]] },
  { reason: "AGENDAMENTO_CONCLUIDO", stage: "AGENDADO", value: 250, sentiment: "POSITIVO", msgs: [["in", "Preciso de um retorno com o Dr. Henrique"], ["out", "Claro! Tenho terça às 10h. Pode ser?"], ["in", "Pode sim"], ["out", "Retorno confirmado terça às 10h com o Dr. Henrique."]] },
  { reason: "INATIVIDADE", stage: "NOVOS", sentiment: "NEUTRO", msgs: [["in", "Boa tarde"], ["out", "Boa tarde! Como posso ajudar?"]] },
  { reason: "PERDA_HORARIO", stage: "ORCAMENTO", value: 280, sentiment: "NEUTRO", msgs: [["in", "Tem horário com ginecologista no sábado?"], ["out", "No sábado a agenda da Dra. Paula está completa este mês. Tenho quarta à noite."], ["in", "Só consigo sábado, obrigada"]] },
  { reason: "AGENDAMENTO_CONCLUIDO", stage: "AGENDADO", value: 180, sentiment: "POSITIVO", msgs: [["in", "Quero fazer um check-up, o que vocês sugerem?"], ["out", "Temos o pacote check-up com consulta clínica + exames de sangue por R$ 180. Agendo para você?"], ["in", "Sim! Segunda de manhã"], ["out", "Agendado segunda às 7h30, jejum de 12 horas."]] },
  { reason: "DUVIDA_ESCLARECIDA", stage: "TRIAGEM", sentiment: "POSITIVO", msgs: [["in", "O resultado do meu exame já saiu?"], ["out", "Já está disponível! Enviamos o link de acesso para o seu e-mail cadastrado."], ["in", "Recebi, muito obrigado"]] },
];

const MARCADORES = [
  { name: "Lene — Central de Marcação", code: "lene", phone: "550090000090" },
  { name: "Mais Saúde Marcações", code: "maissaude", phone: "550090000091" },
  { name: "Dona Cida (Bairro Brasil)", code: "cida", phone: "550090000092" },
  { name: "Ponto Certo Agendamentos", code: "pontocerto", phone: "550090000093" },
];

/** Apaga tudo da clínica demo: tabelas com clinicId, conversationId, campaignId ou userId (dos
 * usuários demo). Tenta em várias passadas porque a ordem das chaves estrangeiras varia. */
async function wipeDemo(clinicId: string) {
  const ids = {
    conversationId: (await prisma.conversation.findMany({ where: { clinicId }, select: { id: true } })).map((c) => c.id),
    campaignId: (await prisma.broadcastCampaign.findMany({ where: { clinicId }, select: { id: true } })).map((c) => c.id),
    userId: (await prisma.user.findMany({ where: { clinicId }, select: { id: true } })).map((u) => u.id),
    templateId: (await prisma.formTemplate.findMany({ where: { clinicId }, select: { id: true } })).map((t) => t.id),
  };
  // Áudios e PDFs da demo (rodada anterior e os enviados na gravação) saem também do Storage.
  const media = await prisma.message.findMany({ where: { conversationId: { in: ids.conversationId }, mediaPath: { not: null } }, select: { mediaPath: true } });
  const storage = getSupabaseServerClient();
  if (storage && media.length) await storage.storage.from(WHATSAPP_MEDIA_BUCKET).remove(media.map((m) => m.mediaPath!));
  const models = Prisma.dmmf.datamodel.models.filter((m) => !["Clinic", "User", "Contact", "Procedure"].includes(m.name));
  const client = prisma as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>;
  for (let pass = 0; pass < 6; pass++) {
    let failed = 0;
    for (const m of models) {
      const key = m.name[0].toLowerCase() + m.name.slice(1);
      const fields = m.fields.map((f) => f.name);
      const where: Record<string, unknown>[] = [];
      if (fields.includes("clinicId")) where.push({ clinicId });
      for (const [field, list] of Object.entries(ids)) if (fields.includes(field) && list.length) where.push({ [field]: { in: list } });
      if (m.name === "Appointment") where.push({ clinicProcedure: { clinicId } });
      if (!where.length) continue;
      try {
        await client[key].deleteMany({ where: { OR: where } });
      } catch {
        failed++;
      }
    }
    if (!failed) break;
  }
  await prisma.user.deleteMany({ where: { clinicId } });
  await prisma.clinic.delete({ where: { id: clinicId } });
}

async function main() {
  const password = process.env.DEMO_PASSWORD || randomBytes(9).toString("base64url");
  if (!process.env.DEMO_PASSWORD) appendFileSync(".env", `\nDEMO_PASSWORD="${password}"\n`);

  const old = await prisma.clinic.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
  if (old) await wipeDemo(old.id);
  await prisma.contact.deleteMany({ where: { OR: [{ phone: { startsWith: "5500900000" } }, { externalId: { startsWith: "demo-ig-" } }] } });

  const clinic = await prisma.clinic.create({
    data: {
      name: "Clínica Vida Demonstração Ltda",
      tradeName: "Clínica Vida (demo)",
      cnpj: CNPJ,
      whatsapp: "550090000099",
      address: "Av. Exemplo, 100",
      neighborhood: "Centro",
      city: "Vitória da Conquista",
      commissionRate: 0,
      listedInMarketplace: false,
      defaultTicket: 250,
      urgencyTagEnabled: true,
      // Volta à fila ligada (tela Esperando, vídeo 1). O robô pula a demo: nada muda sozinho.
      unansweredReturnMinutes: 30,
      technicalDirectorName: "Dra. Lívia Andrade",
      technicalDirectorCrm: "CRM 000000 (demo)",
    },
  });
  await prisma.whatsappInstance.create({
    data: { clinicId: clinic.id, apiUrl: "https://demo.invalid", apiKey: "demo", instanceName: `DEMO-${clinic.id}`, status: "CONNECTED" },
  });

  const hash = await bcrypt.hash(password, 10);
  const manager = await prisma.user.create({ data: { name: "Gestão Demo", email: MANAGER_EMAIL, passwordHash: hash, role: "CLINIC", clinicId: clinic.id, isAttendant: false, isManager: true, clinicRole: "GESTAO" } });
  // Login de médico (vídeo 3): vê a ficha prévia só dos pacientes dele de hoje e chama na TV.
  await prisma.user.create({ data: { name: DOCTORS[0], email: `livia@${DOMAIN}`, passwordHash: hash, role: "CLINIC", clinicId: clinic.id, isAttendant: false, clinicRole: "MEDICO", doctorName: DOCTORS[0] } });
  const attendants = await Promise.all(
    ["Ana Souza", "Bruno Lima", "Carla Mendes"].map((name) =>
      prisma.user.create({
        data: { name, email: `${name.split(" ")[0].toLowerCase()}@${DOMAIN}`, passwordHash: hash, role: "CLINIC", clinicId: clinic.id, isAttendant: true },
      })
    )
  );

  const procs = await Promise.all(
    [
      { name: "Consulta dermatológica", category: "CONSULTATION", price: 280 },
      { name: "Ultrassom de abdome total", category: "EXAM", price: 350 },
      { name: "Retorno de consulta", category: "CONSULTATION", price: 0 },
      { name: "Check-up clínico", category: "EXAM", price: 180 },
      { name: "Consulta ginecológica", category: "CONSULTATION", price: 280 },
    ].map(async (p) => {
      const procedure = await prisma.procedure.upsert({ where: { name: p.name }, update: {}, create: { name: p.name, category: p.category as Prisma.ProcedureCreateInput["category"] } });
      return prisma.clinicProcedure.create({ data: { clinicId: clinic.id, procedureId: procedure.id, price: p.price } });
    })
  );

  // Pacientes: todos com ficha nesta clínica; ~2/3 aceitaram marketing; um menor com responsável;
  // um faz aniversário hoje (prévia da régua de aniversário).
  const contacts = [];
  for (const [i, name] of PATIENTS.entries()) {
    const contact = await prisma.contact.create({ data: { name, phone: phone(i), convenio: pick(CONVENIOS, i) } });
    const minor = i === 7;
    const birth = i === 4 ? new Date(Date.UTC(1988, now.getMonth(), now.getDate())) : new Date(Date.UTC(minor ? 2014 : 1960 + ((i * 7) % 40), (i * 5) % 12, 1 + ((i * 3) % 27)));
    await prisma.contactClinicProfile.create({
      data: {
        contactId: contact.id,
        clinicId: clinic.id,
        convenio: pick(CONVENIOS, i),
        birthDate: birth,
        preferredDoctor: pick(DOCTORS, i),
        marketingConsentAt: i % 3 !== 2 ? daysAgo(40 - (i % 30)) : null,
        marketingConsentSource: i % 3 !== 2 ? pick(["QUERO RECEBER pelo WhatsApp", "Ficha prévia"], i) : null,
        ...(minor ? { guardianName: "Cláudia Carvalho", guardianRelationship: "Mãe", guardianPhone: "550090000089" } : {}),
      },
    });
    contacts.push(contact);
  }

  // Marcadores (parceiros que indicam pacientes).
  const marcadores = await Promise.all(MARCADORES.map((m) => prisma.marcador.create({ data: { clinicId: clinic.id, ...m } })));

  // Conversas dos últimos 30 dias (resolvidas). Parte veio pelo link de um marcador.
  const resolved: { id: string; contactIdx: number; start: Date; reason: string | null; marcador: boolean }[] = [];
  for (let i = 0; i < 26; i++) {
    const s = pick(SCRIPTS, i);
    const start = daysAgo(1 + (i % 28), 8 + (i % 9), (i * 7) % 60);
    const attendant = pick(attendants, i);
    const replyDelay = pick([3, 6, 9, 14, 22, 5, 11], i);
    const marcador = i % 3 === 0 ? pick(marcadores, i / 3) : null;
    let t = start.getTime();
    const conv = await prisma.conversation.create({
      data: {
        clinicId: clinic.id,
        contactId: contacts[i].id,
        status: "RESOLVED",
        funnelStage: s.stage,
        estimatedValue: s.value ?? null,
        resolutionReason: s.reason,
        resolvedAt: new Date(start.getTime() + minutes(60)),
        resolvedByUserId: attendant.id,
        assignedUserId: attendant.id,
        acquisitionChannel: marcador ? "Marcador" : pick(CHANNELS, i),
        marcadorId: marcador?.id ?? null,
        marcadorAt: marcador ? start : null,
        createdAt: start,
        lastMessageAt: new Date(start.getTime() + minutes(40)),
      },
    });
    for (const [k, [dir, text]] of s.msgs.entries()) {
      t += k === 1 ? minutes(replyDelay) : minutes(2);
      const content = k === 0 && marcador ? `${text} #m-${marcador.code}` : text;
      await prisma.message.create({
        data: { conversationId: conv.id, direction: dir === "in" ? "INBOUND" : "OUTBOUND", content, status: "READ", senderUserId: dir === "out" ? attendant.id : null, createdAt: new Date(t) },
      });
    }
    await prisma.conversationQualityAudit.create({
      data: { conversationId: conv.id, sentiment: s.sentiment, firstResponseSec: replyDelay * 60, resolutionSec: 3600 },
    });
    resolved.push({ id: conv.id, contactIdx: i, start, reason: s.reason, marcador: !!marcador });
  }
  // Conversas do próprio marcador (ele marcando direto pelo WhatsApp).
  for (const [k, m] of marcadores.slice(0, 2).entries()) {
    const c = await prisma.contact.create({ data: { name: m.name, phone: m.phone } });
    const start = daysAgo(2 + k * 5, 9);
    const conv = await prisma.conversation.create({
      data: { clinicId: clinic.id, contactId: c.id, status: "RESOLVED", funnelStage: "AGENDADO", resolutionReason: "AGENDAMENTO_CONCLUIDO", resolvedAt: new Date(start.getTime() + minutes(30)), createdAt: start, lastMessageAt: start },
    });
    await prisma.message.create({ data: { conversationId: conv.id, direction: "INBOUND", content: "Bom dia! Tenho mais duas pacientes para ultrassom na quinta, tem vaga?", status: "READ", createdAt: start } });
  }

  // Conversas abertas agora (Chat).
  const tomorrow = dateOf(1);
  const openCases: { tags?: string[]; stage: Script["stage"]; msgs: [("in" | "out"), string][]; assigned?: number; minsAgo: number; value?: number; patient: number }[] = [
    { tags: ["🚨 Urgência Clínica"], stage: "TRIAGEM", minsAgo: 4, patient: 26, msgs: [["in", "Fiz a cirurgia ontem e estou com sangramento, é normal?"]] },
    { stage: "NOVOS", minsAgo: 12, patient: 27, msgs: [["in", "Olá, vocês atendem criança? Meu filho de 6 anos precisa de pediatra"]] },
    { stage: "TRIAGEM", minsAgo: 25, assigned: 0, patient: 28, msgs: [["in", "Gostaria de saber o valor da consulta com dermatologista"], ["out", "Olá! A consulta particular é R$ 280. Atendemos também Unimed e Bradesco."], ["in", "Tenho Bradesco, tem horário essa semana?"]] },
    { tags: ["⚠️ Remarcação Pendente"], stage: "AGENDADO", minsAgo: 70, assigned: 2, patient: 29, msgs: [["out", `Olá, ${first(PATIENTS[29])}! Lembrete da sua consulta amanhã, ${ddmm(tomorrow)}, às 09:00 com Dra. Paula Siqueira na Clínica Vida. Responda CONFIRMO para confirmar ou REMARCAR para escolher outro horário.`], ["in", "Preciso remarcar, não vou conseguir ir amanhã"]] },
    { tags: [WRONG_NUMBER_TAG], stage: "NOVOS", minsAgo: 80, patient: 30, msgs: [["out", `Olá, ${first(PATIENTS[30])}! Lembrete da sua consulta amanhã, ${ddmm(tomorrow)}, às 10:30 com Dr. Henrique Matos na Clínica Vida. Responda CONFIRMO para confirmar ou REMARCAR para escolher outro horário.`], ["in", "Número errado, não conheço essa pessoa"]] },
    { stage: "NOVOS", minsAgo: 95, patient: 31, msgs: [["in", "Vi o anúncio no Instagram do check-up, como funciona?"]] },
  ];
  for (const [i, c] of openCases.entries()) {
    let t = now.getTime() - minutes(c.minsAgo + c.msgs.length * 2);
    const conv = await prisma.conversation.create({
      data: {
        clinicId: clinic.id,
        contactId: contacts[c.patient].id,
        status: "OPEN",
        funnelStage: c.stage,
        tags: c.tags ?? [],
        estimatedValue: c.value ?? null,
        assignedUserId: c.assigned !== undefined ? attendants[c.assigned].id : null,
        acquisitionChannel: pick(CHANNELS, i + 1),
        createdAt: new Date(t),
        lastMessageAt: new Date(now.getTime() - minutes(c.minsAgo)),
      },
    });
    for (const [dir, text] of c.msgs) {
      t += minutes(2);
      await prisma.message.create({
        data: { conversationId: conv.id, direction: dir === "in" ? "INBOUND" : "OUTBOUND", content: text, status: dir === "in" ? "DELIVERED" : "READ", senderUserId: dir === "out" && c.assigned !== undefined ? attendants[c.assigned].id : null, createdAt: new Date(Math.min(t, now.getTime() - minutes(c.minsAgo))) },
      });
    }
  }
  // Lembrete confirmado pelo paciente (o sistema confirmou sozinho).
  {
    const p = 32;
    const sent = new Date(now.getTime() - minutes(150));
    const conv = await prisma.conversation.create({
      data: { clinicId: clinic.id, contactId: contacts[p].id, status: "RESOLVED", funnelStage: "AGENDADO", resolutionReason: "CONFIRMACAO_AGENDA", resolvedAt: new Date(sent.getTime() + minutes(20)), createdAt: sent, lastMessageAt: new Date(sent.getTime() + minutes(19)) },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: conv.id, direction: "OUTBOUND", content: `Olá, ${first(PATIENTS[p])}! Lembrete da sua consulta amanhã, ${ddmm(tomorrow)}, às 08:00 com Dra. Lívia Andrade na Clínica Vida. Responda CONFIRMO para confirmar ou REMARCAR para escolher outro horário.`, status: "READ", createdAt: sent },
        { conversationId: conv.id, direction: "INBOUND", content: "Confirmo! Obrigada 😊", status: "READ", createdAt: new Date(sent.getTime() + minutes(18)) },
        { conversationId: conv.id, direction: "OUTBOUND", content: "Consulta confirmada! Até amanhã. 💚", status: "READ", createdAt: new Date(sent.getTime() + minutes(19)) },
      ],
    });
  }
  // Instagram Direct (só visual: a demo não tem conta do Instagram ligada).
  {
    const c = await prisma.contact.create({ data: { name: "Carol Peixoto", channel: "INSTAGRAM", externalId: "demo-ig-1", instagramUsername: "carol.peixoto.demo" } });
    const at = new Date(now.getTime() - minutes(18));
    const conv = await prisma.conversation.create({
      data: { clinicId: clinic.id, contactId: c.id, channel: "INSTAGRAM", status: "OPEN", funnelStage: "NOVOS", acquisitionChannel: "Instagram", createdAt: at, lastMessageAt: at },
    });
    await prisma.message.create({ data: { conversationId: conv.id, direction: "INBOUND", content: "Oi! Vi o post do check-up. Vocês atendem Unimed?", status: "DELIVERED", createdAt: at } });
  }
  // Áudio + pedido de exame em PDF recebidos (vídeo 1, cena 6). Arquivos fictícios em
  // scripts/demo-assets (voz sintética, documento marcado "fictício"), no Storage da conversa.
  {
    const p = 36;
    const at = new Date(now.getTime() - minutes(8));
    const conv = await prisma.conversation.create({
      data: { clinicId: clinic.id, contactId: contacts[p].id, status: "OPEN", funnelStage: "NOVOS", acquisitionChannel: "Google", createdAt: at, lastMessageAt: new Date(at.getTime() + minutes(1)) },
    });
    const file = (name: string, mimeType: string) => {
      const buffer = readFileSync(join(process.cwd(), "scripts", "demo-assets", name));
      return { buffer, mimeType };
    };
    const audio = file("audio-paciente.ogg", "audio/ogg; codecs=opus");
    const pdf = file("pedido-exame.pdf", "application/pdf");
    const audioUp = await uploadWhatsAppMedia(conv.id, audio.buffer, audio.mimeType);
    const pdfUp = await uploadWhatsAppMedia(conv.id, pdf.buffer, pdf.mimeType);
    if (!audioUp || !pdfUp) console.warn("⚠️ Áudio/PDF da demo não subiram para o Storage (falta SUPABASE_SERVICE_ROLE_KEY no .env?).");
    await prisma.message.create({
      data: { conversationId: conv.id, direction: "INBOUND", type: "AUDIO", content: "", status: "DELIVERED", mediaPath: audioUp?.path ?? null, mimeType: audio.mimeType, audioDuration: formatDuration(19), createdAt: at },
    });
    await prisma.message.create({
      data: { conversationId: conv.id, direction: "INBOUND", type: "ATTACHMENT", content: "", status: "DELIVERED", mediaPath: pdfUp?.path ?? null, mimeType: pdf.mimeType, attachmentName: "pedido-ultrassom.pdf", attachmentSize: formatFileSize(pdf.buffer.byteLength), createdAt: new Date(at.getTime() + minutes(1)) },
    });
  }
  // Conversa que voltou para a fila: o Bruno não respondeu a tempo (tela Esperando, vídeo 1).
  {
    const p = 38;
    const asked = new Date(now.getTime() - minutes(42));
    const conv = await prisma.conversation.create({
      data: { clinicId: clinic.id, contactId: contacts[p].id, status: "OPEN", funnelStage: "TRIAGEM", acquisitionChannel: "Indicação", createdAt: new Date(asked.getTime() - minutes(20)), lastMessageAt: new Date(asked.getTime() + minutes(31)) },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: conv.id, direction: "INBOUND", content: "Bom dia! Fiz exame de sangue aí semana passada", status: "READ", createdAt: new Date(asked.getTime() - minutes(20)) },
        { conversationId: conv.id, direction: "OUTBOUND", content: "Bom dia! Vou verificar para você, um instante.", status: "READ", senderUserId: attendants[1].id, createdAt: new Date(asked.getTime() - minutes(18)) },
        { conversationId: conv.id, direction: "INBOUND", content: "O resultado já saiu? Preciso levar na consulta amanhã", status: "DELIVERED", createdAt: asked },
        { conversationId: conv.id, direction: "OUTBOUND", type: "INTERNAL_NOTE", content: queueReturnNote(attendants[1].name, 31), status: "SENT", createdAt: new Date(asked.getTime() + minutes(31)) },
      ],
    });
  }
  // Orçamentos esperando retorno (fila de cobrança 3/7/15 dias).
  for (const [k, d] of [3, 8, 16].entries()) {
    const p = 33 + k;
    const at = daysAgo(d, 11);
    const value = [900, 1450, 620][k];
    const conv = await prisma.conversation.create({
      data: { clinicId: clinic.id, contactId: contacts[p].id, status: "PENDING", funnelStage: "ORCAMENTO", estimatedValue: value, assignedUserId: pick(attendants, k).id, acquisitionChannel: pick(CHANNELS, k), createdAt: at, lastMessageAt: new Date(at.getTime() + minutes(6)) },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: conv.id, direction: "INBOUND", content: pick(["Qual o valor da vasectomia?", "Quanto fica a cirurgia de catarata particular?", "Me passa o orçamento do pacote de exames?"], k), status: "READ", createdAt: at },
        { conversationId: conv.id, direction: "OUTBOUND", content: `O valor fica em R$ ${value.toLocaleString("pt-BR")}, com consulta e retorno incluídos. Posso reservar um horário?`, status: "READ", senderUserId: pick(attendants, k).id, createdAt: new Date(at.getTime() + minutes(5)) },
        { conversationId: conv.id, direction: "INBOUND", content: "Vou ver e te falo", status: "READ", createdAt: new Date(at.getTime() + minutes(6)) },
      ],
    });
    await prisma.conversationStageChange.create({ data: { conversationId: conv.id, fromStage: "TRIAGEM", toStage: "ORCAMENTO", userId: pick(attendants, k).id, createdAt: new Date(at.getTime() + minutes(5)) } });
  }

  // ---------- Agenda ----------
  const today = dateOf(0);
  // Hoje: todos os estados, com horários em volta de AGORA (rodar a qualquer hora do dia dá uma
  // agenda coerente: atendidos antes, chegou/em atendimento perto de agora, confirmados depois).
  const slotBase = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
  const at = (off: number) => {
    const m = Math.min(Math.max(slotBase + off, 6 * 60), 22 * 60);
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  const TODAY: { time: string; p: number; doc: number; proc: number; status: "PENDING" | "CONFIRMED"; reminder: string | null; mark?: string; arrivedMinAgo?: number; ficha?: boolean }[] = [
    { time: at(-180), p: 0, doc: 0, proc: 0, status: "CONFIRMED", reminder: "CONFIRMED", mark: "COMPLETED", ficha: true },
    { time: at(-150), p: 1, doc: 1, proc: 1, status: "CONFIRMED", reminder: "CONFIRMED", mark: "COMPLETED" },
    { time: at(-120), p: 2, doc: 2, proc: 4, status: "CONFIRMED", reminder: "SENT", mark: "NO_SHOW" },
    { time: at(-30), p: 3, doc: 0, proc: 0, status: "CONFIRMED", reminder: "CONFIRMED", mark: "IN_ROOM", arrivedMinAgo: 35, ficha: true },
    { time: at(0), p: 4, doc: 1, proc: 3, status: "CONFIRMED", reminder: "CONFIRMED", mark: "IN_SERVICE", arrivedMinAgo: 22, ficha: true },
    { time: at(30), p: 5, doc: 2, proc: 4, status: "CONFIRMED", reminder: "CONFIRMED", mark: "IN_SERVICE", arrivedMinAgo: 9, ficha: true },
    { time: at(60), p: 6, doc: 0, proc: 2, status: "CONFIRMED", reminder: "CONFIRMED" },
    { time: at(90), p: 7, doc: 1, proc: 0, status: "CONFIRMED", reminder: "CONFIRMED", ficha: true },
    { time: at(120), p: 8, doc: 2, proc: 4, status: "PENDING", reminder: "SENT" },
    { time: at(150), p: 9, doc: 0, proc: 1, status: "CONFIRMED", reminder: "CONFIRMED" },
    { time: at(180), p: 10, doc: 1, proc: 3, status: "PENDING", reminder: null },
    { time: at(210), p: 11, doc: 2, proc: 2, status: "CONFIRMED", reminder: "CONFIRMED" },
  ];
  const template = await prisma.formTemplate.create({
    data: { clinicId: clinic.id, kind: "ANAMNESE", name: "Ficha prévia", version: 1, body: DEFAULT_ANAMNESE_TEMPLATE as unknown as Prisma.InputJsonValue, active: true },
  });
  const FICHAS: Record<string, string>[] = [
    { motivo: "Manchas na pele que apareceram há 2 meses", primeira_vez: "sim", alergia: "nao", medicamentos: "Nenhum", doencas: "Não", cirurgias: "Não" },
    { motivo: "Retorno com resultado de exames", primeira_vez: "nao", alergia: "sim", alergia_quais: "Dipirona", medicamentos: "Losartana 50 mg", doencas: "Pressão alta", cirurgias: "Vesícula, 2019" },
    { motivo: "Check-up anual", primeira_vez: "sim", alergia: "nao", medicamentos: "", doencas: "Diabetes tipo 2", cirurgias: "Não" },
    { motivo: "Dor abdominal há uma semana", primeira_vez: "sim", alergia: "nao", medicamentos: "Omeprazol", doencas: "Não", cirurgias: "Não" },
    { motivo: "Consulta de rotina", primeira_vez: "nao", alergia: "nao", medicamentos: "Anticoncepcional", doencas: "Não", cirurgias: "Cesárea, 2021" },
  ];
  const todayAppts: { id: string; time: string; p: number; doc: number; mark?: string }[] = [];
  let f = 0;
  for (const a of TODAY) {
    const appt = await prisma.appointment.create({
      data: {
        patientName: PATIENTS[a.p], patientPhone: phone(a.p), patientCpf: "00000000000", clinicProcedureId: procs[a.proc].id, date: today,
        timeSlot: a.time, doctorName: DOCTORS[a.doc], status: a.status,
        reminderSentAt: a.reminder ? daysAgo(1, 9) : null, reminderStatus: a.reminder ?? "PENDING", createdAt: daysAgo(6),
      },
    });
    todayAppts.push({ id: appt.id, time: a.time, p: a.p, doc: a.doc, mark: a.mark });
    if (a.mark) {
      const at = a.arrivedMinAgo ? new Date(now.getTime() - minutes(a.arrivedMinAgo)) : undefined;
      await prisma.agendaMark.create({
        data: { clinicId: clinic.id, source: "LOCAL", externalId: appt.id, date: today, status: a.mark, phone: phone(a.p), updatedByUserId: attendants[0].id, ...(at ? { updatedAt: at, createdAt: at } : {}) },
      });
    }
    if (a.ficha) {
      await prisma.patientFormResponse.create({
        data: { clinicId: clinic.id, templateId: template.id, phone: phone(a.p), contactId: contacts[a.p].id, appointmentSource: "LOCAL", appointmentExternalId: appt.id, appointmentDate: today, answersEncrypted: enc(FICHAS[f++ % FICHAS.length]), submittedAt: daysAgo(1, 19, 10 + f * 7) },
      });
    }
  }
  // Amanhã: lembretes em todos os estados (casam com as conversas acima).
  const TOMORROW: { time: string; p: number; doc: number; proc: number; reminder: string }[] = [
    { time: "08:00", p: 32, doc: 0, proc: 0, reminder: "CONFIRMED" },
    { time: "08:30", p: 12, doc: 1, proc: 1, reminder: "CONFIRMED" },
    { time: "09:00", p: 29, doc: 2, proc: 4, reminder: "RESCHEDULE_REQUESTED" },
    { time: "09:30", p: 13, doc: 0, proc: 3, reminder: "SENT" },
    { time: "10:00", p: 14, doc: 1, proc: 2, reminder: "CANCELLED" },
    { time: "10:30", p: 30, doc: 1, proc: 0, reminder: "SENT" },
    { time: "11:00", p: 15, doc: 2, proc: 4, reminder: "SENT" },
    { time: "14:00", p: 16, doc: 0, proc: 0, reminder: "CONFIRMED" },
    { time: "15:30", p: 17, doc: 1, proc: 1, reminder: "PENDING" },
  ];
  for (const a of TOMORROW) {
    await prisma.appointment.create({
      data: {
        patientName: PATIENTS[a.p], patientPhone: phone(a.p), patientCpf: "00000000000", clinicProcedureId: procs[a.proc].id, date: tomorrow, timeSlot: a.time,
        doctorName: DOCTORS[a.doc], status: a.reminder === "CONFIRMED" ? "CONFIRMED" : a.reminder === "CANCELLED" ? "CANCELLED" : "PENDING",
        reminderSentAt: a.reminder === "PENDING" ? null : new Date(now.getTime() - minutes(160)), reminderStatus: a.reminder, createdAt: daysAgo(8),
      },
    });
  }
  // Próximos dias (Semana) e últimos 30 dias (relatórios, retorno, falta).
  const times = ["07:30", "08:00", "08:30", "09:00", "10:00", "10:30", "14:00", "15:00", "16:30"];
  for (let d = 2; d <= 6; d++) {
    const date = dateOf(d);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    for (let i = 0; i < 5 + (d % 3) * 2; i++) {
      await prisma.appointment.create({
        data: { patientName: pick(PATIENTS, i * 3 + d), patientPhone: phone((i * 3 + d) % PATIENTS.length), patientCpf: "00000000000", clinicProcedureId: pick(procs, i + d).id, date, timeSlot: pick(times, i), doctorName: pick(DOCTORS, i + d), status: "PENDING", reminderStatus: "PENDING", createdAt: daysAgo(4) },
      });
    }
  }
  for (let i = 0; i < 30; i++) {
    const d = dateOf(-(1 + (i % 28)));
    const status = pick(["COMPLETED", "COMPLETED", "COMPLETED", "CANCELLED", "NO_SHOW", "COMPLETED"] as const, i);
    await prisma.appointment.create({
      data: {
        patientName: pick(PATIENTS, i + 3), patientPhone: phone((i + 3) % PATIENTS.length), patientCpf: "00000000000",
        clinicProcedureId: pick(procs, i).id, date: d, timeSlot: pick(times, i), doctorName: pick(DOCTORS, i), status,
        reminderSentAt: new Date(d.getTime() - 86_400_000), reminderStatus: status === "CANCELLED" ? "CANCELLED" : status === "NO_SHOW" ? "SENT" : "CONFIRMED",
        createdAt: new Date(d.getTime() - 5 * 86_400_000),
      },
    });
  }
  // Agenda cheia das últimas 2 semanas (aba Ocupação): cada médico com 8–13 marcações por dia útil,
  // 1 em cada 3 é exame (vai para a Sala de exames). Algumas faltas e cancelamentos.
  const SLOTS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
  const busy: Prisma.AppointmentCreateManyInput[] = [];
  for (let d = 1; d <= 14; d++) {
    const date = dateOf(-d);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    for (let doc = 0; doc < DOCTORS.length; doc++) {
      const n = [10, 8, 12][doc] + (d % 3) - 1;
      for (let k = 0; k < n; k++) {
        const idx = d * 31 + doc * 13 + k;
        const status = idx % 11 === 4 ? "NO_SHOW" : idx % 17 === 6 ? "CANCELLED" : "COMPLETED";
        busy.push({
          patientName: pick(PATIENTS, idx), patientPhone: phone(idx % PATIENTS.length), patientCpf: "00000000000",
          clinicProcedureId: procs[k % 3 === 2 ? pick([1, 3], idx) : pick([0, 2, 4], idx)].id,
          date, timeSlot: SLOTS[(k * 2 + doc) % SLOTS.length], doctorName: DOCTORS[doc], status,
          reminderSentAt: new Date(date.getTime() - 86_400_000), reminderStatus: status === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
          createdAt: new Date(date.getTime() - 6 * 86_400_000),
        });
      }
    }
  }
  await prisma.appointment.createMany({ data: busy });
  // Indicados por marcador que agendaram: consulta marcada depois da indicação; os mais antigos já foram atendidos.
  for (const r of resolved.filter((x) => x.marcador && x.reason === "AGENDAMENTO_CONCLUIDO")) {
    const date = new Date(Date.UTC(r.start.getFullYear(), r.start.getMonth(), r.start.getDate() + 3));
    await prisma.appointment.create({
      data: {
        patientName: PATIENTS[r.contactIdx], patientPhone: phone(r.contactIdx), patientCpf: "00000000000", clinicProcedureId: procs[0].id, date, timeSlot: "10:00",
        doctorName: DOCTORS[0], status: date < today ? "COMPLETED" : "CONFIRMED", reminderStatus: "CONFIRMED", createdAt: new Date(r.start.getTime() + minutes(50)),
      },
    });
  }
  // Lista de espera.
  for (const [k, p] of [18, 19, 20].entries()) {
    await prisma.waitlistEntry.create({ data: { clinicId: clinic.id, patientName: PATIENTS[p], phone: phone(p), doctorName: DOCTORS[k], period: pick(["MORNING", "AFTERNOON", "ANY"], k), notes: k === 0 ? "Prefere sexta" : null, createdAt: daysAgo(2 + k) } });
  }

  // ---------- Recepção: salas, senhas, chamadas na TV ----------
  for (const [i, doc] of DOCTORS.entries()) await prisma.doctorRoom.create({ data: { clinicId: clinic.id, doctorKey: doctorKey(doc), doctor: doc, room: ROOMS[i] } });
  // Salas da aba Ocupação (Relatório): os 3 consultórios (mesmos nomes da TV) + sala de exames.
  const weekdays = (start: string, end: string) => [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start, end }));
  await prisma.clinicRoom.createMany({
    data: [
      ...ROOMS.map((name) => ({ clinicId: clinic.id, name, kind: "CONSULTORIO", hours: weekdays("08:00", "17:00"), procedureKeywords: [], slotMinutes: 30 })),
      { clinicId: clinic.id, name: "Sala de exames", kind: "PROCEDIMENTO", hours: weekdays("08:00", "17:00"), procedureKeywords: ["ultrassom", "check-up"], slotMinutes: 40 },
    ],
  });
  const services = await Promise.all(
    [
      { name: "Consulta", letter: "C" },
      { name: "Exame", letter: "E" },
      { name: "Resultado", letter: "R" },
    ].map((s, position) => prisma.queueService.create({ data: { clinicId: clinic.id, ...s, position } }))
  );
  const day = ymd(new Date(now.getTime() - 3 * 3600_000));
  const counters = new Map<string, number>();
  const ticket = async (o: { svc: number; type?: "N" | "P"; status: string; appt?: (typeof todayAppts)[number]; minAgo: number; calledMinAgo?: number; name?: string }) => {
    const svc = services[o.svc];
    const series = seriesFor(svc.letter, o.type ?? "N");
    const number = (counters.get(series) ?? 0) + 1;
    counters.set(series, number);
    const code = ticketCode(series, number);
    await prisma.queueTicket.create({
      data: {
        clinicId: clinic.id, day, series, serviceId: svc.id, serviceName: svc.name, type: o.type ?? "N", number, code, status: o.status, followTokenHash: fakeHash(),
        patientName: o.appt ? PATIENTS[o.appt.p] : (o.name ?? null), phone: o.appt ? phone(o.appt.p) : null, doctor: o.appt ? DOCTORS[o.appt.doc] : null,
        appointmentSource: o.appt ? "LOCAL" : null, appointmentExtId: o.appt?.id ?? null, appointmentTime: o.appt?.time ?? null,
        room: o.calledMinAgo !== undefined && o.appt ? ROOMS[o.appt.doc] : null, callCount: o.calledMinAgo !== undefined ? 1 : 0,
        calledAt: o.calledMinAgo !== undefined ? new Date(now.getTime() - minutes(o.calledMinAgo)) : null,
        finishedAt: o.status === "DONE" ? new Date(now.getTime() - minutes(Math.max(1, (o.calledMinAgo ?? 0) - 15))) : null,
        createdAt: new Date(now.getTime() - minutes(o.minAgo)),
      },
    });
    return code;
  };
  const c1 = await ticket({ svc: 0, status: "DONE", appt: todayAppts[0], minAgo: 120, calledMinAgo: 100 });
  const c2 = await ticket({ svc: 1, status: "DONE", appt: todayAppts[1], minAgo: 90, calledMinAgo: 70 });
  const c3 = await ticket({ svc: 0, status: "CALLED", appt: todayAppts[3], minAgo: 35, calledMinAgo: 6 });
  await ticket({ svc: 0, status: "WAITING", appt: todayAppts[4], minAgo: 22 });
  await ticket({ svc: 0, status: "WAITING", appt: todayAppts[5], minAgo: 9 });
  await ticket({ svc: 2, type: "P", status: "WAITING", minAgo: 5, name: "Sr. Otávio Brandão" });
  for (const [code, appt, minAgo] of [[c1, todayAppts[0], 100], [c2, todayAppts[1], 70], [c3, todayAppts[3], 6]] as const) {
    await prisma.patientCall.create({
      data: { clinicId: clinic.id, source: "LOCAL", externalId: appt.id, displayName: code, spokenName: PATIENTS[appt.p], doctor: DOCTORS[appt.doc], room: ROOMS[appt.doc], ticketCode: code, calledByUserId: attendants[0].id, createdAt: new Date(now.getTime() - minutes(minAgo)) },
    });
  }
  const tvRaw = randomBytes(24).toString("base64url");
  const totemRaw = randomBytes(24).toString("base64url");
  const qrRaw = randomBytes(24).toString("base64url");
  await prisma.tvDisplay.createMany({
    data: [
      { clinicId: clinic.id, name: "TV da sala de espera", kind: "TV", tokenHash: hashPatientToken(tvRaw) },
      { clinicId: clinic.id, name: "Totem de senhas", kind: "TOTEM", tokenHash: hashPatientToken(totemRaw) },
      { clinicId: clinic.id, name: "QR Code da recepção", kind: "QR", tokenHash: hashPatientToken(qrRaw) },
    ],
  });

  // Letreiro da TV: avisos da clínica + notícias de saúde (Agência Brasil).
  await prisma.tvMediaItem.createMany({
    data: [
      ...[
        "Traga documento com foto e a carteirinha do convênio.",
        "Chegou? Leia o QR Code da recepção e faça seu check-in pelo celular.",
        "Vacinação contra a gripe: pergunte na recepção.",
      ].map((text, i) => ({ clinicId: clinic.id, kind: "TICKER_NOTICE", source: text, title: text.slice(0, 80), position: i })),
      { clinicId: clinic.id, kind: "TICKER_NEWS", source: "SAUDE", title: "Notícias de saúde (Agência Brasil)", position: 99 },
    ],
  });

  // ---------- Disparos, régua, NPS ----------
  const campaign = await prisma.broadcastCampaign.create({
    data: {
      clinicId: clinic.id, name: "Check-up do mês", status: "COMPLETED", createdByUserId: manager.id,
      messageTemplate: "Olá {{nome}}! Este mês é de cuidar da saúde: check-up completo com condição especial. Responda SIM para agendar.",
      createdAt: daysAgo(12, 9),
    },
  });
  for (let i = 0; i < 32; i++) {
    await prisma.broadcastRecipient.create({
      data: { campaignId: campaign.id, phone: phone(i), variables: { nome: first(PATIENTS[i]) }, status: i === 31 ? "FAILED" : "SENT", sentAt: daysAgo(11, 9 + (i % 8), (i * 5) % 60) },
    });
  }
  // Campanha com sorteio entre 3 modelos (Relatório › respostas por modelo). Só quem deu
  // consentimento recebe; os outros aparecem como "Sem consentimento". Quem respondeu ganha uma
  // conversa resolvida a partir da mensagem da campanha.
  const CHECKUP = ["checkup_novembro", "checkup_novembro_curto", "checkup_novembro_pergunta"].map((n) => DEMO_CLOUD_TEMPLATES.find((t) => t.name === n)!);
  const sentAtDay = 6;
  const checkup = await prisma.broadcastCampaign.create({
    data: {
      clinicId: clinic.id, name: "Check-up de novembro", status: "COMPLETED", createdByUserId: manager.id, createdAt: daysAgo(sentAtDay + 1, 16),
      messageTemplate: CHECKUP[0].bodyText, messageVariants: CHECKUP.slice(1).map((t) => t.bodyText),
      cloudTemplateName: CHECKUP[0].name, cloudTemplateLanguage: CHECKUP[0].language, cloudTemplateBody: CHECKUP[0].bodyText, cloudTemplateParams: ["{{nome}}"],
      cloudTemplateVariants: CHECKUP.slice(1).map((t) => ({ name: t.name, language: t.language, body: t.bodyText })),
    },
  });
  // Respostas por modelo (índice do destinatário dentro do modelo): o 2º modelo responde mais.
  const REPLIES: Record<number, { text: string; scheduled: boolean }[]> = {
    0: [{ text: "Quero sim, pode ser de manhã", scheduled: true }, { text: "Quanto custa?", scheduled: false }],
    1: [{ text: "Quero agendar", scheduled: true }, { text: "Sim! Tem quinta?", scheduled: true }, { text: "Pode ser semana que vem?", scheduled: true }, { text: "Aceita Unimed?", scheduled: false }],
    2: [{ text: "Faz uns dois anos, quero marcar", scheduled: true }],
  };
  const perVariant = [0, 0, 0];
  let sentCount = 0;
  for (let i = 0; i < PATIENTS.length; i++) {
    const consent = i % 3 !== 2; // mesma regra do consentimento dos pacientes, acima
    const v = consent ? sentCount++ % 3 : 0;
    const sentAt = daysAgo(sentAtDay, 9 + (i % 8), (i * 7) % 60);
    await prisma.broadcastRecipient.create({
      data: consent
        ? { campaignId: checkup.id, phone: phone(i), variables: { nome: first(PATIENTS[i]) }, status: "SENT", sentAt, variantIndex: v }
        : { campaignId: checkup.id, phone: phone(i), variables: { nome: first(PATIENTS[i]) }, status: "SKIPPED_OPT_OUT", errorMessage: NO_CONSENT_MESSAGE },
    });
    if (!consent) continue;
    const reply = REPLIES[v][perVariant[v]++];
    if (!reply) continue;
    const t0 = sentAt.getTime();
    const conv = await prisma.conversation.create({
      data: {
        clinicId: clinic.id, contactId: contacts[i].id, status: "RESOLVED", funnelStage: reply.scheduled ? "AGENDADO" : "TRIAGEM",
        resolutionReason: reply.scheduled ? "AGENDAMENTO_CONCLUIDO" : "DUVIDA_ESCLARECIDA", resolvedAt: new Date(t0 + minutes(90)),
        resolvedByUserId: attendants[0].id, assignedUserId: attendants[0].id, acquisitionChannel: "Campanha", createdAt: new Date(t0), lastMessageAt: new Date(t0 + minutes(60)),
      },
    });
    const body = CHECKUP[v].bodyText.replace("{{1}}", first(PATIENTS[i]));
    const msgs: [string, string, number][] = [
      ["OUTBOUND", body, 0],
      ["INBOUND", reply.text, 35],
      ["OUTBOUND", reply.scheduled ? "Perfeito! Agendei seu check-up. Você recebe o lembrete um dia antes." : "Respondi suas dúvidas por aqui; quando quiser agendar é só chamar.", 50],
    ];
    for (const [direction, content, after] of msgs) {
      await prisma.message.create({
        data: { conversationId: conv.id, direction: direction as "INBOUND" | "OUTBOUND", content, status: "READ", senderUserId: direction === "OUTBOUND" && after > 0 ? attendants[0].id : null, createdAt: new Date(t0 + minutes(after)) },
      });
    }
  }
  for (const step of DEFAULT_RULE_STEPS) {
    await prisma.automationRule.create({ data: { clinicId: clinic.id, kind: step.kind, name: step.name, daysAfter: step.daysAfter, requireNoFuture: step.requireNoFuture, messageTemplate: step.messageTemplate, active: false } });
  }
  const NPS_COMMENTS: Record<number, string> = {
    0: "Atendimento rápido e a Dra. Lívia foi muito atenciosa.",
    3: "Gostei do lembrete pelo WhatsApp, ajudou muito.",
    6: "Esperei um pouco além do horário marcado.",
    9: "Recepção muito educada, voltarei com certeza.",
    13: "Não consegui estacionar perto.",
  };
  const scores = [10, 9, 10, 10, 8, 9, 6, 10, 9, 10, 7, 10, 9, 4, 10, 9, 10, 8];
  for (const [i, score] of scores.entries()) {
    await prisma.npsResponse.create({
      data: { clinicId: clinic.id, phone: phone(i), score, commentEncrypted: NPS_COMMENTS[i] ? enc({ comment: NPS_COMMENTS[i] }) : null, submittedAt: daysAgo(1 + ((i * 3) % 27), 12 + (i % 6)) },
    });
  }

  // ---------- Convênios aceitos, automações e tarefas (11/11/2026) ----------
  await prisma.clinicInsuranceSettings.create({
    data: { clinicId: clinic.id, enabled: true, accepted: ["Unimed", "Bradesco Saúde", "Cassi", "Planserv", "SulAmérica"], note: "Também atendemos particular." },
  });

  const tplOf = (name: string) => {
    const t = DEMO_CLOUD_TEMPLATES.find((x) => x.name === name)!;
    return { cloudTemplateName: t.name, cloudTemplateLanguage: t.language, cloudTemplateBody: t.bodyText, cloudTemplateParams: ["{{nome}}"] };
  };
  const followUp: StoredStep[] = [
    { delayHours: 120, action: "MESSAGE", reminderText: "", ...tplOf("reativacao") },
    { delayHours: 72, action: "LOST", reminderText: "", cloudTemplateName: null, cloudTemplateLanguage: null, cloudTemplateBody: null, cloudTemplateParams: [] },
  ];
  await prisma.tagAutomation.create({
    data: {
      clinicId: clinic.id, name: "Aguardando retorno", triggerKind: "TAG", tag: "Aguardando retorno", delayHours: 48, waitFrom: "LAST_MESSAGE", stopOnReply: true,
      action: "MESSAGE", mode: "REVIEW", ...tplOf("retorno_lembrete"), extraSteps: followUp as unknown as Prisma.InputJsonValue, active: true, createdAt: daysAgo(9, 9),
    },
  });
  await prisma.tagAutomation.create({
    data: {
      clinicId: clinic.id, name: "Orçamento parado", triggerKind: "STAGE", tag: "", stage: "ORCAMENTO", delayHours: 72, waitFrom: "LAST_MESSAGE", stopOnReply: true,
      action: "REMINDER", mode: "REVIEW", reminderText: "Ligar para o paciente e perguntar se ficou alguma dúvida sobre o orçamento.", active: true, createdAt: daysAgo(8, 9),
    },
  });
  await prisma.tagAutomation.create({
    data: {
      clinicId: clinic.id, name: "Como foi a consulta", triggerKind: "TAG", tag: "Atendido", delayHours: 24, waitFrom: "ENTRY", stopOnReply: false,
      action: "MESSAGE", mode: "AUTO", serviceNotice: true, ...tplOf("pos_consulta"), active: true, createdAt: daysAgo(7, 9),
    },
  });

  // Tarefas: atrasada, para hoje (uma criada pela automação), futura, sem prazo e uma concluída.
  const openConvs = await prisma.conversation.findMany({
    where: { clinicId: clinic.id, status: { not: "RESOLVED" }, channel: "WHATSAPP" },
    orderBy: { createdAt: "asc" },
    select: { id: true, funnelStage: true },
  });
  const budgetConv = openConvs.find((x) => x.funnelStage === "ORCAMENTO") ?? openConvs[0];
  const otherConvs = openConvs.filter((x) => x.id !== budgetConv?.id);
  /** Fim do dia de hoje + n dias, em Brasília (mesmo formato que a tela grava). */
  const dueIn = (n: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + n, 26, 59));
  const TASKS: { text: string; due: Date | null; who: string | null; conv?: string; source?: string; done?: boolean }[] = [
    { text: "Cobrar a autorização do convênio e avisar a paciente.", due: dueIn(-2), who: manager.id, conv: otherConvs[0]?.id },
    { text: "Ligar para o paciente e perguntar se ficou alguma dúvida sobre o orçamento.", due: dueIn(0), who: null, conv: budgetConv?.id, source: "Orçamento parado" },
    { text: "Confirmar com a Dra. Lívia o encaixe de quinta à tarde.", due: dueIn(0), who: manager.id },
    { text: "Enviar o laudo do exame por e-mail.", due: dueIn(2), who: attendants[0].id, conv: otherConvs[1]?.id },
    { text: "Atualizar a tabela de preços dos exames de imagem.", due: null, who: manager.id },
    { text: "Retornar a ligação do laboratório parceiro.", due: dueIn(-1), who: attendants[1].id, done: true },
  ];
  for (const [i, t] of TASKS.entries()) {
    await prisma.receptionTask.create({
      data: {
        clinicId: clinic.id, text: t.text, dueAt: t.due, assignedUserId: t.who, conversationId: t.conv ?? null,
        source: t.source ?? null, createdByUserId: t.source ? null : manager.id,
        doneAt: t.done ? daysAgo(1, 16) : null, doneByUserId: t.done ? attendants[1].id : null,
        createdAt: daysAgo(3 - Math.min(i, 3), 10 + i),
      },
    });
  }

  // O banco é o de produção, então os links valem no domínio de produção (não no NEXTAUTH_URL local).
  const base = "https://conectasaudevc.com.br";
  console.log(`Clínica demo criada: ${clinic.tradeName} (${clinic.id})`);
  console.log(`Login: ${MANAGER_EMAIL} — senha em DEMO_PASSWORD no .env (atendentes: ana@, bruno@, carla@${DOMAIN}, mesma senha).`);
  console.log(`Médico: livia@${DOMAIN} (mesma senha) — vê a ficha prévia dos pacientes dela de hoje.`);
  console.log(`TV:          ${base}/tv/${tvRaw}`);
  console.log(`Totem:       ${base}/totem/${totemRaw}`);
  console.log(`QR chegada:  ${base}/chegada/${qrRaw}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
