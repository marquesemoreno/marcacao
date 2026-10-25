export type SmsSendResult = { success: boolean; error?: string };

/** Envio de SMS pela API nova da Comtele (POST api.comtele.com.br/messages/sms/send, chave no
 * cabeçalho x-api-key — a chave do portal novo, não a do painel antigo "auth-key").
 * Formato conforme a documentação pública (developers.comtele.com.br, lida em 25/10/2026).
 * ATENÇÃO — ainda não testado contra a API real (sem chave): a doc é contraditória sobre o
 * tipo de `receivers` (exemplo usa inteiro, esquema diz string), não descreve `route` nem o
 * corpo dos erros, e a resposta não traz id da mensagem. Validar com uma chave de teste antes
 * de usar numa campanha de verdade. Nunca lança. fetch injetável para teste. */
export async function sendSmsViaComtele(
  params: { apiKey: string; route: number; number: string; message: string; tag: string },
  fetchImpl: typeof fetch = fetch
): Promise<SmsSendResult> {
  if (!/^\d{10,15}$/.test(params.number)) return { success: false, error: "Número inválido para SMS" };
  try {
    const response = await fetchImpl("https://api.comtele.com.br/messages/sms/send", {
      method: "POST",
      headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        receivers: [Number(params.number)],
        contactGroups: [],
        message: params.message,
        route: params.route,
        tag: params.tag,
        custom: params.tag,
        scheduleDate: null,
      }),
    });
    const data = (await response.json().catch(() => null)) as { hasError?: boolean; message?: string | null; errors?: string[] | null } | null;
    if (!response.ok) return { success: false, error: `Comtele ${response.status}${data?.message ? `: ${data.message}` : ""}` };
    if (data?.hasError) {
      const details = data.errors?.length ? ` (${data.errors.join("; ")})` : "";
      return { success: false, error: `${data.message ?? "Comtele recusou o envio"}${details}` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: `Falha de rede na Comtele: ${error instanceof Error ? error.message : String(error)}` };
  }
}
