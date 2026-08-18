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
  { name: "Endocrinologia" },
  { name: "Proctologia" },
  { name: "Nutrição" },
  { name: "Cirurgia Pediátrica" },
  { name: "Anestesiologia" },
  { name: "Obstetrícia" },
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
];

/**
 * Tabela oficial de procedimentos e preços da Urolaser (2026) — ver
 * docs/obsidian/12 - Tabela de Precos e Procedimentos Urolaser.md.
 *
 * `tussCode`: só preenchido quando encontrado com uma única fonte clara e
 * sem divergência durante a pesquisa (feita via busca na web, não contra a
 * tabela oficial da ANS diretamente). Deixado `null` nos demais — são
 * procedimentos reais, só o código-índice de faturamento TUSS específico
 * não foi possível confirmar com segurança; a nota do Obsidian marca cada
 * um explicitamente como "confirmado" ou "pendente de conferência" pelo
 * setor de faturamento da clínica antes de usar em guias TISS de verdade.
 */
const urolaserProceduresData: {
  name: string;
  category: ProcedureCategory;
  specialty?: string;
  tussCode?: string;
  description: string;
  preparationInstructions?: string;
}[] = [
  // --- Consultas novas (Consulta - Urologia e Consulta - Ginecologia já existem) ---
  {
    name: "Consulta - Endocrinologia",
    category: ProcedureCategory.CONSULTATION,
    specialty: "Endocrinologia",
    tussCode: "10101012",
    description: "Avaliação endocrinológica com médico especialista.",
  },
  {
    name: "Consulta - Proctologia",
    category: ProcedureCategory.CONSULTATION,
    specialty: "Proctologia",
    tussCode: "10101012",
    description: "Avaliação proctológica com médico especialista.",
  },
  {
    name: "Consulta - Nutrição c/ Bioimpedância",
    category: ProcedureCategory.CONSULTATION,
    specialty: "Nutrição",
    description: "Consulta nutricional com avaliação de composição corporal por bioimpedância inclusa.",
    preparationInstructions: "Jejum de 4 horas, evitar exercício físico intenso nas 24h anteriores e vir com roupas leves.",
  },
  {
    name: "Consulta - Cirurgia Pediátrica",
    category: ProcedureCategory.CONSULTATION,
    specialty: "Cirurgia Pediátrica",
    tussCode: "10101012",
    description: "Avaliação cirúrgica pediátrica com médico especialista.",
  },
  {
    name: "Consulta - Pré-Anestésica",
    category: ProcedureCategory.CONSULTATION,
    specialty: "Anestesiologia",
    tussCode: "10101012",
    description: "Avaliação pré-anestésica obrigatória antes de procedimentos com sedação ou anestesia.",
    preparationInstructions: "Trazer exames pré-operatórios solicitados e lista de medicamentos em uso.",
  },
  {
    name: "Consulta - Obstétrica",
    category: ProcedureCategory.CONSULTATION,
    specialty: "Obstetrícia",
    tussCode: "10101012",
    description: "Acompanhamento pré-natal com médico obstetra.",
  },

  // --- Procedimentos urológicos ---
  {
    name: "Biópsia de Próstata Local",
    category: ProcedureCategory.SURGERY,
    specialty: "Urologia",
    tussCode: "40902030",
    description: "Biópsia de próstata guiada por ultrassom transretal, sob anestesia local.",
    preparationInstructions: "Preparo intestinal e antibiótico profilático conforme orientação médica. Vir acompanhado.",
  },
  {
    name: "Biópsia Endoscópica Bexiga",
    category: ProcedureCategory.SURGERY,
    specialty: "Urologia",
    description: "Biópsia de lesão vesical por via endoscópica (cistoscopia).",
    preparationInstructions: "Jejum de 6 horas. Trazer exames de imagem recentes.",
  },
  {
    name: "Biópsia Peniana",
    category: ProcedureCategory.SURGERY,
    specialty: "Urologia",
    description: "Biópsia de lesão peniana sob anestesia local.",
  },
  {
    name: "Cistoscopia",
    category: ProcedureCategory.SURGERY,
    specialty: "Urologia",
    description: "Exame endoscópico da uretra e bexiga.",
    preparationInstructions: "Não é necessário jejum. Vir com a bexiga vazia.",
  },
  {
    name: "Dilatação Uretral",
    category: ProcedureCategory.SURGERY,
    specialty: "Urologia",
    tussCode: "31102085",
    description: "Dilatação endoscópica da uretra para tratamento de estenose.",
  },
  {
    name: "Urodinâmica Completa",
    category: ProcedureCategory.EXAM,
    specialty: "Urologia",
    description: "Estudo urodinâmico completo para avaliação funcional da bexiga e uretra.",
    preparationInstructions: "Vir com a bexiga cheia, sem urinar 2 horas antes do exame.",
  },
  {
    name: "Urofluxometria",
    category: ProcedureCategory.EXAM,
    specialty: "Urologia",
    description: "Medição do fluxo urinário.",
    preparationInstructions: "Vir com vontade de urinar (bexiga confortavelmente cheia).",
  },
  {
    name: "Peniscopia",
    category: ProcedureCategory.EXAM,
    specialty: "Urologia",
    description: "Exame de mapeamento peniano com ácido acético, para rastreio de lesões por HPV.",
  },
  {
    name: "Retirada Duplo J",
    category: ProcedureCategory.SURGERY,
    specialty: "Urologia",
    tussCode: "31103472",
    description: "Retirada endoscópica de cateter ureteral duplo J.",
    preparationInstructions: "Jejum de 6 horas.",
  },
  {
    name: "Eletrocoagulação",
    category: ProcedureCategory.SURGERY,
    specialty: "Urologia",
    description: "Eletrocoagulação de lesões (verrugas genitais, condilomas) sob anestesia local.",
  },
  {
    name: "USG Próstata Abdominal",
    category: ProcedureCategory.EXAM,
    specialty: "Urologia",
    tussCode: "40901173",
    description: "Ultrassonografia de próstata por via abdominal.",
    preparationInstructions: "Vir com a bexiga cheia (beber água e não urinar 1 hora antes).",
  },
  {
    name: "USG Próstata Transretal",
    category: ProcedureCategory.EXAM,
    specialty: "Urologia",
    tussCode: "40901335",
    description: "Ultrassonografia de próstata por via transretal.",
    preparationInstructions: "Fazer um enema (lavagem intestinal) 2 horas antes do exame.",
  },
  {
    name: "USG Testicular com Doppler",
    category: ProcedureCategory.EXAM,
    specialty: "Urologia",
    tussCode: "40901203",
    description: "Ultrassonografia da bolsa escrotal com estudo Doppler do fluxo sanguíneo.",
  },
  {
    name: "USG Testicular simples",
    category: ProcedureCategory.EXAM,
    specialty: "Urologia",
    tussCode: "40901203",
    description: "Ultrassonografia da bolsa escrotal, sem Doppler.",
  },
  {
    name: "Cateterismo Vesical",
    category: ProcedureCategory.SURGERY,
    specialty: "Urologia",
    description: "Passagem de sonda vesical para alívio de retenção urinária ou coleta de amostra.",
  },
  {
    name: "Exérese de Lesão/Tumor",
    category: ProcedureCategory.SURGERY,
    specialty: "Urologia",
    description: "Retirada cirúrgica de lesão ou tumor de pele/subcutâneo, sob anestesia local.",
  },

  // --- Procedimentos ginecológicos ---
  {
    name: "Preventivo com Colposcopia",
    category: ProcedureCategory.EXAM,
    specialty: "Ginecologia",
    tussCode: "41301102",
    description: "Coleta de citologia oncótica (Papanicolau) associada a colposcopia.",
    preparationInstructions: "Evitar relações sexuais, duchas e uso de cremes vaginais nas 48h anteriores. Não agendar durante a menstruação.",
  },
  {
    name: "PCR HPV Genotipagem 28 tipos",
    category: ProcedureCategory.EXAM,
    specialty: "Ginecologia",
    description: "Pesquisa molecular por PCR com genotipagem de 28 tipos de HPV.",
  },
  {
    name: "Biópsia Colo Uterino",
    category: ProcedureCategory.SURGERY,
    specialty: "Ginecologia",
    tussCode: "31303021",
    description: "Biópsia de lesão do colo uterino identificada em colposcopia.",
  },
  {
    name: "USG Transvaginal",
    category: ProcedureCategory.EXAM,
    specialty: "Ginecologia",
    tussCode: "40901300",
    description: "Ultrassonografia transvaginal (útero, ovários e anexos).",
    preparationInstructions: "Vir com a bexiga vazia.",
  },
  {
    name: "USG Obstétrica",
    category: ProcedureCategory.EXAM,
    specialty: "Obstetrícia",
    description: "Ultrassonografia obstétrica para acompanhamento da gestação.",
    preparationInstructions: "No primeiro trimestre, vir com a bexiga cheia (a critério médico).",
  },
  {
    name: "USG Abdome Inferior",
    category: ProcedureCategory.EXAM,
    specialty: "Ginecologia",
    tussCode: "40901181",
    description: "Ultrassonografia de abdome inferior feminino (bexiga, útero, ovários e anexos).",
    preparationInstructions: "Vir com a bexiga cheia.",
  },
  {
    name: "Check-up Ginecológico Completo",
    category: ProcedureCategory.EXAM,
    specialty: "Ginecologia",
    description: "Pacote com consulta, preventivo e ultrassonografia transvaginal em um único atendimento.",
  },

  // --- Cirurgias / procedimentos com anestesia local ---
  {
    name: "Vasectomia Local",
    category: ProcedureCategory.SURGERY,
    specialty: "Urologia",
    tussCode: "31205046",
    description: "Vasectomia bilateral sob anestesia local.",
    preparationInstructions: "Jejum de 6 horas. Vir acompanhado e com cueca justa para usar após o procedimento.",
  },
  {
    name: "Postectomia Local",
    category: ProcedureCategory.SURGERY,
    specialty: "Urologia",
    tussCode: "31206220",
    description: "Postectomia (circuncisão) sob anestesia local.",
    preparationInstructions: "Jejum de 6 horas. Vir acompanhado.",
  },
  {
    name: "Implante DIU Mirena/Kyleena",
    category: ProcedureCategory.SURGERY,
    specialty: "Ginecologia",
    tussCode: "31303293",
    description: "Inserção de DIU hormonal (Mirena ou Kyleena) — dispositivo não incluso no valor do procedimento.",
    preparationInstructions: "Preferencialmente durante o período menstrual. Trazer o dispositivo já adquirido em farmácia.",
  },
  {
    name: "Implanon",
    category: ProcedureCategory.SURGERY,
    specialty: "Ginecologia",
    description: "Inserção de implante contraceptivo subdérmico (Implanon) — dispositivo não incluso no valor do procedimento.",
    preparationInstructions: "Trazer o dispositivo já adquirido em farmácia.",
  },
  {
    name: "DIU de Cobre",
    category: ProcedureCategory.SURGERY,
    specialty: "Ginecologia",
    tussCode: "31303269",
    description: "Inserção de DIU de cobre (não hormonal) — dispositivo não incluso no valor do procedimento.",
    preparationInstructions: "Preferencialmente durante o período menstrual. Trazer o dispositivo já adquirido em farmácia.",
  },

  // --- Psicologia e outros ---
  {
    name: "Sessão Psicoterapia",
    category: ProcedureCategory.EXAM,
    description: "Sessão individual de psicoterapia.",
  },
  {
    name: "Pacote 4 Sessões de Psicoterapia",
    category: ProcedureCategory.EXAM,
    description: "Pacote fechado com 4 sessões de psicoterapia.",
  },
  {
    name: "Aplicação de Injeção",
    category: ProcedureCategory.SURGERY,
    description: "Aplicação de medicamento injetável — medicamento não incluso no valor do procedimento.",
  },
  {
    name: "Bioimpedância",
    category: ProcedureCategory.EXAM,
    description: "Avaliação isolada de composição corporal por bioimpedância.",
    preparationInstructions: "Jejum de 4 horas, evitar exercício físico intenso nas 24h anteriores e vir com roupas leves.",
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
    tradeName: "Urolaser - Clínica de Urologia e Diagnóstico",
    cnpj: "66.777.888/0001-06",
    phone: "(77) 3422-1010",
    whatsapp: "(77) 98800-1010",
    address: "Av. Otávio Santos, 145",
    neighborhood: "Recreio",
    city: CITY,
    active: true,
    commissionRate: "16.00",
    rating: 4.9,
    reviewCount: 156,
    businessHours: defaultBusinessHours,
    staffEmail: "urolaser@clinica.com.br",
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
    name: "Hospital São Vicente Ltda",
    tradeName: "Hospital São Vicente",
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
    promotionalPrice: null,
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
    price: "145.00",
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
    price: "150.00",
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
  // Urolaser — Modo "Valor sob consulta / Negociação via WhatsApp"
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Consulta - Urologia", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Consulta - Ginecologia", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Consulta - Endocrinologia", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Consulta - Proctologia", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Consulta - Nutrição c/ Bioimpedância", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Consulta - Cirurgia Pediátrica", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Consulta - Pré-Anestésica", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Consulta - Obstétrica", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },

  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Biópsia de Próstata Local", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Biópsia Endoscópica Bexiga", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Biópsia Peniana", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Cistoscopia", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Dilatação Uretral", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Urodinâmica Completa", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Urofluxometria", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Peniscopia", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Retirada Duplo J", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Eletrocoagulação", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "USG Próstata Abdominal", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "USG Próstata Transretal", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "USG Testicular com Doppler", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "USG Testicular simples", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Cateterismo Vesical", price: "0.00", promotionalPrice: null, requiresAppointment: false, appointmentType: AppointmentType.ARRIVAL_ORDER },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Exérese de Lesão/Tumor", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },

  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Preventivo com Colposcopia", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "PCR HPV Genotipagem 28 tipos", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Biópsia Colo Uterino", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "USG Transvaginal", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "USG Obstétrica", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "USG Abdome Inferior", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Check-up Ginecológico Completo", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },

  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Vasectomia Local", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Postectomia Local", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Implante DIU Mirena/Kyleena", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Implanon", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "DIU de Cobre", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },

  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Sessão Psicoterapia", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Pacote 4 Sessões de Psicoterapia", price: "0.00", promotionalPrice: null, requiresAppointment: true, appointmentType: AppointmentType.SCHEDULED },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Aplicação de Injeção", price: "0.00", promotionalPrice: null, requiresAppointment: false, appointmentType: AppointmentType.ARRIVAL_ORDER },
  { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", procedure: "Bioimpedância", price: "0.00", promotionalPrice: null, requiresAppointment: false, appointmentType: AppointmentType.ARRIVAL_ORDER },
  // Clínica Àgape
  {
    clinic: "Clínica Àgape",
    procedure: "Consulta - Clínica Geral",
    price: "145.00",
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
    price: "160.00",
    promotionalPrice: "140.00",
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Policlínica Mais Médico",
    procedure: "Consulta - Cardiologia",
    price: "230.00",
    promotionalPrice: "140.00",
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
  // Hospital São Vicente
  {
    clinic: "Hospital São Vicente",
    procedure: "Consulta - Cardiologia",
    price: "300.00",
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Hospital São Vicente",
    procedure: "Eletrocardiograma (ECG)",
    price: "100.00",
    promotionalPrice: "50.00",
    requiresAppointment: true,
    appointmentType: AppointmentType.SCHEDULED,
  },
  {
    clinic: "Hospital São Vicente",
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
    promotionalPrice: "120.00",
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

  console.log("Seeding tabela oficial de procedimentos da Urolaser...");
  for (const proc of urolaserProceduresData) {
    const record = await prisma.procedure.create({
      data: {
        name: proc.name,
        category: proc.category,
        tussCode: proc.tussCode ?? null,
        description: proc.description,
        preparationInstructions: proc.preparationInstructions ?? null,
        specialtyId: proc.specialty ? specialties.get(proc.specialty) : undefined,
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
      key: "Urolaser - Clínica de Urologia e Diagnóstico::Consulta - Urologia",
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
      key: "Hospital São Vicente::Eletrocardiograma (ECG)",
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
      shortcut: "/preparo-jejum",
      content:
        "Lembrando que esse exame exige jejum de 8 horas. Pode beber água normalmente durante o período.",
    },
    {
      shortcut: "/pix",
      content:
        "O pagamento pode ser feito via Pix na hora do atendimento. Qualquer dúvida, é só chamar por aqui.",
    },
    {
      shortcut: "/horarios",
      content:
        "Atendemos de segunda a sexta, das 08h às 18h, e aos sábados das 08h às 12h. Qualquer alteração de horário avisamos por aqui.",
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
    { clinic: "Clinica Cirurgica Santa Clara", shortcut: "/endereco" },
    { clinic: "Imad Diagnóstico Por Imagem", shortcut: "/endereco" },
    { clinic: "Urolaser - Clínica de Urologia e Diagnóstico", shortcut: "/endereco" },
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
  console.log(`  Clínica (Urolaser):       urolaser@clinica.com.br / ${CLINIC_PASSWORD}`);
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
