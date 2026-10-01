import { describe, it, expect } from "vitest";
import { sanitizePromptForAI, restoreTokensFromVault, maskSensitiveLog } from "./lgpd-sanitizer";

describe("sanitizePromptForAI", () => {
  it("mascara um CPF matematicamente válido", () => {
    const { sanitizedText, vault } = sanitizePromptForAI("Meu CPF é 529.982.247-25, pode confirmar?");
    expect(sanitizedText).toBe("Meu CPF é {{PATIENT_CPF_1}}, pode confirmar?");
    expect(vault.get("{{PATIENT_CPF_1}}")).toBe("529.982.247-25");
  });

  it("não mascara uma sequência de 11 dígitos que não é um CPF válido", () => {
    const { sanitizedText, vault } = sanitizePromptForAI("Protocolo 111.111.111-11 aberto.");
    expect(sanitizedText).toBe("Protocolo 111.111.111-11 aberto.");
    expect(vault.size).toBe(0);
  });

  it("mascara telefone com e sem o 9º dígito", () => {
    const { sanitizedText } = sanitizePromptForAI("Me liga no (77) 99100-0524 ou no (77) 3724-7740.");
    expect(sanitizedText).toContain("{{PATIENT_PHONE_1}}");
    expect(sanitizedText).toContain("{{PATIENT_PHONE_2}}");
    expect(sanitizedText).not.toMatch(/\d{4,}/);
  });

  it("mascara e-mail", () => {
    const { sanitizedText, vault } = sanitizePromptForAI("Meu e-mail é joao.silva@gmail.com");
    expect(sanitizedText).toBe("Meu e-mail é {{PATIENT_EMAIL_1}}");
    expect(vault.get("{{PATIENT_EMAIL_1}}")).toBe("joao.silva@gmail.com");
  });

  it("só mascara nomes conhecidos passados explicitamente, não nomes arbitrários", () => {
    const { sanitizedText } = sanitizePromptForAI("Aqui é a Maria Silva, meu médico é o Dr. João Pedro.", [
      "Maria Silva",
    ]);
    expect(sanitizedText).toBe("Aqui é a {{PATIENT_NAME_1}}, meu médico é o Dr. João Pedro.");
  });

  it("reaproveita o mesmo token pro mesmo valor repetido", () => {
    const { sanitizedText, vault } = sanitizePromptForAI("CPF 529.982.247-25. Confirma: 529.982.247-25.");
    expect(sanitizedText).toBe("CPF {{PATIENT_CPF_1}}. Confirma: {{PATIENT_CPF_1}}.");
    expect(vault.size).toBe(1);
  });

  it("não mascara nada quando o texto não tem PII reconhecível", () => {
    const { sanitizedText, vault } = sanitizePromptForAI("Pedido de exame: USG Abdome Total.");
    expect(sanitizedText).toBe("Pedido de exame: USG Abdome Total.");
    expect(vault.size).toBe(0);
  });
});

describe("restoreTokensFromVault", () => {
  it("restaura o valor original a partir do token", () => {
    const { sanitizedText, vault } = sanitizePromptForAI("CPF 529.982.247-25");
    expect(restoreTokensFromVault(sanitizedText, vault)).toBe("CPF 529.982.247-25");
  });

  it("é inofensivo em texto sem token nenhum", () => {
    const vault = new Map<string, string>();
    expect(restoreTokensFromVault("texto qualquer", vault)).toBe("texto qualquer");
  });
});

describe("maskSensitiveLog", () => {
  it("mascara CPF no formato de auditoria (3 primeiros + 2 últimos dígitos)", () => {
    expect(maskSensitiveLog("CPF 529.982.247-25")).toBe("CPF 529.***.**7-25");
  });

  it("mascara telefone celular mantendo DDD e os últimos 4 dígitos visíveis", () => {
    expect(maskSensitiveLog("(77) 99100-0524")).toBe("(77) 9****-0524");
  });

  it("mascara e-mail mantendo só a 1ª letra do usuário", () => {
    expect(maskSensitiveLog("joao@gmail.com")).toBe("j***@gmail.com");
  });

  it("é irreversível — não existe função pra voltar do texto mascarado", () => {
    const masked = maskSensitiveLog("CPF 529.982.247-25");
    expect(masked).not.toContain("529.982.247-25");
  });
});
