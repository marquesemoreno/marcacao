import { describe, it, expect } from "vitest";
import { assignmentSeenAtFor, assignOnReply } from "./conversation-assignment";

describe("assignmentSeenAtFor", () => {
  it("marca como já vista quando o próprio usuário se atribui a conversa", () => {
    // Responder uma "Não Atribuída" ou clicar em "Atribuir pra mim" — a pessoa já
    // sabe que acabou de pegar, não precisa de aviso.
    const result = assignmentSeenAtFor("user-1", "user-1");
    expect(result).toBeInstanceOf(Date);
  });

  it("marca como não vista quando outra pessoa atribui a conversa", () => {
    // Bug real: atendente recebia conversa transferida (ou atribuída por um admin) e
    // não tinha nenhum aviso — só descobria ao abrir "Minhas" manualmente.
    const result = assignmentSeenAtFor("user-2", "user-1");
    expect(result).toBeNull();
  });
});

describe("assignOnReply", () => {
  it("quem responde ao paciente vira a dona da conversa, mesmo se era de outra atendente", () => {
    const r = assignOnReply({ assignedUserId: "leticia" }, "jamile");
    expect(r).toMatchObject({ assignedUserId: "jamile" });
  });
  it("conversa sem dona: quem responde assume", () => {
    expect(assignOnReply({ assignedUserId: null }, "jamile")).toMatchObject({ assignedUserId: "jamile" });
  });
  it("já é dela: não muda nada", () => {
    expect(assignOnReply({ assignedUserId: "jamile" }, "jamile")).toEqual({});
  });
  it("nota interna não tira a conversa da colega (só assume se estiver sem dona)", () => {
    expect(assignOnReply({ assignedUserId: "leticia" }, "jamile", { internalNote: true })).toEqual({});
    expect(assignOnReply({ assignedUserId: null }, "jamile", { internalNote: true })).toMatchObject({ assignedUserId: "jamile" });
  });
});
