import { describe, expect, it } from "vitest";
import { sortPatientList, type PatientSortItem } from "./patient-list";

const it_ = (over: Partial<PatientSortItem>): PatientSortItem => ({
  id: "x",
  name: "Zé",
  lastAt: new Date("2026-10-15T10:00:00Z"),
  waitingSince: null,
  ...over,
});

describe("sortPatientList", () => {
  const items = [
    it_({ id: "a", name: "Ana", lastAt: new Date("2026-10-15T09:00:00Z") }),
    it_({ id: "b", name: "Bia", waitingSince: new Date("2026-10-15T08:00:00Z"), lastAt: new Date("2026-10-15T08:00:00Z") }),
    it_({ id: "c", name: "Caio", waitingSince: new Date("2026-10-14T08:00:00Z"), lastAt: new Date("2026-10-14T08:00:00Z") }),
    it_({ id: "d", name: "Duda", lastAt: new Date("2026-10-15T11:00:00Z") }),
  ];
  it("espera: quem espera há mais tempo primeiro, depois os demais por última conversa", () => {
    expect(sortPatientList(items, "espera").map((i) => i.id)).toEqual(["c", "b", "d", "a"]);
  });
  it("nome: alfabética", () => {
    expect(sortPatientList(items, "nome").map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("recentes: última conversa mais nova primeiro", () => {
    expect(sortPatientList(items, "recentes").map((i) => i.id)).toEqual(["d", "a", "b", "c"]);
  });
});
