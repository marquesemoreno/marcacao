import { describe, expect, it } from "vitest";
import { distanceMeters, isInsideFence } from "./geo-fence";

const clinic = { lat: -14.8615, lng: -40.8442, radiusM: 150 };

describe("distanceMeters", () => {
  it("mesmo ponto = 0; ~111 m por 0,001° de latitude", () => {
    expect(distanceMeters(clinic, clinic)).toBe(0);
    expect(Math.round(distanceMeters(clinic, { lat: clinic.lat + 0.001, lng: clinic.lng }))).toBe(111);
  });
});

describe("isInsideFence", () => {
  it("dentro do raio", () => {
    expect(isInsideFence(clinic, { lat: clinic.lat + 0.001, lng: clinic.lng, accuracy: 20 })).toBe(true);
  });
  it("fora do raio", () => {
    expect(isInsideFence(clinic, { lat: clinic.lat + 0.01, lng: clinic.lng, accuracy: 20 })).toBe(false);
  });
  it("GPS impreciso dentro de prédio: soma a precisão até 200 m", () => {
    expect(isInsideFence(clinic, { lat: clinic.lat + 0.002, lng: clinic.lng, accuracy: 100 })).toBe(true); // 222 m ≤ 150+100
    expect(isInsideFence(clinic, { lat: clinic.lat + 0.004, lng: clinic.lng, accuracy: 5000 })).toBe(false); // 444 m > 150+200
  });
  it("coordenada inválida: fora", () => {
    expect(isInsideFence(clinic, { lat: NaN, lng: 0, accuracy: 10 })).toBe(false);
  });
});
