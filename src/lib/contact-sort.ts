import { isUsableContactName } from "./contact-display";

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** Lista de contatos do admin: quem tem nome de verdade primeiro (A–Z); quem só tem
 * telefone, ID ou emoji como nome vai para o fim, por telefone. Em ordem alfabética pura,
 * os números vinham antes das letras e a primeira tela era só telefone. */
export function sortContactsNamedFirst<T extends { name: string; phone?: string | null }>(items: T[]): T[] {
  const named = items.filter((i) => isUsableContactName(i.name));
  const nameless = items.filter((i) => !isUsableContactName(i.name));
  named.sort((a, b) => collator.compare(a.name.trim(), b.name.trim()));
  nameless.sort((a, b) => (a.phone ?? "").localeCompare(b.phone ?? ""));
  return [...named, ...nameless];
}
