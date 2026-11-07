import { describe, expect, it } from "vitest";
import { summarizeSlotRecovery } from "./slot-recovery";

describe("summarizeSlotRecovery (roteiro 4.2)", () => {
  it("conta vagas oferecidas, preenchidas, perdidas e em andamento", () => {
    const r = summarizeSlotRecovery(
      [{ status: "FILLED" }, { status: "FILLED" }, { status: "EXPIRED" }, { status: "OPEN" }],
      { waiting: 7, bookedManually: 2 },
      300,
    );
    expect(r).toEqual({
      offered: 4,
      filled: 2,
      expired: 1,
      open: 1,
      fillRate: 67, // 2 de 3 já decididas
      waiting: 7,
      bookedManually: 2,
      recovered: 4,
      recoveredRevenue: 1200,
    });
  });
  it("sem nada", () => {
    expect(summarizeSlotRecovery([], { waiting: 0, bookedManually: 0 }, null)).toMatchObject({ offered: 0, fillRate: null, recovered: 0, recoveredRevenue: null });
  });
});
