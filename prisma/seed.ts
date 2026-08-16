import { PrismaClient, ProcedureCategory, AppointmentType, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const defaultBusinessHours = {
  seg: { open: "08:00", close: "18:00" },
  ter: { open: "08:00", close: "18:00" },
  qua: { open: "08:00", close: "18:00" },
  qui: { open: "08:00", close: "18:00" },
  sex: { open: "08:00", close: "18:00" },
  sab: { open: "08:00", close: "12:00" },
  dom: { closed: true },
};

const ADMIN_PASSWORD = "Admin@123";
const CLINIC_PASSWORD = "Clinica@123";

const specialtiesData = [
  { name: "Clínica Geral" },
  { name: "Cardiologia" },
  { name: "Oftalmologia" },
  { name: "Dermatologia" },
];

const consultationProceduresData = [
  {
    specialty: "Clínica Geral",
    name: "Consulta - Clínica Geral",
    description: "Consulta médica de rotina, avaliação geral de saúde.",
    preparationInstructions: null,
  },
  {
    specialty: "Cardiologia",
    name: "Consulta - Cardiologia",
    description: "Avaliação cardiológica com médico especialista.",
    preparationInstructions: null,
  },
  {
    specialty: "Oftalmologia",
    name: "Consulta - Oftalmologia",
    description: "Avaliação oftalmológica e exame de acuidade visual.",
    preparationInstructions: "Trazer óculos ou lentes de contato em uso, se houver.",
  },
  {
    specialty: "Dermatologia",
    name: "Consulta - Dermatologia",
    description: "Avaliação dermatológica geral.",
    preparationInstructions: null,
  },
];

const examProceduresData = [
  {
    name: "Ultrassonografia Abdominal",
    description: "Exame de imagem para avaliação de órgãos abdominais.",
    preparationInstructions: "Jejum de 8 horas e bexiga cheia no momento do exame.",
  },
  {
    name: "Hemograma Completo",
    description: "Exame de sangue para avaliação geral da saúde.",
    preparationInstructions: "Jejum de 8 horas recomendado.",
  },
  {
    name: "Tomografia Computadorizada",
    description: "Exame de imagem de alta precisão.",
    preparationInstructions: "Jejum de 4 horas caso haja uso de contraste.",
  },
  {
    name: "Eletrocardiograma (ECG)",
    description: "Exame para avaliação da atividade elétrica do coração.",
    preparationInstructions: "Não é necessário jejum. Evitar cremes ou óleos na região do peito.",
  },
  {
    name: "Colonoscopia",
    description: "Exame para avaliação do intestino grosso.",
    preparationInstructions:
      "Dieta líquida nas 24h anteriores e uso do laxante indicado, conforme orientação médica.",
  },
];

const clinicsData = [
  {
    name: "São Lucas Serviços Médicos Ltda",
    tradeName: "Clínica São Lucas",
    cnpj: "12.345.678/0001-90",
    phone: "(11) 3456-7890",
    whatsapp: "(11) 91234-5678",
    address: "Av. Paulista, 1000",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    active: true,
    commissionRate: "15.00",
    rating: 4.7,
    reviewCount: 312,
    businessHours: defaultBusinessHours,
    staffEmail: "contato@clinicasaolucas.com.br",
  },
  {
    name: "Instituto Vida Diagnósticos S.A.",
    tradeName: "Instituto Vida",
    cnpj: "23.456.789/0001-01",
    phone: "(11) 3222-1100",
    whatsapp: "(11) 98888-4321",
    address: "Rua Augusta, 500",
    neighborhood: "Consolação",
    city: "São Paulo",
    active: true,
    commissionRate: "12.50",
    rating: 4.4,
    reviewCount: 158,
    businessHours: defaultBusinessHours,
    staffEmail: "contato@institutovida.com.br",
  },
  {
    name: "Bem Estar Centro Médico Ltda",
    tradeName: "Clínica Bem Estar",
    cnpj: "34.567.890/0001-12",
    phone: "(21) 2233-4455",
    whatsapp: "(21) 99777-6655",
    address: "Rua Visconde de Pirajá, 200",
    neighborhood: "Ipanema",
    city: "Rio de Janeiro",
    active: true,
    commissionRate: "18.00",
    rating: 4.9,
    reviewCount: 94,
    businessHours: defaultBusinessHours,
    staffEmail: "contato@clinicabemestar.com.br",
  },
] as const;

async function main() {
  console.log("Seeding especialidades...");
  const specialties = new Map<string, string>();
  for (const specialty of specialtiesData) {
    const record = await prisma.specialty.upsert({
      where: { name: specialty.name },
      update: {},
      create: specialty,
    });
    specialties.set(record.name, record.id);
  }

  console.log("Seeding procedimentos (consultas)...");
  const procedures = new Map<string, string>();
  for (const proc of consultationProceduresData) {
    const record = await prisma.procedure.upsert({
      where: { name: proc.name },
      update: {},
      create: {
        name: proc.name,
        category: ProcedureCategory.CONSULTATION,
        description: proc.description,
        preparationInstructions: proc.preparationInstructions,
        specialtyId: specialties.get(proc.specialty),
      },
    });
    procedures.set(record.name, record.id);
  }

  console.log("Seeding procedimentos (exames)...");
  for (const exam of examProceduresData) {
    const record = await prisma.procedure.upsert({
      where: { name: exam.name },
      update: {},
      create: {
        name: exam.name,
        category: ProcedureCategory.EXAM,
        description: exam.description,
        preparationInstructions: exam.preparationInstructions,
      },
    });
    procedures.set(record.name, record.id);
  }

  console.log("Seeding clínicas parceiras...");
  const clinics = new Map<string, string>();
  for (const { staffEmail, ...clinic } of clinicsData) {
    const record = await prisma.clinic.upsert({
      where: { cnpj: clinic.cnpj },
      update: {
        rating: clinic.rating,
        reviewCount: clinic.reviewCount,
        businessHours: clinic.businessHours,
      },
      create: clinic,
    });
    clinics.set(record.tradeName, record.id);
  }

  console.log("Seeding usuários (admin e equipes das clínicas)...");
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: "admin@marcacao.com.br" },
    update: {},
    create: {
      name: "Administrador Marcação",
      email: "admin@marcacao.com.br",
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
    },
  });

  const clinicPasswordHash = await bcrypt.hash(CLINIC_PASSWORD, 10);
  for (const { staffEmail, tradeName } of clinicsData) {
    const clinicId = clinics.get(tradeName);
    if (!clinicId) throw new Error(`Clínica não encontrada: ${tradeName}`);

    await prisma.user.upsert({
      where: { email: staffEmail },
      update: { clinicId },
      create: {
        name: `Equipe ${tradeName}`,
        email: staffEmail,
        role: UserRole.CLINIC,
        passwordHash: clinicPasswordHash,
        clinicId,
      },
    });
  }

  console.log("Seeding vínculos clínica x procedimento (preços)...");
  const clinicProceduresData: {
    clinic: string;
    procedure: string;
    price: string;
    promotionalPrice: string | null;
    requiresAppointment: boolean;
    appointmentType: AppointmentType;
  }[] = [
    {
      clinic: "Clínica São Lucas",
      procedure: "Consulta - Clínica Geral",
      price: "150.00",
      promotionalPrice: "120.00",
      requiresAppointment: true,
      appointmentType: AppointmentType.SCHEDULED,
    },
    {
      clinic: "Clínica São Lucas",
      procedure: "Consulta - Cardiologia",
      price: "250.00",
      promotionalPrice: null,
      requiresAppointment: true,
      appointmentType: AppointmentType.SCHEDULED,
    },
    {
      clinic: "Clínica São Lucas",
      procedure: "Hemograma Completo",
      price: "60.00",
      promotionalPrice: "45.00",
      requiresAppointment: true,
      appointmentType: AppointmentType.ARRIVAL_ORDER,
    },
    {
      clinic: "Clínica São Lucas",
      procedure: "Eletrocardiograma (ECG)",
      price: "90.00",
      promotionalPrice: null,
      requiresAppointment: true,
      appointmentType: AppointmentType.SCHEDULED,
    },
    {
      clinic: "Instituto Vida",
      procedure: "Ultrassonografia Abdominal",
      price: "180.00",
      promotionalPrice: "150.00",
      requiresAppointment: true,
      appointmentType: AppointmentType.SCHEDULED,
    },
    {
      clinic: "Instituto Vida",
      procedure: "Tomografia Computadorizada",
      price: "450.00",
      promotionalPrice: "400.00",
      requiresAppointment: true,
      appointmentType: AppointmentType.SCHEDULED,
    },
    {
      clinic: "Instituto Vida",
      procedure: "Hemograma Completo",
      price: "55.00",
      promotionalPrice: null,
      requiresAppointment: false,
      appointmentType: AppointmentType.ARRIVAL_ORDER,
    },
    {
      clinic: "Instituto Vida",
      procedure: "Colonoscopia",
      price: "600.00",
      promotionalPrice: "550.00",
      requiresAppointment: true,
      appointmentType: AppointmentType.SCHEDULED,
    },
    {
      clinic: "Clínica Bem Estar",
      procedure: "Consulta - Oftalmologia",
      price: "200.00",
      promotionalPrice: null,
      requiresAppointment: true,
      appointmentType: AppointmentType.SCHEDULED,
    },
    {
      clinic: "Clínica Bem Estar",
      procedure: "Consulta - Dermatologia",
      price: "220.00",
      promotionalPrice: "180.00",
      requiresAppointment: true,
      appointmentType: AppointmentType.SCHEDULED,
    },
    {
      clinic: "Clínica Bem Estar",
      procedure: "Eletrocardiograma (ECG)",
      price: "85.00",
      promotionalPrice: null,
      requiresAppointment: true,
      appointmentType: AppointmentType.ARRIVAL_ORDER,
    },
    {
      clinic: "Clínica Bem Estar",
      procedure: "Consulta - Clínica Geral",
      price: "140.00",
      promotionalPrice: null,
      requiresAppointment: true,
      appointmentType: AppointmentType.SCHEDULED,
    },
  ];

  for (const cp of clinicProceduresData) {
    const clinicId = clinics.get(cp.clinic);
    const procedureId = procedures.get(cp.procedure);
    if (!clinicId || !procedureId) {
      throw new Error(`Clínica ou procedimento não encontrado: ${cp.clinic} / ${cp.procedure}`);
    }
    await prisma.clinicProcedure.upsert({
      where: { clinicId_procedureId: { clinicId, procedureId } },
      update: {},
      create: {
        clinicId,
        procedureId,
        price: cp.price,
        promotionalPrice: cp.promotionalPrice,
        requiresAppointment: cp.requiresAppointment,
        appointmentType: cp.appointmentType,
      },
    });
  }

  console.log("Seeding respostas rápidas...");
  const globalCannedResponses: { shortcut: string; content: string }[] = [
    {
      shortcut: "/confirmacao",
      content:
        "Você confirma sua presença? Responda *1* ou *SIM* para confirmar, ou *2* ou *CANCELAR* para cancelar.",
    },
    {
      shortcut: "/jejum",
      content:
        "Lembrando que esse exame exige jejum de 8 horas. Pode beber água normalmente durante o período.",
    },
    {
      shortcut: "/pix",
      content:
        "O pagamento pode ser feito via Pix na hora do atendimento. Qualquer dúvida, é só chamar por aqui.",
    },
    {
      shortcut: "/atraso",
      content:
        "Sem problemas! Só avise com quanto tempo de atraso você chega que a gente vê a melhor forma de te encaixar.",
    },
  ];
  for (const canned of globalCannedResponses) {
    const existing = await prisma.cannedResponse.findFirst({
      where: { clinicId: null, shortcut: canned.shortcut },
    });
    if (existing) {
      await prisma.cannedResponse.update({
        where: { id: existing.id },
        data: { content: canned.content },
      });
    } else {
      await prisma.cannedResponse.create({
        data: { clinicId: null, shortcut: canned.shortcut, content: canned.content },
      });
    }
  }

  const addressShortcuts: { clinic: string; shortcut: string }[] = [
    { clinic: "Clínica São Lucas", shortcut: "/endereco-saolucas" },
    { clinic: "Instituto Vida", shortcut: "/endereco-institutovida" },
    { clinic: "Clínica Bem Estar", shortcut: "/endereco-bemestar" },
  ];
  for (const { clinic: clinicTradeName, shortcut } of addressShortcuts) {
    const clinicData = clinicsData.find((c) => c.tradeName === clinicTradeName);
    const clinicId = clinics.get(clinicTradeName);
    if (!clinicData || !clinicId) continue;
    const content = `Nosso endereço: ${clinicData.address}, ${clinicData.neighborhood}, ${clinicData.city}.`;
    await prisma.cannedResponse.upsert({
      where: { clinicId_shortcut: { clinicId, shortcut } },
      update: { content },
      create: { clinicId, shortcut, content },
    });
  }

  console.log("Seed concluído.");
  console.log("\nCredenciais de teste:");
  console.log(`  Admin:  admin@marcacao.com.br / ${ADMIN_PASSWORD}`);
  for (const { staffEmail, tradeName } of clinicsData) {
    console.log(`  ${tradeName}: ${staffEmail} / ${CLINIC_PASSWORD}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
