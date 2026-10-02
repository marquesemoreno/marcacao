/** Nome exibido de um contato em qualquer tela do painel (fila, cabeçalho, CRM, contatos,
 * ficha). O nome vem do pushName do WhatsApp, que muitas vezes é só emoji, "?" ou um id
 * numérico (LID) — nesses casos mostra o telefone formatado (C6/D4). */
import { formatPhone } from "./format";

/** Tem pelo menos uma letra e não é só um número longo (telefone/LID). */
export function isUsableContactName(name: string | null | undefined): boolean {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return false;
  if (/^\+?\d[\d\s-]{9,}$/.test(trimmed)) return false;
  return /\p{L}/u.test(trimmed);
}

export function displayName(contact: { name?: string | null; phone?: string | null; instagramUsername?: string | null }): string {
  if (isUsableContactName(contact.name)) return contact.name!.trim();
  if (contact.phone) return formatPhone(contact.phone);
  if (contact.instagramUsername) return `@${contact.instagramUsername}`;
  return "Contato sem número visível";
}
