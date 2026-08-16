import { describe, it, expect } from "vitest";
import { sendMessageSchema, updateTagsSchema } from "./inbox";

describe("sendMessageSchema", () => {
  it("aceita conversationId e conteúdo válidos", () => {
    const result = sendMessageSchema.safeParse({ conversationId: "conv_1", content: "Olá!" });
    expect(result.success).toBe(true);
  });

  it("rejeita conteúdo vazio ou só espaços", () => {
    expect(sendMessageSchema.safeParse({ conversationId: "conv_1", content: "" }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ conversationId: "conv_1", content: "   " }).success).toBe(false);
  });

  it("rejeita conversationId vazio", () => {
    const result = sendMessageSchema.safeParse({ conversationId: "", content: "Olá!" });
    expect(result.success).toBe(false);
  });
});

describe("updateTagsSchema", () => {
  it("aceita uma lista de tags válida", () => {
    const result = updateTagsSchema.safeParse({
      conversationId: "conv_1",
      tags: ["Exame Pendente", "Prioritário"],
    });
    expect(result.success).toBe(true);
  });

  it("aceita lista vazia (remover todas as tags)", () => {
    const result = updateTagsSchema.safeParse({ conversationId: "conv_1", tags: [] });
    expect(result.success).toBe(true);
  });

  it("rejeita mais de 10 tags", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `tag-${i}`);
    const result = updateTagsSchema.safeParse({ conversationId: "conv_1", tags });
    expect(result.success).toBe(false);
  });

  it("rejeita tag vazia dentro da lista", () => {
    const result = updateTagsSchema.safeParse({ conversationId: "conv_1", tags: [""] });
    expect(result.success).toBe(false);
  });
});
