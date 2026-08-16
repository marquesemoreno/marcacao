import { describe, it, expect } from "vitest";
import { createAppointmentSchema } from "./appointment";

const validInput = {
  patientName: "Maria Silva",
  patientCpf: "123.456.789-00",
  patientPhone: "(11) 91234-5678",
  clinicProcedureId: "clx1y2z3a0001",
  date: "2026-09-10",
};

describe("createAppointmentSchema", () => {
  it("aceita um input válido e normaliza CPF/telefone para só dígitos", () => {
    const result = createAppointmentSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.patientCpf).toBe("12345678900");
      expect(result.data.patientPhone).toBe("11912345678");
    }
  });

  it("aceita timeSlot e notes quando presentes", () => {
    const result = createAppointmentSchema.safeParse({
      ...validInput,
      timeSlot: "14:30",
      notes: "Primeira consulta",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeSlot).toBe("14:30");
      expect(result.data.notes).toBe("Primeira consulta");
    }
  });

  it("aceita ausência de timeSlot e notes (campos opcionais)", () => {
    const result = createAppointmentSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejeita nome com menos de 3 caracteres", () => {
    const result = createAppointmentSchema.safeParse({ ...validInput, patientName: "Jo" });
    expect(result.success).toBe(false);
  });

  it("rejeita nome só com espaços em branco (trim)", () => {
    const result = createAppointmentSchema.safeParse({ ...validInput, patientName: "     " });
    expect(result.success).toBe(false);
  });

  it("rejeita CPF com menos de 11 dígitos", () => {
    const result = createAppointmentSchema.safeParse({ ...validInput, patientCpf: "123.456.789" });
    expect(result.success).toBe(false);
  });

  it("rejeita CPF com mais de 11 dígitos", () => {
    const result = createAppointmentSchema.safeParse({ ...validInput, patientCpf: "123456789001" });
    expect(result.success).toBe(false);
  });

  it("aceita telefone fixo com 10 dígitos (DDD + 8)", () => {
    const result = createAppointmentSchema.safeParse({ ...validInput, patientPhone: "1133334444" });
    expect(result.success).toBe(true);
  });

  it("aceita celular com 11 dígitos (DDD + 9)", () => {
    const result = createAppointmentSchema.safeParse({ ...validInput, patientPhone: "11912345678" });
    expect(result.success).toBe(true);
  });

  it("rejeita telefone com menos de 10 dígitos", () => {
    const result = createAppointmentSchema.safeParse({ ...validInput, patientPhone: "119999999" });
    expect(result.success).toBe(false);
  });

  it("rejeita telefone com mais de 11 dígitos", () => {
    const result = createAppointmentSchema.safeParse({ ...validInput, patientPhone: "119123456789" });
    expect(result.success).toBe(false);
  });

  it("rejeita clinicProcedureId vazio", () => {
    const result = createAppointmentSchema.safeParse({ ...validInput, clinicProcedureId: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita data vazia", () => {
    const result = createAppointmentSchema.safeParse({ ...validInput, date: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita quando campos obrigatórios estão ausentes", () => {
    const result = createAppointmentSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0]);
      expect(fields).toEqual(
        expect.arrayContaining(["patientName", "patientCpf", "patientPhone", "clinicProcedureId", "date"])
      );
    }
  });
});
