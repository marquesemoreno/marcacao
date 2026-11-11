/** Público "Por tag" dos Disparos: pacientes da clínica que têm uma tag em alguma conversa.
 * Tag fica na conversa (Conversation.tags), então o mesmo telefone pode aparecer mais de uma
 * vez — aqui ele conta e recebe uma vez só. */
import type { ParsedBroadcastRecipient } from "./broadcast-csv";
import { displayName, isUsableContactName } from "./contact-display";
import { NON_PATIENT_TAG, WRONG_NUMBER_TAG } from "./conversation-tags";

export type TaggedConversation = { phone: string | null; name: string | null; tags: string[] };
export type TagAudienceOption = { tag: string; count: number };

/** Telefones que não recebem disparo por tag: número errado em qualquer conversa. */
function blockedPhones(rows: TaggedConversation[]): Set<string> {
  const blocked = new Set<string>();
  for (const r of rows) if (r.phone && r.tags.includes(WRONG_NUMBER_TAG)) blocked.add(r.phone);
  return blocked;
}

/** Quem não é paciente (fornecedor, parceiro, propaganda) só entra quando a tag pedida é a
 * própria "Não é paciente" — nunca de carona em outra tag. */
function belongsToTag(row: TaggedConversation, tag: string): boolean {
  if (!row.tags.includes(tag)) return false;
  return tag === NON_PATIENT_TAG || !row.tags.includes(NON_PATIENT_TAG);
}

export function countTagAudiences(rows: TaggedConversation[]): TagAudienceOption[] {
  const blocked = blockedPhones(rows);
  const phonesByTag = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.phone || blocked.has(row.phone)) continue;
    for (const tag of row.tags) {
      if (tag === WRONG_NUMBER_TAG || !belongsToTag(row, tag)) continue;
      const phones = phonesByTag.get(tag) ?? new Set<string>();
      phones.add(row.phone);
      phonesByTag.set(tag, phones);
    }
  }
  return [...phonesByTag.entries()]
    .map(([tag, phones]) => ({ tag, count: phones.size }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        Number(a.tag === NON_PATIENT_TAG) - Number(b.tag === NON_PATIENT_TAG) ||
        a.tag.localeCompare(b.tag, "pt-BR")
    );
}

export function buildTagAudience(rows: TaggedConversation[], tag: string): ParsedBroadcastRecipient[] {
  if (tag === WRONG_NUMBER_TAG) return [];
  const blocked = blockedPhones(rows);
  const seen = new Set<string>();
  const recipients: ParsedBroadcastRecipient[] = [];
  for (const row of rows) {
    if (!row.phone || blocked.has(row.phone) || seen.has(row.phone) || !belongsToTag(row, tag)) continue;
    seen.add(row.phone);
    const usable = isUsableContactName(row.name);
    const first = usable ? displayName(row).split(/\s+/)[0] : "";
    recipients.push({ phone: row.phone, variables: { nome: first, saudacao: usable ? `Oi, ${first}` : "Oi" } });
  }
  return recipients;
}
