/** Funções puras (sem prisma/server-only) — testáveis diretamente, ver
 * msp-lead-message.test.ts. Lógica de envio de verdade fica em msp-lead-outreach.ts. */

export type MspOutreachLeadInput = { name: string };

/** Texto fixo do primeiro contato (TIVDC/MSP/script-abordagem-saude.md) — deliberadamente
 * NÃO gerado por IA. Esse script foi testado em campo com regras rígidas (3-4 linhas,
 * sem link, sem preço, um único pedido); deixar uma IA reescrever a cada lead arriscaria
 * degradar um texto que já funciona. Só o nome do negócio é substituído. */
const MSP_OUTREACH_TEMPLATE =
  'Oi! Aqui é o Lucas, da TIVDC — vi que vocês são a {{name}} aqui em Conquista. ' +
  "Trabalho com suporte de TI focado em clínicas e consultórios da região. Vocês têm " +
  'alguém cuidando da parte de infraestrutura/TI hoje, ou isso ainda é meio resolvido ' +
  '"na hora que dá problema"? Queria entender se faz sentido eu passar mais informação.';

export function buildMspOutreachMessage(lead: MspOutreachLeadInput): string {
  return MSP_OUTREACH_TEMPLATE.replace("{{name}}", lead.name);
}

/** O playbook de abordagem evita 8h-9h (agenda lotada na abertura) e 12h-14h
 * (almoço) — janela permitida: 09h-12h e 14h-18h, fuso America/Bahia. */
export function isWithinOutreachWindow(date: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Bahia", hour: "numeric", hour12: false }).format(date)
  );
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
}
