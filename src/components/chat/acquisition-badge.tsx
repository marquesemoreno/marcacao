import { Megaphone, Search, Globe, UserRound } from "lucide-react";

/** Badge compacto do canal de aquisição (ver src/lib/acquisition.ts) — cabeçalho da
 * conversa no Inbox. Anúncio pago em âmbar, orgânico/site em azul, direto em cinza. */
export function AcquisitionBadge({ channel, detail }: { channel: string; detail?: string }) {
  const isAd = /ads/i.test(channel);
  const isSearch = /google/i.test(channel) && !isAd;
  const isSite = /site/i.test(channel);
  const Icon = isAd ? Megaphone : isSearch ? Search : isSite ? Globe : UserRound;
  const tone = isAd
    ? "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
    : isSearch || isSite
      ? "bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300"
      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}
      title={detail ? `Origem: ${channel} — ${detail}` : `Origem: ${channel}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {channel}
    </span>
  );
}
