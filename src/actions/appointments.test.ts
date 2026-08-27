import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createAppointment } from "./appointments";

/**
 * Teste de integração real: usa o Prisma Client configurado em DATABASE_URL
 * (hoje, o mesmo Supabase usado em desenvolvimento — este projeto não tem um
 * banco de testes isolado). Cria e sempre limpa os próprios registros depois.
 * Exige que `npx prisma db seed` já tenha rodado (usa um ClinicProcedure real).
 */
describe("createAppointment (integração)", () => {
  let clinicProcedureId: string;
  const createdAppointmentIds: string[] = [];

  beforeAll(async () => {
    const clinicProcedure = await prisma.clinicProcedure.findFirst({
      where: { procedure: { name: "Consulta - Clínica Geral" } },
    });
    if (!clinicProcedure) {
      throw new Error(
        "Nenhum ClinicProcedure encontrado. Rode `npx prisma db seed` antes de rodar os testes de integração."
      );
    }
    clinicProcedureId = clinicProcedure.id;
  });

  afterEach(async () => {
    if (createdAppointmentIds.length > 0) {
      await prisma.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
      createdAppointmentIds.length = 0;
    }
  });

  it("cria um agendamento com status PENDING e CPF/telefone normalizados", async () => {
    const appointment = await createAppointment({
      patientName: "Paciente Teste Integração",
      patientCpf: "123.456.789-09",
      patientPhone: "(11) 91234-5678",
      clinicProcedureId,
      date: "2026-10-01",
    });
    createdAppointmentIds.push(appointment.id);

    expect(appointment.status).toBe("PENDING");
    expect(appointment.patientCpf).toBe("12345678909");
    expect(appointment.patientPhone).toBe("11912345678");
    expect(appointment.clinicProcedureId).toBe(clinicProcedureId);
    expect(appointment.clinicProcedure.clinic.tradeName).toBeTruthy();
    expect(appointment.clinicProcedure.procedure.name).toBe("Consulta - Clínica Geral");

    const stored = await prisma.appointment.findUnique({ where: { id: appointment.id } });
    expect(stored).not.toBeNull();
  });

  it("grava a data como o mesmo dia em UTC, sem deslocamento de fuso horário", async () => {
    const appointment = await createAppointment({
      patientName: "Paciente Teste Fuso Horário",
      patientCpf: "98765432100",
      patientPhone: "11988887777",
      clinicProcedureId,
      date: "2026-12-25",
    });
    createdAppointmentIds.push(appointment.id);

    expect(appointment.date.toISOString()).toBe("2026-12-25T00:00:00.000Z");
  });

  it("grava timeSlot e notes quando enviados, null quando omitidos", async () => {
    const withExtras = await createAppointment({
      patientName: "Paciente Com Extras",
      patientCpf: "11122233477",
      patientPhone: "11999998888",
      clinicProcedureId,
      date: "2026-10-05",
      timeSlot: "14:30",
      notes: "Primeira consulta",
    });
    createdAppointmentIds.push(withExtras.id);
    expect(withExtras.timeSlot).toBe("14:30");
    expect(withExtras.notes).toBe("Primeira consulta");

    const withoutExtras = await createAppointment({
      patientName: "Paciente Sem Extras",
      patientCpf: "55566677800",
      patientPhone: "11999997777",
      clinicProcedureId,
      date: "2026-10-06",
    });
    createdAppointmentIds.push(withoutExtras.id);
    expect(withoutExtras.timeSlot).toBeNull();
    expect(withoutExtras.notes).toBeNull();
  });

  it("rejeita dados inválidos (regra do Zod) e não grava nada no banco", async () => {
    const countBefore = await prisma.appointment.count();

    await expect(
      createAppointment({
        patientName: "Jo",
        patientCpf: "123",
        patientPhone: "11912345678",
        clinicProcedureId,
        date: "2026-10-01",
      })
    ).rejects.toThrow();

    const countAfter = await prisma.appointment.count();
    expect(countAfter).toBe(countBefore);
  });
});
