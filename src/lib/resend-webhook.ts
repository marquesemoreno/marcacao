import { createHmac, timingSafeEqual } from "node:crypto";

/** Webhook de status do Resend (assinado pelo Svix). Puro — testado em resend-webhook.test.ts;
 * a rota é src/app/api/webhooks/resend/route.ts. */

const TOLERANCE_S = 5 * 60;

/** Confere svix-signature ("v1,<base64> v1,<base64>…") = HMAC-SHA256 de "id.timestamp.corpo"
 * com o segredo "whsec_<base64>". Recusa carimbo de tempo com mais de 5 min de diferença. */
export function verifyResendSignature(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  nowS?: number;
}): boolean {
  const { secret, id, timestamp, signature, body } = input;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  const now = input.nowS ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TOLERANCE_S) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export type DeliveryStatus = "DELIVERED" | "DELAYED" | "BOUNCED" | "COMPLAINED";

export function resendEventStatus(type: string): DeliveryStatus | null {
  switch (type) {
    case "email.delivered":
      return "DELIVERED";
    case "email.delivery_delayed":
      return "DELAYED";
    case "email.bounced":
      return "BOUNCED";
    case "email.complained":
      return "COMPLAINED";
    default:
      return null;
  }
}

const RANK: Record<DeliveryStatus, number> = { DELAYED: 0, DELIVERED: 1, BOUNCED: 2, COMPLAINED: 3 };

/** Os eventos podem chegar fora de ordem: um "atrasado" não apaga "entregue", e
 * "voltou"/"marcou como spam" valem sobre "entregue". */
export function shouldApplyDelivery(current: string | null, next: DeliveryStatus): boolean {
  if (!current || !(current in RANK)) return true;
  return RANK[next] > RANK[current as DeliveryStatus];
}
