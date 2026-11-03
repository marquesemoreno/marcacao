/** Funções dos usuários da clínica (fase 4 da jornada, 02/11/2026 — substitui o "Gestão"
 * sim/não). Uma tabela só, aprovada pelo dono: Recepção atende; Marketing dispara e vê
 * relatórios, sem ficha prévia (dado de saúde); Gestão pode tudo. */

export const CLINIC_ROLES = ["RECEPCAO", "MARKETING", "GESTAO", "MEDICO"] as const;
export type ClinicRole = (typeof CLINIC_ROLES)[number];

export const CLINIC_ROLE_LABEL: Record<ClinicRole, string> = {
  RECEPCAO: "Recepção",
  MARKETING: "Marketing",
  GESTAO: "Gestão",
  MEDICO: "Médico",
};

/** atendimento = Chat, CRM, Agenda, Pacientes, Marcadores, Ações da IA.
 * ficha.ver = respostas da ficha prévia. disparos = campanhas, régua, aceites.
 * relatorios = Relatórios (inclui NPS). config = Ficha/Retorno (configurar), Acessos,
 * WhatsApp, Configurações. chamar = chamar paciente no painel da TV (o Médico só vê os
 * pacientes dele, ligado por User.doctorName). */
export type ClinicPermission = "atendimento" | "ficha.ver" | "disparos" | "relatorios" | "config" | "chamar";

const MATRIX: Record<ClinicRole, ClinicPermission[]> = {
  RECEPCAO: ["atendimento", "ficha.ver", "chamar"],
  MARKETING: ["atendimento", "disparos", "relatorios"],
  GESTAO: ["atendimento", "ficha.ver", "disparos", "relatorios", "config", "chamar"],
  MEDICO: ["chamar"],
};

export function can(role: ClinicRole, permission: ClinicPermission): boolean {
  return MATRIX[role].includes(permission);
}

export function parseClinicRole(v: unknown): ClinicRole {
  return (CLINIC_ROLES as readonly unknown[]).includes(v) ? (v as ClinicRole) : "RECEPCAO";
}
