import { describe, it, expect } from "vitest";
import { assignmentSeenAtFor } from "./conversation-assignment";

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
