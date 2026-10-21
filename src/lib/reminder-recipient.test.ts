import { describe, expect, it } from "vitest";
import { reminderRecipient } from "./reminder-recipient";

const now = new Date("2026-10-21T12:00:00Z");

describe("reminderRecipient", () => {
  it("paciente menor com responsável cadastrado: lembrete vai para o responsável", () => {
    const r = reminderRecipient({ patientPhone: "5577900000001", birthDate: new Date("2015-03-10"), guardianName: "Carla Souza", guardianPhone: "77999990000" }, now);
    expect(r).toEqual({ phone: "77999990000", toGuardian: true, guardianFirstName: "Carla" });
  });
  it("adulto, menor sem responsável ou sem data: vai para o paciente", () => {
    expect(reminderRecipient({ patientPhone: "P", birthDate: new Date("1980-01-01"), guardianName: "X", guardianPhone: "G" }, now).toGuardian).toBe(false);
    expect(reminderRecipient({ patientPhone: "P", birthDate: new Date("2015-01-01"), guardianName: null, guardianPhone: null }, now).phone).toBe("P");
    expect(reminderRecipient({ patientPhone: "P", birthDate: null, guardianName: "X", guardianPhone: "G" }, now).phone).toBe("P");
  });
});
