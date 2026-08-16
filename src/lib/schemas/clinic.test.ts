import { describe, it, expect } from "vitest";
import {
  updateClinicProcedureSchema,
  addClinicProcedureSchema,
  updateAppointmentStatusSchema,
  businessHoursSchema,
} from "./clinic";

describe("updateClinicProcedureSchema", () => {
  const valid = {
    price: "150.00",
    promotionalPrice: "120.00",
    requiresAppointment: "on",
    appointmentType: "SCHEDULED",
  };

  it("aceita um input válido vindo de FormData (strings)", () => {
    const result = updateClinicProcedureSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(150);
      expect(result.data.promotionalPrice).toBe(120);
      expect(result.data.requiresAppointment).toBe(true);
    }
  });

  it("trata preço promocional vazio como null", () => {
    const result = updateClinicProcedureSchema.safeParse({ ...valid, promotionalPrice: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.promotionalPrice).toBeNull();
    }
  });

  it("trata preço promocional ausente como null", () => {
    const withoutPromo = {
      price: valid.price,
      requiresAppointment: valid.requiresAppointment,
      appointmentType: valid.appointmentType,
    };
    const result = updateClinicProcedureSchema.safeParse(withoutPromo);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.promotionalPrice).toBeNull();
    }
  });

  it("rejeita preço zero ou negativo", () => {
    expect(updateClinicProcedureSchema.safeParse({ ...valid, price: "0" }).success).toBe(false);
    expect(updateClinicProcedureSchema.safeParse({ ...valid, price: "-10" }).success).toBe(false);
  });

  it("trata checkbox desmarcado (formData.get retorna null) como false", () => {
    // Checkbox HTML desmarcado não aparece no FormData — `formData.get(name)`
    // retorna `null` (a chave em si sempre é passada ao schema, ver src/actions/clinic.ts).
    const result = updateClinicProcedureSchema.safeParse({ ...valid, requiresAppointment: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requiresAppointment).toBe(false);
    }
  });

  it("rejeita appointmentType fora do enum", () => {
    const result = updateClinicProcedureSchema.safeParse({ ...valid, appointmentType: "QUALQUER_COISA" });
    expect(result.success).toBe(false);
  });
});

describe("addClinicProcedureSchema", () => {
  it("exige procedureId além dos campos de updateClinicProcedureSchema", () => {
    const result = addClinicProcedureSchema.safeParse({
      price: "100",
      requiresAppointment: "on",
      appointmentType: "SCHEDULED",
    });
    expect(result.success).toBe(false);
  });

  it("aceita quando procedureId está presente", () => {
    const result = addClinicProcedureSchema.safeParse({
      procedureId: "proc-1",
      price: "100",
      requiresAppointment: "on",
      appointmentType: "ARRIVAL_ORDER",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateAppointmentStatusSchema", () => {
  it("aceita todos os status válidos do enum", () => {
    for (const status of ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]) {
      expect(updateAppointmentStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejeita um status inexistente", () => {
    const result = updateAppointmentStatusSchema.safeParse({ status: "EM_ANDAMENTO" });
    expect(result.success).toBe(false);
  });
});

describe("businessHoursSchema", () => {
  it("aceita um dia fechado", () => {
    const result = businessHoursSchema.safeParse({
      seg: { closed: true },
      ter: { open: "08:00", close: "18:00" },
      qua: { open: "08:00", close: "18:00" },
      qui: { open: "08:00", close: "18:00" },
      sex: { open: "08:00", close: "18:00" },
      sab: { open: "08:00", close: "12:00" },
      dom: { closed: true },
    });
    expect(result.success).toBe(true);
  });

  it("rejeita quando falta um dia da semana", () => {
    const result = businessHoursSchema.safeParse({
      seg: { open: "08:00", close: "18:00" },
    });
    expect(result.success).toBe(false);
  });
});
