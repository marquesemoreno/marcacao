import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  clinic: { findMany: vi.fn() },
  conversation: { findMany: vi.fn(), updateMany: vi.fn() },
  message: { create: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/supabase-server", () => ({ notifyInboxRealtime: vi.fn(() => Promise.resolve()) }));

import { runQueueReturns } from "./queue-return-server";
import { DEMO_CLINIC_CNPJ } from "./demo-clinic";

describe("runQueueReturns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.clinic.findMany.mockResolvedValue([]);
  });

  it("nunca olha a clínica demo (a gravação dos vídeos não pode mudar sozinha)", async () => {
    await runQueueReturns(new Date("2026-11-24T15:00:00Z"));
    const where = db.clinic.findMany.mock.calls[0][0].where;
    expect(where.cnpj).toEqual({ not: DEMO_CLINIC_CNPJ });
    expect(where.unansweredReturnMinutes).toEqual({ gt: 0 });
  });
});
