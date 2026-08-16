import { PrismaClient, ProcedureCategory, AppointmentType, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CITY = "Vitória da Conquista";

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
const AGENT_PASSWORD = "Atendente@123";
const PATIENT_PASSWORD = "Paciente@123";

const specialtiesData = [
  { name: "Clínica Geral" },
  { name: "Cardiologia" },
  { name: "Urologia" },
  { name: "Cirurgia Geral" },
  { name: "Ginecologia" },
  { name: "Ortopedia" },
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
    specialty: "Urologia",
    name: "Consulta - Urologia",
    description: "Avaliação urológica com médico especialista.",
    preparationInstructions: null,
  },
  {
    specialty: "Cirurgia Geral",
    name: "Consulta - Cirurgia Geral",
    description: "Avaliação pré ou pós-operatória com cirurgião geral.",
    preparationInstructions: "Trazer exames e laudos recentes, se houver.",
  },
  {
    specialty: "Ginecologia",
    name: "Consulta - Ginecologia",
    description: "Avaliação ginecológica de rotina.",
    preparationInstructions: null,
  },
  {
    specialty: "Ortopedia",
    name: "Consulta - Ortopedia",
    description: "Avaliação ortopédica com médico especialista.",
    preparationInstructions: null,
  },
];

const otherProceduresData: {
  name: string;
  category: ProcedureCategory;
  description: string;
  preparationInstructions: string | null;
}[] = [
  {
    name: "Ultrassonografia Abdominal",
    category: ProcedureCategory.EXAM,
    description: "Exame de imagem para avaliação de órgãos abdominais.",
    preparationInstructions: "Jejum de 8 horas e bexiga cheia no momento do exame.",
  },
  {
    name: "Tomografia Computadorizada",
    category: ProcedureCategory.EXAM,
    description: "Exame de imagem de alta precisão.",
    preparationInstructions: "Jejum de 4 horas caso haja uso de contraste.",
  },
  {
    name: "Hemograma Completo",
    category: ProcedureCategory.EXAM,
    description: "Exame de sangue para avaliação geral da saúde.",
    preparationInstructions: "Jejum de 8 horas recomendado.",
  },
  {
    name: "Eletrocardiograma (ECG)",
    category: ProcedureCategory.EXAM,
    description: "Exame para avaliação da atividade elétrica do coração.",
    preparationInstructions: "Não é necessário jejum. Evitar cremes ou óleos na região do peito.",
  },
  {
    name: "Sessão de Pilates",
    category: ProcedureCategory.EXAM,
    description: "Sessão individual ou em grupo de pilates terapêutico.",
    preparationInstructions: "Vir com roupas leves e confortáveis. Evitar refeições pesadas antes da sessão.",
  },
  {
    name: "Procedimento Urológico a Laser",
    category: ProcedureCategory.SURGERY,
    description: "Procedimento cirúrgico urológico minimamente invasivo, a laser.",
    preparationInstructions: "Jejum de 6 horas. Trazer exames pré-operatórios recentes e acompanhante.",
  },
];

const clinicsData = [
  {
    name: "Clinique Medical Ltda",
    tradeName: "Clinique Medical",
    cnpj: "11.222.333/0001-01",
    phone: "(77) 3421-1001",
    whatsapp: "(77) 99911-1001",
    address: "Av. Olívia Flores, 450",
    neighborhood: "Recreio",
    city: CITY,
    active: true,
    commissionRate: "12.00",
    rating: 4.6,
    reviewCount: 118,
    businessHours: defaultBusinessHours,
    staffEmail: null as string | null,
  },
  {
    name: "Clínica Cirúrgica Santa Clara Ltda",
    tradeName: "Clinica Cirurgica Santa Clara",
    cnpj: "22.333.444/0001-02",
    phone: "(77) 3421-1002",
    whatsapp: "(77) 99911-1002",
    address: "Rua Israel Pinheiro, 210",
    neighborhood: "Recreio",
    city: CITY,
    active: true,
    commissionRate: "15.00",
    rating: 4.8,
    reviewCount: 264,
    businessHours: defaultBusinessHours,
    staffEmail: "santaclara@clinica.com.br",
  },
  {
    name: "Imad Diagnóstico Por Imagem Ltda",
    tradeName: "Imad Diagnóstico Por Imagem",
    cnpj: "33.444.555/0001-03",
    phone: "(77) 3421-1003",
    whatsapp: "(77) 99911-1003",
    address: "Av. Otávio Santos, 1200",
    neighborhood: "Recreio",
    city: CITY,
    active: true,
    commissionRate: "13.50",
    rating: 4.7,
    reviewCount: 341,
    businessHours: defaultBusinessHours,
    staffEmail: "imad@clinica.com.br",
  },
  {
    name: "Acurae Serviços Médicos Ltda",
    tradeName: "Acurae",
    cnpj: "44.555.666/0001-04",
    phone: "(77) 3421-1004",
    whatsapp: "(77) 99911-1004",
    address: "Rua Marechal Deodoro, 88",
    neighborhood: "Centro",
    city: CITY,
    active: true,
    commissionRate: "12.00",
    rating: 4.5,
    reviewCount: 97,
    businessHours: defaultBusinessHours,
    staffEmail: null,
  },
  {
    name: "Clínica Essencial Ltda",
    tradeName: "Clinica Essencial",
    cnpj: "55.666.777/0001-05",
    phone: "(77) 3421-1005",
    whatsapp: "(77) 99911-1005",
    address: "Rua Napoleão Argolo, 300",
    neighborhood: "Candeias",
    city: CITY,
    active: true,
    commissionRate: "11.00",
    rating: 4.3,
    reviewCount: 62,
    businessHours: defaultBusinessHours,
    staffEmail: null,
  },
  {
    name: "Urolaser Serviços Urológicos Ltda",
    tradeName: "Urolaser",
    cnpj: "66.777.888/0001-06",
    phone: "(77) 3421-1006",
    whatsapp: "(77) 99911-1006",
    address: "Av. Otávio Santos, 980",
    neighborhood: "Recreio",
    city: CITY,
    active: true,
    commissionRate: "16.00",
    rating: 4.9,
    reviewCount: 156,
    businessHours: defaultBusinessHours,
    staffEmail: null,
  },
  {
    name: "Clínica Àgape Ltda",
    tradeName: "Clínica Àgape",
    cnpj: "77.888.999/0001-07",
    phone: "(77) 3421-1007",
    whatsapp: "(77) 99911-1007",
    address: "Praça Barão do Rio Branco, 55",
    neighborhood: "Centro",
    city: CITY,
    active: true,
    commissionRate: "10.00",
    rating: 4.4,
    reviewCount: 73,
    businessHours: defaultBusinessHours,
    staffEmail: null,
  },
  {
    name: "Studio Pilates Equilíbrio e Saúde Ltda",
    tradeName: "Studio Pilates Equilíbrio e Saúde",
    cnpj: "88.999.000/0001-08",
    phone: "(77) 3421-1008",
    whatsapp: "(77) 99911-1008",
    address: "Rua Silveira Martins, 120",
    neighborhood: "Candeias",
    city: CITY,
    active: true,
    commissionRate: "10.00",
    rating: 4.9,
    reviewCount: 44,
    businessHours: defaultBusinessHours,
    staffEmail: null,
  },
  {
    name: "Policlínica Mais Médico Ltda",
    tradeName: "Policlínica Mais Médico",
    cnpj: "99.000.111/0001-09",
    phone: "(77) 3421-1009",
    whatsapp: "(77) 99911-1009",
    address: "Rua Padre Alcides Souza, 75",
    neighborhood: "Centro",
    city: CITY,
    active: true,
    commissionRate: "12.50",
    rating: 4.2,
    reviewCount: 208,
    businessHours: defaultBusinessHours,
    staffEmail: null,
  },
  {
    name: "HSVP Prime Serviços Médicos Ltda",
    tradeName: "HSVP PRIME",
    cnpj: "10.111.222/0001-10",
    phone: "(77) 3421-1010",
    whatsapp: "(77) 99911-1010",
    address: "Av. Régis Pacheco, 640",
    neighborhood: "Centro",
    city: CITY,
    active: true,
    commissionRate: "14.00",
    rating: 4.8,
    reviewCount: 189,
    businessHours: defaultBusinessHours,
    staffEmail: null,
  },
  {
    name: "Sonnar Diagnósticos Ltda",
    tradeName: "Sonnar",
    cnpj: "21.222.333/0001-11",
    phone: "(77) 3421-1011",
    whatsapp: "(77) 99911-1011",
    address: "Rua Dois de Julho, 340",
    neighborhood: "Centro",
    city: CITY,
    active: true,
    commissionRate: "13.00",
    rating: 4.6,
    reviewCount: 131,
    businessHours: defaultBusinessHours,
    staffEmail: null,
  },
] as const;

const clinicProceduresData: {
  clinic: string;
  procedure: string;
  price: string;
  promotionalPrice: string | null;
  requiresAppointment: boolean;
  appointmentType: AppointmentType;
}[] = [
  // Clinique Medical
  {
    clinic: "Clinique Medical",
    procedure: "Consulta - Clínica Geral",
    price: "150.00",
    promotionalPrice: "120.00",
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  // Clinica Cirurgica Santa Clara
  {
    clinic: "Clinica Cirurgica Santa Clara",
    procedure: "Consulta - Cirurgia Geral",
    price: "280.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Clinica Cirurgica Santa Clara",
    procedure: "Consulta - Clínica Geral",
    price: "140.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  // Imad Diagnóstico Por Imagem
  {
    clinic: "Imad Diagnóstico Por Imagem",
    procedure: "Ultrassonografia Abdominal",
    price: "200.00",
    promotionalPrice: "170.00",
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Imad Diagnóstico Por Imagem",
    procedure: "Tomografia Computadorizada",
    price: "500.00",
    promotionalPrice: "450.00",
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  // Acurae
  {
    clinic: "Acurae",
    procedure: "Consulta - Clínica Geral",
    price: "130.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Acurae",
    procedure: "Consulta - Ginecologia",
    price: "220.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  // Clinica Essencial
  {
    clinic: "Clinica Essencial",
    procedure: "Consulta - Clínica Geral",
    price: "120.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Clinica Essencial",
    procedure: "Hemograma Completo",
    price: "50.00",
    promotionalPrice: null,
    requiresAppointment: false,
    appointmentType: AppointmentType.ARRIVAL_ORDER,
  },
  // Urolaser
  {
    clinic: "Urolaser",
    procedure: "Consulta - Urologia",
    price: "250.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Urolaser",
    procedure: "Procedimento Urológico a Laser",
    price: "1200.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  // Clínica Àgape
  {
    clinic: "Clínica Àgape",
    procedure: "Consulta - Clínica Geral",
    price: "110.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Clínica Àgape",
    procedure: "Consulta - Ortopedia",
    price: "200.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  // Studio Pilates Equilíbrio e Saúde
  {
    clinic: "Studio Pilates Equilíbrio e Saúde",
    procedure: "Sessão de Pilates",
    price: "90.00",
    promotionalPrice: "75.00",
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  // Policlínica Mais Médico
  {
    clinic: "Policlínica Mais Médico",
    procedure: "Consulta - Clínica Geral",
    price: "100.00",
    promotionalPrice: "80.00",
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Policlínica Mais Médico",
    procedure: "Consulta - Cardiologia",
    price: "230.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Policlínica Mais Médico",
    procedure: "Consulta - Ortopedia",
    price: "210.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Policlínica Mais Médico",
    procedure: "Consulta - Ginecologia",
    price: "215.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  // HSVP PRIME
  {
    clinic: "HSVP PRIME",
    procedure: "Consulta - Cardiologia",
    price: "300.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "HSVP PRIME",
    procedure: "Eletrocardiograma (ECG)",
    price: "100.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "HSVP PRIME",
    procedure: "Hemograma Completo",
    price: "60.00",
    promotionalPrice: null,
    requiresAppointment: false,
    appointmentType: AppointmentType.ARRIVAL_ORDER,
  },
  // Sonnar
  {
    clinic: "Sonnar",
    procedure: "Ultrassonografia Abdominal",
    price: "190.00",
    promotionalPrice: "160.00",
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Sonnar",
    procedure: "Hemograma Completo",
    price: "55.00",
    promotionalPrice: null,
    requiresAppointment: false,
    appointmentType: AppointmentType.ARRIVAL_ORDER,
  },
];

async function main() {
  // Este seed substitui integralmente os dados de teste anteriores (clínicas
  // de São Paulo/Rio de Janeiro) pela lista oficial de Vitória da Conquista.
  // Por isso, ao contrário de antes (só upsert), ele começa apagando tudo que
  // depende de Clinic/Procedure/User, em ordem segura de chaves estrangeiras,
  // antes de popular de novo. Roda contra o banco de DATABASE_URL — não é
  // seguro rodar isso contra um banco de produção com dados reais.
  console.log("Limpando dados anteriores...");
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.cannedResponse.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.clinicProcedure.deleteMany();
  await prisma.procedure.deleteMany();
  await prisma.specialty.deleteMany();
  await prisma.user.deleteMany();
  await prisma.clinic.deleteMany();

  console.log("Seeding especialidades...");
  const specialties = new Map<string, string>();
  for (const specialty of specialtiesData) {
    const record = await prisma.specialty.create({ data: specialty });
    specialties.set(record.name, record.id);
  }

  console.log("Seeding procedimentos (consultas)...");
  const procedures = new Map<string, string>();
  for (const proc of consultationProceduresData) {
    const record = await prisma.procedure.create({
      data: {
        name: proc.name,
        category: ProcedureCategory.CONSULTATION,
        description: proc.description,
        preparationInstructions: proc.preparationInstructions,
        specialtyId: specialties.get(proc.specialty),
      },
    });
    procedures.set(record.name, record.id);
  }

  console.log("Seeding procedimentos (exames, terapias e procedimentos)...");
  for (const proc of otherProceduresData) {
    const record = await prisma.procedure.create({
      data: {
        name: proc.name,
        category: proc.category,
        description: proc.description,
        preparationInstructions: proc.preparationInstructions,
      },
    });
    procedures.set(record.name, record.id);
  }

  console.log("Seeding clínicas parceiras de Vitória da Conquista...");
  const clinics = new Map<string, string>();
  for (const { staffEmail, ...clinic } of clinicsData) {
    const record = await prisma.clinic.create({ data: clinic });
    clinics.set(record.tradeName, record.id);
  }

  console.log("Seeding usuários de acesso...");
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.create({
    data: {
      name: "Administrador TIVDC",
      email: "admin@tivdc.com.br",
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
    },
  });

  const clinicPasswordHash = await bcrypt.hash(CLINIC_PASSWORD, 10);
  for (const { staffEmail, tradeName } of clinicsData) {
    if (!staffEmail) continue;
    const clinicId = clinics.get(tradeName);
    if (!clinicId) throw new Error(`Clínica não encontrada: ${tradeName}`);

    await prisma.user.create({
      data: {
        name: `Equipe ${tradeName}`,
        email: staffEmail,
        role: UserRole.CLINIC,
        passwordHash: clinicPasswordHash,
        clinicId,
      },
    });
  }

  // O papel "atendente" não existe como UserRole próprio no schema hoje — o
  // inbox de chat (/clinic/inbox) já é acessível por qualquer usuário
  // role=CLINIC. Por isso o atendente é criado como um segundo usuário CLINIC
  // na Santa Clara (mesma clínica do login "dono"), simulando duas contas de
  // equipe reais: quem administra e quem atende o WhatsApp no dia a dia.
  const agentPasswordHash = await bcrypt.hash(AGENT_PASSWORD, 10);
  const santaClaraId = clinics.get("Clinica Cirurgica Santa Clara");
  if (!santaClaraId) throw new Error("Clínica Santa Clara não encontrada para vincular o atendente.");
  await prisma.user.create({
    data: {
      name: "Atendente Santa Clara",
      email: "atendente@tivdc.com.br",
      role: UserRole.CLINIC,
      passwordHash: agentPasswordHash,
      clinicId: santaClaraId,
    },
  });

  // Paciente de teste: hoje o login de paciente autentica normalmente, mas o
  // app não tem uma área logada própria para PATIENT (o agendamento público é
  // guest-checkout e o login redireciona para "/"). Criado só porque foi
  // pedido explicitamente — não desbloqueia nenhuma tela nova.
  const patientPasswordHash = await bcrypt.hash(PATIENT_PASSWORD, 10);
  await prisma.user.create({
    data: {
      name: "Paciente Teste",
      email: "paciente@teste.com.br",
      role: UserRole.PATIENT,
      passwordHash: patientPasswordHash,
    },
  });

  console.log("Seeding vínculos clínica x procedimento (preços)...");
  const clinicProcedureIds = new Map<string, string>();
  for (const cp of clinicProceduresData) {
    const clinicId = clinics.get(cp.clinic);
    const procedureId = procedures.get(cp.procedure);
    if (!clinicId || !procedureId) {
      throw new Error(`Clínica ou procedimento não encontrado: ${cp.clinic} / ${cp.procedure}`);
    }
    const record = await prisma.clinicProcedure.create({
      data: {
        clinicId,
        procedureId,
        price: cp.price,
        promotionalPrice: cp.promotionalPrice,
        requiresAppointment: cp.requiresAppointment,
        appointmentType: cp.appointmentType,
      },
    });
    clinicProcedureIds.set(`${cp.clinic}::${cp.procedure}`, record.id);
  }

  console.log("Seeding agendamentos de exemplo...");
  const sampleAppointmentsData: {
    key: string;
    patientName: string;
    patientPhone: string;
    patientCpf: string;
    date: string;
    timeSlot: string | null;
    status: "PENDING" | "CONFIRMED" | "COMPLETED";
    paymentMethod: string | null;
  }[] = [
    {
      key: "Clinique Medical::Consulta - Clínica Geral",
      patientName: "Fernanda Oliveira",
      patientPhone: "77999110001",
      patientCpf: "11122233301",
      date: "2026-08-20",
      timeSlot: "09:00",
      status: "PENDING",
      paymentMethod: null,
    },
    {
      key: "Clinica Cirurgica Santa Clara::Consulta - Cirurgia Geral",
      patientName: "Carlos Mendes",
      patientPhone: "77999110002",
      patientCpf: "11122233302",
      date: "2026-08-22",
      timeSlot: "14:30",
      status: "CONFIRMED",
      paymentMethod: null,
    },
    {
      key: "Imad Diagnóstico Por Imagem::Ultrassonografia Abdominal",
      patientName: "Juliana Ramos",
      patientPhone: "77999110003",
      patientCpf: "11122233303",
      date: "2026-08-10",
      timeSlot: "10:15",
      status: "COMPLETED",
      paymentMethod: "Pix",
    },
    {
      key: "Urolaser::Consulta - Urologia",
      patientName: "Marcos Souza",
      patientPhone: "77999110004",
      patientCpf: "11122233304",
      date: "2026-08-25",
      timeSlot: "16:00",
      status: "PENDING",
      paymentMethod: null,
    },
    {
      key: "Policlínica Mais Médico::Consulta - Cardiologia",
      patientName: "Renata Costa",
      patientPhone: "77999110005",
      patientCpf: "11122233305",
      date: "2026-08-18",
      timeSlot: "08:30",
      status: "CONFIRMED",
      paymentMethod: null,
    },
    {
      key: "HSVP PRIME::Eletrocardiograma (ECG)",
      patientName: "Paulo Henrique",
      patientPhone: "77999110006",
      patientCpf: "11122233306",
      date: "2026-08-05",
      timeSlot: "11:00",
      status: "COMPLETED",
      paymentMethod: "Cartão",
    },
    {
      key: "Studio Pilates Equilíbrio e Saúde::Sessão de Pilates",
      patientName: "Beatriz Lima",
      patientPhone: "77999110007",
      patientCpf: "11122233307",
      date: "2026-08-19",
      timeSlot: "07:30",
      status: "CONFIRMED",
      paymentMethod: null,
    },
    {
      key: "Sonnar::Hemograma Completo",
      patientName: "Diego Ferreira",
      patientPhone: "77999110008",
      patientCpf: "11122233308",
      date: "2026-08-12",
      timeSlot: null,
      status: "COMPLETED",
      paymentMethod: "Dinheiro",
    },
  ];

  for (const appt of sampleAppointmentsData) {
    const clinicProcedureId = clinicProcedureIds.get(appt.key);
    if (!clinicProcedureId) {
      throw new Error(`ClinicProcedure não encontrado para agendamento de exemplo: ${appt.key}`);
    }
    await prisma.appointment.create({
      data: {
        patientName: appt.patientName,
        patientPhone: appt.patientPhone,
        patientCpf: appt.patientCpf,
        clinicProcedureId,
        date: new Date(appt.date),
        timeSlot: appt.timeSlot,
        status: appt.status,
        paymentMethod: appt.paymentMethod,
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
    await prisma.cannedResponse.create({
      data: { clinicId: null, shortcut: canned.shortcut, content: canned.content },
    });
  }

  const addressShortcuts: { clinic: string; shortcut: string }[] = [
    { clinic: "Clinica Cirurgica Santa Clara", shortcut: "/endereco-santaclara" },
    { clinic: "Imad Diagnóstico Por Imagem", shortcut: "/endereco-imad" },
  ];
  for (const { clinic: clinicTradeName, shortcut } of addressShortcuts) {
    const clinicData = clinicsData.find((c) => c.tradeName === clinicTradeName);
    const clinicId = clinics.get(clinicTradeName);
    if (!clinicData || !clinicId) continue;
    const content = `Nosso endereço: ${clinicData.address}, ${clinicData.neighborhood}, ${clinicData.city}.`;
    await prisma.cannedResponse.create({
      data: { clinicId, shortcut, content },
    });
  }

  console.log("Seed concluído.");
  console.log("\nCredenciais de acesso:");
  console.log(`  Admin:                    admin@tivdc.com.br / ${ADMIN_PASSWORD}`);
  console.log(`  Clínica (Santa Clara):    santaclara@clinica.com.br / ${CLINIC_PASSWORD}`);
  console.log(`  Clínica (Imad):           imad@clinica.com.br / ${CLINIC_PASSWORD}`);
  console.log(`  Atendente (inbox, Santa Clara): atendente@tivdc.com.br / ${AGENT_PASSWORD}`);
  console.log(`  Paciente (sem área própria):    paciente@teste.com.br / ${PATIENT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
