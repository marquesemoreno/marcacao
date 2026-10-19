import { describe, it, expect } from "vitest";
import { shouldRefreshFinalized, FINALIZED_REFRESH_MS } from "./crm-load";

const now = 1_000_000_000;
const base = { lastLoadedAt: now - 1000, lastKey: "a|", key: "a|", force: false, now };

describe("shouldRefreshFinalized", () => {
  it("nunca carregou: carrega", () => {
    expect(shouldRefreshFinalized({ ...base, lastLoadedAt: null, lastKey: null })).toBe(true);
  });

  it("carregou há pouco com os mesmos filtros: reaproveita (a lista de finalizados pesa ~4 MB)", () => {
    expect(shouldRefreshFinalized(base)).toBe(false);
    expect(shouldRefreshFinalized({ ...base, lastLoadedAt: now - (FINALIZED_REFRESH_MS - 1) })).toBe(false);
  });

  it("passou do intervalo: recarrega", () => {
    expect(shouldRefreshFinalized({ ...base, lastLoadedAt: now - FINALIZED_REFRESH_MS })).toBe(true);
  });

  it("mudou a busca ou a clínica filtrada: recarrega na hora", () => {
    expect(shouldRefreshFinalized({ ...base, key: "b|" })).toBe(true);
    expect(shouldRefreshFinalized({ ...base, key: "a|maria" })).toBe(true);
  });

  it("depois de finalizar ou reabrir um card: recarrega na hora", () => {
    expect(shouldRefreshFinalized({ ...base, force: true })).toBe(true);
  });
});
