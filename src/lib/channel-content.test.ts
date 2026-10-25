import { describe, it, expect } from "vitest";
import { buildEmailContent, buildSmsContent } from "./channel-content";

const URL = "https://conectasaudevc.com.br/u/abc.123";

describe("buildEmailContent", () => {
  const base = {
    subject: "Olá {{nome}}, novidades da clínica",
    template: "Oi {{nome}},\nsua consulta de {{procedimento}} está liberada.",
    variables: { nome: "Maria", procedimento: "retorno" },
    technicalDirector: "Dr. Fulano — CRM-BA 12345",
    unsubscribeUrl: URL,
  };

  it("aplica as variáveis no assunto e no corpo", () => {
    const out = buildEmailContent(base);
    expect(out.subject).toBe("Olá Maria, novidades da clínica");
    expect(out.text).toContain("Oi Maria,");
    expect(out.text).toContain("consulta de retorno");
  });

  it("texto puro traz responsável técnico (CFM) e o link de descadastro", () => {
    const out = buildEmailContent(base);
    expect(out.text).toContain("Responsável técnico: Dr. Fulano — CRM-BA 12345");
    expect(out.text).toContain(URL);
  });

  it("sem responsável técnico, não inventa a linha", () => {
    const out = buildEmailContent({ ...base, technicalDirector: null });
    expect(out.text).not.toContain("Responsável técnico");
    expect(out.html).not.toContain("Responsável técnico");
  });

  it("HTML escapa valores das variáveis (sem injetar tag)", () => {
    const out = buildEmailContent({ ...base, variables: { nome: "<script>alert(1)</script>", procedimento: "x" } });
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
  });

  it("HTML preserva quebras de linha e linka o descadastro", () => {
    const out = buildEmailContent(base);
    expect(out.html).toContain("<br>");
    expect(out.html).toContain(`href="${URL}"`);
  });

  it("cabeçalhos de descadastro com um clique (exigência dos grandes provedores)", () => {
    const out = buildEmailContent(base);
    expect(out.headers["List-Unsubscribe"]).toBe(`<${URL}>`);
    expect(out.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("variável sem valor fica como está (não some em silêncio)", () => {
    const out = buildEmailContent({ ...base, variables: { nome: "Maria" } });
    expect(out.text).toContain("{{procedimento}}");
  });
});

describe("buildSmsContent", () => {
  const base = {
    template: "Oi {{nome}}, seu retorno está liberado.",
    variables: { nome: "Maria" },
    technicalDirector: null as string | null,
    unsubscribeUrl: URL,
  };

  it("aplica variáveis e acrescenta o link para sair", () => {
    const out = buildSmsContent(base);
    expect(out.text).toContain("Oi Maria, seu retorno está liberado.");
    expect(out.text).toContain(`Sair: ${URL}`);
  });

  it("não duplica o link se o texto já o trouxer", () => {
    const out = buildSmsContent({ ...base, template: `Oi {{nome}}. Sair: ${URL}` });
    expect(out.text.match(/conectasaudevc/g)?.length).toBe(1);
  });

  it("inclui o responsável técnico quando existe", () => {
    const out = buildSmsContent({ ...base, technicalDirector: "Dr. Fulano — CRM-BA 12345" });
    expect(out.text).toContain("RT: Dr. Fulano — CRM-BA 12345");
  });

  it("informa quantos créditos a mensagem consome", () => {
    const out = buildSmsContent(base);
    expect(out.credits).toBe(1);
    const longo = buildSmsContent({ ...base, template: "x".repeat(200) });
    expect(longo.credits).toBe(2);
  });
});
