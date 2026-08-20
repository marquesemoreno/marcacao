/**
 * Utility para verificação de horário de expediente da clínica
 * e mensagens automáticas fora de horário.
 */

export interface BusinessDayConfig {
  open?: string;
  close?: string;
  closed?: boolean;
}

export type BusinessHoursMap = Record<string, BusinessDayConfig>;

const DEFAULT_BUSINESS_HOURS: BusinessHoursMap = {
  seg: { open: "08:00", close: "18:00" },
  ter: { open: "08:00", close: "18:00" },
  qua: { open: "08:00", close: "18:00" },
  qui: { open: "08:00", close: "18:00" },
  sex: { open: "08:00", close: "18:00" },
  sab: { open: "08:00", close: "12:00" },
  dom: { closed: true },
};

const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export function checkClinicBusinessHours(
  businessHoursInput?: unknown,
  nowDate: Date = new Date()
): { isOpen: boolean; outOfHoursMessage: string } {
  const businessHours: BusinessHoursMap =
    businessHoursInput && typeof businessHoursInput === "object"
      ? (businessHoursInput as BusinessHoursMap)
      : DEFAULT_BUSINESS_HOURS;

  const dayKey = DAY_KEYS[nowDate.getDay()];
  const dayConfig = businessHours[dayKey] || DEFAULT_BUSINESS_HOURS[dayKey];

  if (!dayConfig || dayConfig.closed || !dayConfig.open || !dayConfig.close) {
    return {
      isOpen: false,
      outOfHoursMessage: getOutOfHoursMessage(businessHours),
    };
  }

  const hours = nowDate.getHours().toString().padStart(2, "0");
  const minutes = nowDate.getMinutes().toString().padStart(2, "0");
  const currentTimeStr = `${hours}:${minutes}`;

  const isOpen = currentTimeStr >= dayConfig.open && currentTimeStr <= dayConfig.close;

  return {
    isOpen,
    outOfHoursMessage: isOpen ? "" : getOutOfHoursMessage(businessHours),
  };
}

export function getOutOfHoursMessage(_businessHours?: BusinessHoursMap): string {
  return `🌙 *ATENDIMENTO FORA DE EXPEDIENTE*

Olá! No momento estamos fora do nosso horário de atendimento.

🕒 *Nossos Horários:*
• Segunda a Sexta: 08:00 às 18:00
• Sábado: 08:00 às 12:00

Sua mensagem foi recebida com sucesso! Para agilizar seu atendimento assim que nossa recepção abrir, por favor nos responda com:
1️⃣ Seu *Nome Completo*
2️⃣ Seu *CPF*
3️⃣ O *Procedimento ou Exame* que deseja realizar`;
}
