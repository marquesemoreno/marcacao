import { z } from "zod";

export const chatAutomationSchema = z.object({
  keyword: z.string().trim().min(2, "Informe uma palavra-chave com pelo menos 2 caracteres"),
  responseText: z.string().trim().min(5, "A resposta automática precisa ter pelo menos 5 caracteres"),
});

export type ChatAutomationInput = z.input<typeof chatAutomationSchema>;
