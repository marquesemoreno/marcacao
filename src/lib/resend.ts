export type EmailSendResult = { success: boolean; id?: string; error?: string };

/** Envio de e-mail pela API do Resend (POST /emails). Nunca lança: erro da API ou de rede
 * volta como { success: false, error } pro despachante marcar o destinatário como FAILED.
 * `idempotencyKey` (id do destinatário) evita e-mail duplicado se o cron repetir a chamada
 * — o Resend ignora repetições com a mesma chave por 24 h. fetch injetável para teste. */
export async function sendEmailViaResend(
  params: {
    apiKey: string;
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    headers?: Record<string, string>;
    idempotencyKey?: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<EmailSendResult> {
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        ...(params.idempotencyKey ? { "Idempotency-Key": params.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        headers: params.headers,
      }),
    });
    const data = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok) return { success: false, error: `Resend ${response.status}: ${data?.message ?? "erro desconhecido"}` };
    return { success: true, id: data?.id };
  } catch (error) {
    return { success: false, error: `Falha de rede no Resend: ${error instanceof Error ? error.message : String(error)}` };
  }
}
