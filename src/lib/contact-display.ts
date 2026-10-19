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

const NAME_PARTICLES = new Set(["da", "das", "de", "do", "dos", "e"]);

/** Nome do paciente com cara de nome: "MARIA DA SILVA" / "maria da silva" → "Maria da Silva"
 * (mesmo tratamento da Agenda). Nome que já mistura maiúsculas e minúsculas é de alguém que
 * escreveu do jeito que quis (McDonald, De Souza) e não é mexido. */
export function formatPatientName(name: string): string {
  const text = name.trim().replace(/\s+/g, " ");
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (!letters) return text;
  const allUpper = letters === letters.toUpperCase();
  const allLower = letters === letters.toLowerCase();
  if (!allUpper && !allLower) return text;
  return text
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (i > 0 && NAME_PARTICLES.has(word)) return word;
      const [first, ...rest] = [...word];
      return (first ?? "").toLocaleUpperCase("pt-BR") + rest.join("");
    })
    .join(" ");
}
