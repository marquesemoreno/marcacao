import { isValidCpf } from "@/lib/cpf";
import { maskCpf } from "@/lib/format";

/**
 * Pseudonimização reversível em memória — antes de qualquer texto de paciente ir
 * pra um modelo de IA, substitui dados identificáveis por tokens (`{{PATIENT_*_n}}`).
 * O mapeamento token -> valor original vive só neste `Map` local do ciclo da
 * requisição (nunca gravado em disco/log/banco) — restaura na borda com
 * `restoreTokensFromVault` antes de mostrar pra recepcionista ou gravar no banco.
 */
export type SanitizationVault = Map<string, string>;

export interface SanitizeResult {
  sanitizedText: string;
  vault: SanitizationVault;
}

const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b/g;
/** Formato de telefone BR: DDI 55 opcional, DDD com/sem parênteses, celular (9
 * dígitos) ou fixo (8 dígitos) com separador opcional. Confere a contagem de
 * dígitos depois (10-13) em vez de tentar validar DDD/operadora — só precisa
 * reconhecer o FORMATO pra mascarar, não confirmar que o número existe. */
const PHONE_PATTERN = /(?:\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g;

/** Cria um masker com contador próprio por categoria — o mesmo valor (ex: o
 * mesmo CPF mencionado duas vezes no texto) sempre vira o mesmo token, pra IA
 * entender que é a mesma pessoa nas duas menções. */
function buildMasker(vault: SanitizationVault, prefix: string) {
  const valueToToken = new Map<string, string>();
  let counter = 0;
  return (rawValue: string): string => {
    const key = rawValue.trim();
    let token = valueToToken.get(key);
    if (!token) {
      counter += 1;
      token = `{{PATIENT_${prefix}_${counter}}}`;
      valueToToken.set(key, token);
      vault.set(token, key);
    }
    return token;
  };
}

export function sanitizePromptForAI(rawText: string, knownPatientNames: string[] = []): SanitizeResult {
  const vault: SanitizationVault = new Map();
  let text = rawText;

  const maskCpfToken = buildMasker(vault, "CPF");
  text = text.replace(CPF_PATTERN, (match) => (isValidCpf(match) ? maskCpfToken(match) : match));

  const maskEmailToken = buildMasker(vault, "EMAIL");
  text = text.replace(EMAIL_PATTERN, (match) => maskEmailToken(match));

  const maskPhoneToken = buildMasker(vault, "PHONE");
  text = text.replace(PHONE_PATTERN, (match) => {
    const digits = match.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13 ? maskPhoneToken(match) : match;
  });

  const knownNames = knownPatientNames.map((n) => n.trim()).filter(Boolean);
  if (knownNames.length > 0) {
    const maskNameToken = buildMasker(vault, "NAME");
    for (const name of knownNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const namePattern = new RegExp(`\\b${escaped}\\b`, "gi");
      text = text.replace(namePattern, () => maskNameToken(name));
    }
  }

  return { sanitizedText: text, vault };
}

/** Troca qualquer token `{{PATIENT_*_n}}` pelo valor real do vault — defensivo:
 * usado em qualquer texto livre que volte de um modelo de IA antes de exibir
 * pra recepcionista ou gravar no banco, mesmo que o fluxo específico não costume
 * ecoar um token de volta. */
export function restoreTokensFromVault(modelOutput: string, vault: SanitizationVault): string {
  let result = modelOutput;
  for (const [token, original] of vault) {
    result = result.split(token).join(original);
  }
  return result;
}

function maskEmailForLog(raw: string): string {
  const [local, domain] = raw.split("@");
  if (!domain) return raw;
  const visible = local.slice(0, 1) || "*";
  return `${visible}${"*".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

function maskPhoneForLog(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length < 10) return raw;
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  const firstDigit = rest[0];
  const last4 = rest.slice(-4);
  return `(${ddd}) ${firstDigit}****-${last4}`;
}

/** Anonimização permanente (não reversível) pra uso em logs/console/auditoria —
 * diferente de sanitizePromptForAI (reversível via vault), aqui não existe
 * vault nenhum, o dado mascarado é descartado de propósito. Ex: "123.***.**-45",
 * "(77) 9****-1234". Reaproveita maskCpf (format.ts), já usado na guia de
 * encaminhamento, pro trecho de CPF. */
export function maskSensitiveLog(text: string): string {
  let masked = text;
  masked = masked.replace(CPF_PATTERN, (match) => (isValidCpf(match) ? maskCpf(match) : match));
  masked = masked.replace(EMAIL_PATTERN, (match) => maskEmailForLog(match));
  masked = masked.replace(PHONE_PATTERN, (match) => {
    const digits = match.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13 ? maskPhoneForLog(match) : match;
  });
  return masked;
}
