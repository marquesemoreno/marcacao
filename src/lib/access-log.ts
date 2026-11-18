/** Registro de acesso a dados de paciente (LGPD) — regras puras. A gravação fica em
 * access-log-server.ts. */
/** SUPORTE_* = equipe TIVDC pelo painel admin (auditoria 16/11/2026, M9: o admin lia
 * conversas de qualquer clínica sem deixar registro). */
export type AccessAction =
  | "ABRIU_CONVERSA"
  | "ABRIU_FICHA"
  | "EDITOU_CADASTRO"
  | "VIU_FICHA_PREVIA"
  | "VIU_RESUMO_AGENDA"
  | "EXPORTOU_DADOS"
  | "SUPORTE_ABRIU_CONVERSA"
  | "SUPORTE_EDITOU_CADASTRO";

/** Acesso a muitos pacientes de uma vez (lista com CPF/convênio, busca) — sem conversa
 * única, fica em audit_logs com a quantidade. Nunca guarda o termo buscado (pode ser CPF). */
export type BulkAccessAction = "LISTOU_PACIENTES" | "BUSCOU_PACIENTES";
export const BULK_ACCESS_ENTITY = "patient_bulk_access";

const LABELS: Record<AccessAction | BulkAccessAction, string> = {
  VIU_RESUMO_AGENDA: "Viu o resumo do paciente na Agenda",
  EXPORTOU_DADOS: "Gerou o arquivo dos dados do titular (LGPD)",
  SUPORTE_ABRIU_CONVERSA: "Suporte (TIVDC) abriu a conversa",
  SUPORTE_EDITOU_CADASTRO: "Suporte (TIVDC) editou o cadastro",
  LISTOU_PACIENTES: "Abriu a lista de pacientes",
  BUSCOU_PACIENTES: "Buscou pacientes",
  ABRIU_CONVERSA: "Abriu a conversa",
  ABRIU_FICHA: "Abriu a ficha",
  EDITOU_CADASTRO: "Editou o cadastro",
  VIU_FICHA_PREVIA: "Viu a ficha prévia (anamnese)",
};

export const READ_DEDUPE_MIN = 60;

export function accessActionLabel(action: string): string {
  return LABELS[action as AccessAction] ?? action;
}

/** Leitura (abrir conversa/ficha) do mesmo usuário na mesma conversa conta 1× por hora —
 * o chat recarrega mensagens toda hora e encheria o registro. Edição sempre conta. */
export function shouldRecordAccess(action: AccessAction, lastSameAt: Date | null, now: Date = new Date()): boolean {
  if (action === "EDITOU_CADASTRO" || action === "SUPORTE_EDITOU_CADASTRO" || action === "EXPORTOU_DADOS") return true;
  return !lastSameAt || now.getTime() - lastSameAt.getTime() >= READ_DEDUPE_MIN * 60_000;
}
