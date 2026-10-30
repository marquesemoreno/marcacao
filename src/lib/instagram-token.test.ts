import { describe, expect, it } from "vitest";
import { shouldRefreshInstagramToken } from "./instagram-token";

const DAY = 86_400_000;
const now = new Date("2026-11-10T12:00:00Z");

describe("shouldRefreshInstagramToken", () => {
  it("não renova token com menos de 24h (a Meta recusa)", () => {
    expect(shouldRefreshInstagramToken({ tokenExpiresAt: null, updatedAt: new Date(now.getTime() - 3600e3) }, now)).toBe(false);
  });
  it("renova quando não sabemos a validade e o token já tem 24h", () => {
    expect(shouldRefreshInstagramToken({ tokenExpiresAt: null, updatedAt: new Date(now.getTime() - 2 * DAY) }, now)).toBe(true);
  });
  it("renova quando faltam 15 dias ou menos", () => {
    expect(shouldRefreshInstagramToken({ tokenExpiresAt: new Date(now.getTime() + 10 * DAY), updatedAt: new Date(now.getTime() - 50 * DAY) }, now)).toBe(true);
  });
  it("não renova quando ainda falta bastante", () => {
    expect(shouldRefreshInstagramToken({ tokenExpiresAt: new Date(now.getTime() + 40 * DAY), updatedAt: new Date(now.getTime() - 20 * DAY) }, now)).toBe(false);
  });
});
