import { z } from "zod";

/** Ficha prévia (anamnese) configurável por clínica. O modelo é JSON versionado
 * (FormTemplate); as respostas são validadas aqui antes de gravar criptografadas.
 * Puro — sem banco. */
export const FORM_TEXT_MAX = 2000;

const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
    label: z.string().min(1).max(300),
    type: z.enum(["text", "yesno", "choice"]),
    required: z.boolean(),
    options: z.array(z.string().min(1).max(100)).max(20).optional(),
    /** Só aparece quando outra resposta tem esse valor (ex.: "Quais?" se alergia = sim). */
    showIf: z.object({ id: z.string(), equals: z.string() }).optional(),
  })
  .refine((q) => q.type !== "choice" || (q.options?.length ?? 0) >= 2, "Escolha precisa de 2+ opções");

const templateSchema = z
  .object({ questions: z.array(questionSchema).min(1).max(60) })
  .refine((t) => new Set(t.questions.map((q) => q.id)).size === t.questions.length, "Ids repetidos");

export type FormQuestion = z.infer<typeof questionSchema>;
export type FormTemplateBody = z.infer<typeof templateSchema>;

export function parseFormTemplate(body: unknown): FormTemplateBody {
  return templateSchema.parse(body);
}

const YESNO = ["sim", "nao"];

export type FormValidation =
  | { ok: true; answers: Record<string, string> }
  | { ok: false; errors: Record<string, string> };

export function validateFormAnswers(questions: FormQuestion[], input: Record<string, unknown>): FormValidation {
  const answers: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const q of questions) {
    if (q.showIf && answers[q.showIf.id] !== q.showIf.equals) continue;
    const raw = input[q.id];
    const value = typeof raw === "string" ? raw.trim().slice(0, FORM_TEXT_MAX) : "";
    if (!value) {
      if (q.required) errors[q.id] = "Obrigatório";
      continue;
    }
    if (q.type === "yesno" && !YESNO.includes(value)) errors[q.id] = "Resposta inválida";
    else if (q.type === "choice" && !q.options!.includes(value)) errors[q.id] = "Resposta inválida";
    else answers[q.id] = value;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, answers };
}
