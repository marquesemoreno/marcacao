/** Máscara e validação do formulário "Novo Contato" (F2) — puro, roda no navegador. */
import { isValidCpf } from "./cpf";

function localDigits(value: string): string {
  let d = value.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}

/** "(77) 9 9999-9999", formatando conforme a pessoa digita. */
export function maskWhatsAppInput(value: string): string {
  const d = localDigits(value);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const first = d.slice(2, 3);
  const mid = d.slice(3, 7);
  const end = d.slice(7, 11);
  return `(${ddd}) ${first}${mid ? ` ${mid}` : ""}${end ? `-${end}` : ""}`;
}

export function whatsAppInputError(value: string): string | null {
  const d = localDigits(value);
  if (!d) return "Informe o WhatsApp com DDD.";
  if (d.length < 11) return "Número incompleto: são o DDD + 9 dígitos.";
  if (d[0] === "0" || Number(d.slice(0, 2)) < 11) return "DDD inválido.";
  if (d[2] !== "9") return "Celular deve começar com 9 depois do DDD.";
  return null;
}

/** Formato salvo no banco: 55 + DDD + número. */
export function normalizeWhatsAppInput(value: string): string {
  return `55${localDigits(value)}`;
}

export function maskCpfInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** CPF é opcional no cadastro rápido — vazio não é erro. */
export function cpfInputError(value: string): string | null {
  const d = value.replace(/\D/g, "");
  if (!d) return null;
  if (d.length < 11) return "CPF incompleto.";
  return isValidCpf(d) ? null : "CPF inválido.";
}
