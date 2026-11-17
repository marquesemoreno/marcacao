import { describe, expect, it } from "vitest";
import { guideLinkExpired, signGuideId, verifyGuideId } from "./guide-link";

const SECRET = "segredo-de-teste";
const ID = "cmh1abc2def3ghi4jkl5mno6";

describe("link da guia (auditoria M11)", () => {
  it("o link assinado volta o id do agendamento", () => {
    expect(verifyGuideId(signGuideId(ID, SECRET), SECRET)).toBe(ID);
  });

  it("id puro (link antigo) não abre", () => {
    expect(verifyGuideId(ID, SECRET)).toBeNull();
  });

  it("trocar o id mantendo a assinatura não abre outro agendamento", () => {
    const [, sig] = signGuideId(ID, SECRET).split(".");
    expect(verifyGuideId(`cmh1abc2def3ghi4jkl5mnoX`.toLowerCase() + "." + sig, SECRET)).toBeNull();
  });

  it("assinatura feita com outro segredo não abre", () => {
    expect(verifyGuideId(signGuideId(ID, "outro"), SECRET)).toBeNull();
  });

  it("lixo não abre", () => {
    expect(verifyGuideId("", SECRET)).toBeNull();
    expect(verifyGuideId("../etc.passwd", SECRET)).toBeNull();
  });

  it("vale até 7 dias depois da consulta", () => {
    const day = new Date("2026-11-20T00:00:00Z");
    expect(guideLinkExpired(day, new Date("2026-11-10T12:00:00Z"))).toBe(false);
    expect(guideLinkExpired(day, new Date("2026-11-27T23:00:00Z"))).toBe(false);
    expect(guideLinkExpired(day, new Date("2026-11-28T01:00:00Z"))).toBe(true);
  });
});
