/** Clínica de DEMONSTRAÇÃO (vídeo de apresentação) — só dados fictícios.
 * - Telefones 5500900000xx (DDD 00 não existe → nunca é um paciente real).
 * - WhatsApp "falso": instância apontando pra demo.invalid → nenhum envio sai de verdade,
 *   e o aviso de WhatsApp caído não aparece (status "unknown").
 * - Sem integração de bridge/lembretes e campanha já CONCLUÍDA → nenhum cron mexe nela.
 * Idempotente: apaga os dados da clínica demo (CNPJ fixo) e recria.
 *
 * Uso: npx tsx scripts/seed-demo-clinic.ts
 * Senha do login: env DEMO_PASSWORD; se faltar, gera uma e grava no .env local. */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { appendFileSync } from "fs";

const prisma = new PrismaClient();
const CNPJ = "00.000.000/0001-00";
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
const phone = (i: number) => `5500900000${String(i).padStart(2, "0")}`;
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

const PATIENTS = [
  "Mariana Alves", "João Pereira", "Fernanda Costa", "Ricardo Gomes", "Patrícia Rocha", "Lucas Martins",
  "Camila Ribeiro", "André Carvalho", "Juliana Freitas", "Paulo Nogueira", "Beatriz Lopes", "Gustavo Teixeira",
  "Larissa Barbosa", "Rafael Duarte", "Aline Moreira", "Thiago Araújo", "Vanessa Cardoso", "Eduardo Pinto",
  "Renata Melo", "Felipe Castro", "Sabrina Dias", "Marcelo Fernandes", "Tatiane Lima", "Rodrigo Santana",
  "Débora Campos", "Leonardo Vieira", "Priscila Monteiro", "Diego Correia", "Simone Batista", "Fábio Azevedo",
  "Helena Prado", "Otávio Brandão",
];
const DOCTORS = ["Dra. Lívia Andrade", "Dr. Henrique Matos", "Dra. Paula Siqueira"];
const CHANNELS = ["Instagram Ads", "Google", "Indicação", "Site", null];

type Script = {
  reason: string | null; // null = aberta
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

async function main() {
  const password = process.env.DEMO_PASSWORD || randomBytes(9).toString("base64url");
  if (!process.env.DEMO_PASSWORD) appendFileSync(".env", `\nDEMO_PASSWORD="${password}"\n`);

  // Limpa a clínica demo anterior (só ela).
  const old = await prisma.clinic.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
  if (old) {
    const convIds = (await prisma.conversation.findMany({ where: { clinicId: old.id }, select: { id: true } })).map((c) => c.id);
    await prisma.conversationQualityAudit.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.messageTriage.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.message.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.conversation.deleteMany({ where: { clinicId: old.id } });
    await prisma.broadcastRecipient.deleteMany({ where: { campaign: { clinicId: old.id } } });
    await prisma.broadcastCampaign.deleteMany({ where: { clinicId: old.id } });
    await prisma.appointment.deleteMany({ where: { clinicProcedure: { clinicId: old.id } } });
    await prisma.clinicProcedure.deleteMany({ where: { clinicId: old.id } });
    await prisma.whatsappInstance.deleteMany({ where: { clinicId: old.id } });
    await prisma.user.deleteMany({ where: { clinicId: old.id } });
    await prisma.clinic.delete({ where: { id: old.id } });
  }
  await prisma.contact.deleteMany({ where: { phone: { startsWith: "5500900000" } } });

  const clinic = await prisma.clinic.create({
    data: {
      name: "Clínica Vida Demonstração Ltda",
      tradeName: "Clínica Vida (demo)",
      cnpj: CNPJ,
      address: "Av. Exemplo, 100",
      neighborhood: "Centro",
      city: "Vitória da Conquista",
      commissionRate: 0,
      listedInMarketplace: false,
      defaultTicket: 250,
    },
  });
  await prisma.whatsappInstance.create({
    data: { clinicId: clinic.id, apiUrl: "https://demo.invalid", apiKey: "demo", instanceName: `DEMO-${clinic.id}`, status: "CONNECTED" },
  });

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name: "Gestão Demo", email: MANAGER_EMAIL, passwordHash: hash, role: "CLINIC", clinicId: clinic.id, isAttendant: false } });
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

  // Conversas dos últimos 30 dias (resolvidas) + abertas de hoje.
  let pi = 0;
  for (let i = 0; i < 26; i++) {
    const s = pick(SCRIPTS, i);
    const name = PATIENTS[pi];
    const contact = await prisma.contact.create({ data: { name, phone: phone(pi), convenio: pick(["Unimed", "Bradesco Saúde", "Particular"], i) } });
    pi++;
    const start = daysAgo(1 + (i % 28), 8 + (i % 9), (i * 7) % 60);
    const attendant = pick(attendants, i);
    const replyDelay = pick([3, 6, 9, 14, 22, 5, 11], i);
    let t = start.getTime();
    const conv = await prisma.conversation.create({
      data: {
        clinicId: clinic.id,
        contactId: contact.id,
        status: "RESOLVED",
        funnelStage: s.stage,
        estimatedValue: s.value ?? null,
        resolutionReason: s.reason,
        resolvedAt: new Date(start.getTime() + minutes(60)),
        resolvedByUserId: attendant.id,
        assignedUserId: attendant.id,
        acquisitionChannel: pick(CHANNELS, i),
        createdAt: start,
        lastMessageAt: new Date(start.getTime() + minutes(40)),
      },
    });
    for (const [k, [dir, text]] of s.msgs.entries()) {
      t += k === 1 ? minutes(replyDelay) : minutes(2);
      await prisma.message.create({
        data: { conversationId: conv.id, direction: dir === "in" ? "INBOUND" : "OUTBOUND", content: text, status: dir === "in" ? "READ" : "READ", senderUserId: dir === "out" ? attendant.id : null, createdAt: new Date(t) },
      });
    }
    await prisma.conversationQualityAudit.create({
      data: { conversationId: conv.id, sentiment: s.sentiment, firstResponseSec: replyDelay * 60, resolutionSec: 3600 },
    });
  }

  const openCases: { tags?: string[]; stage: Script["stage"]; msgs: [("in" | "out"), string][]; assigned?: number; minsAgo: number; value?: number }[] = [
    { tags: ["🚨 Urgência Clínica"], stage: "TRIAGEM", minsAgo: 4, msgs: [["in", "Fiz a cirurgia ontem e estou com sangramento, é normal?"], ["out", "Se for uma emergência, ligue agora para o SAMU (192) ou procure o pronto-socorro mais próximo. Nossa equipe também foi avisada e vai te responder assim que possível."]] },
    { stage: "NOVOS", minsAgo: 12, msgs: [["in", "Olá, vocês atendem criança? Meu filho de 6 anos precisa de pediatra"]] },
    { stage: "TRIAGEM", minsAgo: 25, assigned: 0, msgs: [["in", "Gostaria de saber o valor da consulta com dermatologista"], ["out", "Olá! A consulta particular é R$ 280. Atendemos também Unimed e Bradesco."], ["in", "Tenho Bradesco, tem horário essa semana?"]] },
    { stage: "ORCAMENTO", minsAgo: 48, assigned: 1, value: 900, msgs: [["in", "Pode me mandar o orçamento da vasectomia?"], ["out", "Claro! O pacote fica em R$ 900, com consulta e retorno incluídos."], ["in", "Vou ver com minha esposa e retorno"]] },
    { tags: ["⚠️ Remarcação Pendente"], stage: "AGENDADO", minsAgo: 70, assigned: 2, msgs: [["out", "Olá! Lembrete: sua consulta é amanhã às 9h com a Dra. Paula. Responda 1 para confirmar ou 2 para remarcar."], ["in", "2, não vou conseguir ir amanhã"]] },
    { stage: "NOVOS", minsAgo: 95, msgs: [["in", "Vi o anúncio no Instagram do check-up, como funciona?"]] },
  ];
  for (const [i, c] of openCases.entries()) {
    const contact = await prisma.contact.create({ data: { name: PATIENTS[pi], phone: phone(pi) } });
    pi++;
    let t = now.getTime() - minutes(c.minsAgo + c.msgs.length * 2);
    const conv = await prisma.conversation.create({
      data: {
        clinicId: clinic.id,
        contactId: contact.id,
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

  // Agenda: hoje + últimos 30 dias (com lembretes).
  const times = ["07:30", "08:00", "08:30", "09:00", "10:00", "10:30", "14:00", "15:00", "16:30"];
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  for (let i = 0; i < 9; i++) {
    await prisma.appointment.create({
      data: {
        patientName: PATIENTS[i], patientPhone: phone(i), patientCpf: "00000000000", clinicProcedureId: pick(procs, i).id, date: today,
        timeSlot: times[i], doctorName: pick(DOCTORS, i), status: i < 3 ? "COMPLETED" : "CONFIRMED",
        reminderSentAt: daysAgo(1, 9), reminderStatus: i === 5 ? "SENT" : "CONFIRMED",
      },
    });
  }
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (1 + (i % 28)));
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

  // Campanha concluída (nenhum cron envia: status COMPLETED).
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: MANAGER_EMAIL } });
  const campaign = await prisma.broadcastCampaign.create({
    data: {
      clinicId: clinic.id, name: "Check-up de Outubro", status: "COMPLETED", createdByUserId: manager.id,
      messageTemplate: "Olá {{nome}}! Outubro é mês de cuidar da saúde: check-up completo com condição especial. Responda SIM para agendar.",
      createdAt: daysAgo(12, 9),
    },
  });
  for (let i = 0; i < 32; i++) {
    await prisma.broadcastRecipient.create({
      data: { campaignId: campaign.id, phone: phone(i), variables: { nome: PATIENTS[i].split(" ")[0] }, status: i === 31 ? "FAILED" : "SENT", sentAt: daysAgo(11, 9 + (i % 8), (i * 5) % 60) },
    });
  }

  console.log(`Clínica demo criada: ${clinic.tradeName} (${clinic.id})`);
  console.log(`Login: ${MANAGER_EMAIL} — senha em DEMO_PASSWORD no .env (atendentes: ana@, bruno@, carla@${DOMAIN}, mesma senha).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
