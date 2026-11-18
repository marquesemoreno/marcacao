/** Modo demo da API oficial (18/11/2026): a Clínica Vida (demo) aparece com o número da TIVDC
 * conectado, ligado no Chat e com modelos aprovados de exemplo — só para os vídeos. Nada é
 * enviado nem alterado (as actions recusam ou ignoram). Puro. */
import { DEMO_CLOUD_TEMPLATES } from "@/lib/demo-regua";
import type { CloudTemplate } from "@/lib/whatsapp-cloud";

export const DEMO_CLOUD_BLOCKED = "Clínica de demonstração: nada é enviado nem alterado.";

export type DemoCloudSource = { displayPhoneNumber: string | null; wabaId: string; phoneNumberId: string } | null;

export function demoCloudAccount(source: DemoCloudSource) {
  return {
    wabaId: source?.wabaId ?? "000000000000000",
    phoneNumberId: source?.phoneNumberId ?? "000000000000000",
    displayPhoneNumber: source?.displayPhoneNumber ?? "+55 00 90000-0000",
    verifiedName: "Clínica Vida",
    coexistence: false,
    active: true,
    connectedAt: "2026-11-01T12:00:00.000Z",
    reminderTemplateName: "lembrete_consulta",
    reminderTemplateLanguage: "pt_BR",
  };
}

const REMINDER = {
  name: "lembrete_consulta",
  language: "pt_BR",
  category: "UTILITY",
  bodyText: "Olá, {{1}}! Lembrete da sua consulta na Clínica Vida em {{2}} às {{3}} com {{4}}. Responda CONFIRMO, REMARCAR ou CANCELAR.",
};

export function demoCloudTemplates(): (CloudTemplate & { bodyText: string; variableCount: number })[] {
  return [REMINDER, ...DEMO_CLOUD_TEMPLATES].map((t) => ({
    id: `demo-${t.name}`,
    name: t.name,
    status: "APPROVED",
    category: t.category,
    language: t.language,
    bodyText: t.bodyText,
    variableCount: new Set(t.bodyText.match(/\{\{\d+\}\}/g) ?? []).size,
  }));
}
