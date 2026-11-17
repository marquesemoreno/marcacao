import { describe, expect, it } from "vitest";
import { toPublicClinic } from "./public-clinic";

const clinic = {
  id: "c1",
  name: "Clínica Exemplo Ltda",
  tradeName: "Clínica Exemplo",
  cnpj: "12.345.678/0001-90",
  phone: "7733334444",
  whatsapp: "77999990000",
  address: "Rua A, 10",
  neighborhood: "Centro",
  city: "Vitória da Conquista",
  active: true,
  listedInMarketplace: true,
  commissionRate: 12.5,
  rating: 4.8,
  reviewCount: 31,
  businessHours: { seg: "08:00-18:00" },
  welcomeMessageText: "Olá!",
  technicalDirectorName: "Dr. Fulano",
  technicalDirectorCrm: "CRM 123",
  googleReviewUrl: "https://g.page/x",
  defaultTicket: 250,
  campaignExcludedPatientIds: [10, 20],
  arrivalLat: -14.86,
  arrivalLng: -40.84,
  arrivalRadiusM: 150,
  createdAt: new Date("2026-01-01"),
};

describe("toPublicClinic", () => {
  it("mantém o que o site mostra", () => {
    const p = toPublicClinic(clinic);
    expect(p).toMatchObject({
      id: "c1",
      tradeName: "Clínica Exemplo",
      phone: "7733334444",
      address: "Rua A, 10",
      neighborhood: "Centro",
      city: "Vitória da Conquista",
      rating: 4.8,
      reviewCount: 31,
    });
  });

  it("esvazia o que é interno, sem mudar o formato", () => {
    const p = toPublicClinic(clinic);
    expect(Object.keys(p).sort()).toEqual(Object.keys(clinic).sort());
    expect(p.cnpj).toBe("");
    expect(p.commissionRate).toBe(0);
    expect(p.defaultTicket).toBe(0);
    expect(p.campaignExcludedPatientIds).toEqual([]);
    expect(p.arrivalLat).toBe(0);
    expect(p.arrivalLng).toBe(0);
    expect(p.welcomeMessageText).toBe("");
    expect(p.technicalDirectorCrm).toBe("");
    expect(p.googleReviewUrl).toBe("");
  });

  it("campo novo no cadastro da clínica não sai sozinho", () => {
    const p = toPublicClinic({ ...clinic, segredoNovo: "x" });
    expect(p.segredoNovo).toBe("");
  });
});
