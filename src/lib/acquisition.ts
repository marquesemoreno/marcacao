/** Canal de aquisição da conversa — detectado uma vez, na 1ª mensagem (ver webhook do
 * WhatsApp), e gravado em Conversation.acquisitionChannel. Ordem de confiança:
 * anúncio de clique-pro-WhatsApp do Meta (externalAdReply, dado estruturado) > utm no
 * texto pré-preenchido > texto-chave cadastrado pela clínica > link do site > direto. */
import { MARKETPLACE_SOURCE_TEXT } from "./auto-tags";

export const DIRECT_CHANNEL = "Indicação / Direto";
export const UNKNOWN_CHANNEL = "Não identificado";
/** Conversa que chegou por DM (webhook do Instagram) — ver api/webhooks/instagram. */
export const INSTAGRAM_DIRECT_CHANNEL = "Instagram Direct";
export const ACQUISITION_CHANNELS = [
  "Instagram Ads",
  "Facebook Ads",
  "Google Ads",
  "Google Orgânico",
  "Site Conecta Saúde",
  INSTAGRAM_DIRECT_CHANNEL,
  DIRECT_CHANNEL,
] as const;

export type AcquisitionRuleInput = { keyword: string; channel: string };
export type Acquisition = { channel: string; detail: string | null; adId: string | null };

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

type AdReply = { title?: unknown; sourceUrl?: unknown; sourceId?: unknown };

/** externalAdReply pode vir dentro do contextInfo de qualquer tipo de mensagem
 * (texto, imagem…) ou no contextInfo de nível superior do payload da Evolution. */
function findAdReply(data: unknown): AdReply | null {
  type WithContext = { contextInfo?: { externalAdReply?: AdReply } };
  const d = data as (WithContext & { message?: Record<string, WithContext | null> }) | undefined;
  if (!d) return null;
  if (d.contextInfo?.externalAdReply) return d.contextInfo.externalAdReply;
  for (const part of Object.values(d.message ?? {})) {
    const ad = part?.contextInfo?.externalAdReply;
    if (ad) return ad;
  }
  return null;
}

function channelFromUtm(text: string): string | null {
  const source = /utm_source=([\w.-]+)/i.exec(text)?.[1]?.toLowerCase();
  if (!source) return null;
  const medium = /utm_medium=([\w.-]+)/i.exec(text)?.[1]?.toLowerCase() ?? "";
  const paid = /cpc|ppc|paid|ads?$/.test(medium);
  if (source.includes("google")) return paid ? "Google Ads" : "Google Orgânico";
  if (source.includes("instagram") || source === "ig") return "Instagram Ads";
  if (source.includes("facebook") || source === "fb" || source === "meta") return "Facebook Ads";
  return source;
}

export function detectAcquisition(
  input: { text: string; data?: unknown },
  rules: AcquisitionRuleInput[]
): Acquisition {
  const ad = findAdReply(input.data);
  if (ad) {
    const url = typeof ad.sourceUrl === "string" ? ad.sourceUrl : "";
    return {
      channel: /facebook\.com|fb\.me|fb\.com/i.test(url) ? "Facebook Ads" : "Instagram Ads",
      detail: typeof ad.title === "string" && ad.title ? ad.title : null,
      adId: ad.sourceId != null ? String(ad.sourceId) : null,
    };
  }

  const utm = channelFromUtm(input.text);
  if (utm) return { channel: utm, detail: null, adId: null };

  const text = normalize(input.text);
  const rule = rules.find((r) => r.keyword.trim() && text.includes(normalize(r.keyword)));
  if (rule) return { channel: rule.channel, detail: rule.keyword, adId: null };

  if (input.text.includes(MARKETPLACE_SOURCE_TEXT)) return { channel: "Site Conecta Saúde", detail: null, adId: null };

  return { channel: DIRECT_CHANNEL, detail: null, adId: null };
}
