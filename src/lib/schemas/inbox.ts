import { z } from "zod";

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().trim().min(1, "Mensagem vazia"),
});

export const updateTagsSchema = z.object({
  conversationId: z.string().min(1),
  tags: z.array(z.string().trim().min(1)).max(10),
});

export type ConversationFilter = "mine" | "unassigned" | "all" | "resolved";
