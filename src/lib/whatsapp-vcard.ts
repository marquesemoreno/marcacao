/**
 * Cartões de contato do WhatsApp (contactMessage / contactsArrayMessage do Baileys).
 * Puro, sem "server-only" — usado pelo webhook e pelo scripts/recover-evolution-messages.ts.
 */

export type VcardContact = { name: string | null; phone: string | null };

/** Extrai nome (FN) e telefone (waid= da linha TEL, senão os dígitos da linha TEL). */
export function parseVcard(vcard: string): VcardContact {
  const lines = vcard.split(/\r?\n/);
  const fn = lines.find((l) => /^FN[:;]/i.test(l));
  const name = fn ? fn.slice(fn.indexOf(":") + 1).trim() || null : null;

  let phone: string | null = null;
  for (const line of lines) {
    if (!/^(item\d+\.)?TEL[:;]/i.test(line)) continue;
    const waid = line.match(/waid=(\d+)/i);
    const digits = waid ? waid[1] : line.slice(line.indexOf(":") + 1).replace(/\D/g, "");
    if (digits) {
      phone = digits;
      break;
    }
  }
  return { name, phone };
}

/** 5577991234567 → +55 77 99123-4567; 557734221100 → +55 77 3422-1100; resto → +dígitos. */
export function formatVcardPhone(digits: string): string {
  const m = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : `+${digits}`;
}

function cardLine(part: Record<string, unknown>): string {
  const parsed = typeof part.vcard === "string" ? parseVcard(part.vcard) : { name: null, phone: null };
  const name = (typeof part.displayName === "string" && part.displayName.trim()) || parsed.name || "Sem nome";
  return `📇 Contato: ${name}${parsed.phone ? ` — ${formatVcardPhone(parsed.phone)}` : ""}`;
}

/** Texto legível de um cartão (ou vários, um por linha); null se não for cartão de contato. */
export function formatContactCardMessage(message: Record<string, unknown> | undefined | null): string | null {
  const single = message?.contactMessage as Record<string, unknown> | undefined;
  if (single) return cardLine(single);
  const array = message?.contactsArrayMessage as Record<string, unknown> | undefined;
  const contacts = Array.isArray(array?.contacts) ? (array.contacts as Record<string, unknown>[]) : [];
  if (contacts.length === 0) return null;
  return contacts.map(cardLine).join("\n");
}
