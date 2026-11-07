import { describe, expect, it } from "vitest";
import { stageFromStaffMessage } from "./auto-funnel-stage";

describe("stageFromStaffMessage (orçamento/agendado automático)", () => {
  it("valor enviado pela recepção → Orçamento", () => {
    expect(stageFromStaffMessage("Consulta R$250,00", "NOVOS")).toBe("ORCAMENTO");
    expect(stageFromStaffMessage("Biopsia de Prostata com anestesia local R$ 1.500,00", "TRIAGEM")).toBe("ORCAMENTO");
    expect(stageFromStaffMessage("Fazemos sim! O valor particular é R$ 350 e atendemos Unimed.", "NOVOS")).toBe("ORCAMENTO");
    expect(stageFromStaffMessage("ENDOSCOPIA ESTÁ NO VALOR DE R$ 330,00 REAIS. SENDO R$ 300,00 PAGO NA SANTA CLARA", "NOVOS")).toBe("ORCAMENTO");
  });
  it("confirmação 'Agendada…' → Agendado, mesmo com valor", () => {
    expect(stageFromStaffMessage("Agendada CONSULTA com Dr (a) ALAN para o dia 23/10! Valor R$ 250,00", "NOVOS")).toBe("AGENDADO");
    expect(stageFromStaffMessage("Agendado 25-09 às 08:00h ordem de chegada", "ORCAMENTO")).toBe("AGENDADO");
  });
  it("nunca volta de etapa nem repete", () => {
    expect(stageFromStaffMessage("Consulta R$250,00", "ORCAMENTO")).toBeNull();
    expect(stageFromStaffMessage("Consulta R$250,00", "AGENDADO")).toBeNull();
    expect(stageFromStaffMessage("Agendado para terça", "AGENDADO")).toBeNull();
  });
  it("pagamento, recibo e valor irrisório não são orçamento", () => {
    expect(stageFromStaffMessage("Recebemos o pagamento de R$ 250,00, obrigado!", "NOVOS")).toBeNull();
    expect(stageFromStaffMessage("Segue o comprovante R$ 250,00", "NOVOS")).toBeNull();
    expect(stageFromStaffMessage("Nota fiscal no valor de R$ 250,00", "NOVOS")).toBeNull();
    expect(stageFromStaffMessage("taxa de R$ 5,00", "NOVOS")).toBeNull();
    expect(stageFromStaffMessage("Bom dia! Tudo bem?", "NOVOS")).toBeNull();
    expect(stageFromStaffMessage("", "NOVOS")).toBeNull();
  });
});
