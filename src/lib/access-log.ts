/** Registro de acesso a dados de paciente (LGPD) — regras puras. A gravação fica em
 * access-log-server.ts. */
export type AccessAction = "ABRIU_CONVERSA" | "ABRIU_FICHA" | "EDITOU_CADASTRO";

const LABELS: Record<AccessAction, string> = {
  ABRIU_CONVERSA: "Abriu a conversa",
  ABRIU_FICHA: "Abriu a ficha",
  EDITOU_CADASTRO: "Editou o cadastro",
};

export const READ_DEDUPE_MIN = 60;

export function accessActionLabel(action: string): string {
  return LABELS[action as AccessAction] ?? action;
}

/** Leitura (abrir conversa/ficha) do mesmo usuário na mesma conversa conta 1× por hora —
 * o chat recarrega mensagens toda hora e encheria o registro. Edição sempre conta. */
export function shouldRecordAccess(action: AccessAction, lastSameAt: Date | null, now: Date = new Date()): boolean {
  if (action === "EDITOU_CADASTRO") return true;
  return !lastSameAt || now.getTime() - lastSameAt.getTime() >= READ_DEDUPE_MIN * 60_000;
}
