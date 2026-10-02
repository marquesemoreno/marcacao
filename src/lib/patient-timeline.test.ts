import { describe, it, expect } from "vitest";
import { buildPatientTimeline } from "./patient-timeline";

const d = (iso: string) => new Date(iso);

describe("buildPatientTimeline", () => {
  it("junta fontes diferentes, mais recente primeiro", () => {
    const events = buildPatientTimeline({
      conversationCreatedAt: d("2026-09-01T12:00:00Z"),
      acquisitionChannel: "Instagram Ads",
      stageChanges: [{ at: d("2026-09-02T12:00:00Z"), from: "NOVOS", to: "AGENDADO", author: "Lidiane" }],
      notes: [{ at: d("2026-09-03T12:00:00Z"), content: "✅ Paciente confirmou presença" }],
      broadcasts: [{ at: d("2026-09-04T12:00:00Z"), campaign: "Outubro Rosa", status: "SENT" }],
      reminders: [{ at: d("2026-09-05T12:00:00Z"), response: "CONFIRMED" }],
      appointments: [{ at: d("2026-09-06T12:00:00Z"), procedure: "Consulta", date: "10/09/2026", status: "PENDING" }],
      resolved: { at: d("2026-09-07T12:00:00Z"), reason: "AGENDAMENTO_CONCLUIDO" },
    });
    expect(events.map((e) => e.kind)).toEqual(["resolved", "appointment", "reminder", "broadcast", "note", "stage", "first_contact"]);
    expect(events.find((e) => e.kind === "stage")).toMatchObject({ title: "Etapa: Novo → Agendado", author: "Lidiane" });
    expect(events.find((e) => e.kind === "reminder")?.title).toBe("Lembrete de consulta: confirmou");
    expect(events.find((e) => e.kind === "first_contact")?.detail).toBe("Origem: Instagram Ads");
  });

  it("mudança automática sem autor e lembrete sem resposta", () => {
    const events = buildPatientTimeline({
      conversationCreatedAt: d("2026-09-01T12:00:00Z"),
      stageChanges: [{ at: d("2026-09-02T12:00:00Z"), from: "NOVOS", to: "TRIAGEM", author: null }],
      reminders: [{ at: d("2026-09-05T12:00:00Z"), response: null }],
    });
    expect(events.find((e) => e.kind === "stage")?.author).toBe("Automático");
    expect(events.find((e) => e.kind === "reminder")?.title).toBe("Lembrete de consulta enviado");
  });
});
