import { describe, expect, it } from "vitest";
import { demoCloudAccount, demoCloudTemplates, DEMO_CLOUD_BLOCKED } from "./demo-cloud";

describe("demoCloudAccount", () => {
  it("usa o número da conta de origem (TIVDC) com o nome da clínica demo, ligada no Chat", () => {
    const a = demoCloudAccount({ displayPhoneNumber: "+55 77 99999-0000", wabaId: "111", phoneNumberId: "222" });
    expect(a).toMatchObject({
      displayPhoneNumber: "+55 77 99999-0000",
      wabaId: "111",
      phoneNumberId: "222",
      verifiedName: "Clínica Vida",
      active: true,
      coexistence: false,
      reminderTemplateName: "lembrete_consulta",
    });
  });
  it("sem conta de origem, cai num número fictício", () => {
    const a = demoCloudAccount(null);
    expect(a.displayPhoneNumber).toBe("+55 00 90000-0000");
    expect(a.active).toBe(true);
  });
});

describe("demoCloudTemplates", () => {
  it("traz o lembrete e os modelos da régua, todos aprovados, com contagem de variáveis", () => {
    const t = demoCloudTemplates();
    expect(t.map((x) => x.name)).toContain("lembrete_consulta");
    expect(t.map((x) => x.name)).toContain("pesquisa_nps");
    expect(t.every((x) => x.status === "APPROVED")).toBe(true);
    expect(t.find((x) => x.name === "lembrete_consulta")!.variableCount).toBe(4);
    expect(new Set(t.map((x) => x.id)).size).toBe(t.length);
  });
});

it("mensagem de bloqueio deixa claro que nada é enviado", () => {
  expect(DEMO_CLOUD_BLOCKED).toMatch(/demonstração/i);
});
