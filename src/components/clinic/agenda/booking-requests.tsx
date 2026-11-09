"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarPlus, Check, MessageCircle, X } from "lucide-react";
import { listOpenBookingRequests, resolveBookingRequest } from "@/actions/booking-requests";
import { toTitleCase } from "@/lib/agenda-ui";

type Req = Awaited<ReturnType<typeof listOpenBookingRequests>>[number];

function ago(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

/** Pré-agendamento: pedidos que a IA tirou do Chat ("Quer agendar"). A recepção marca no
 * sistema da clínica e toca "Marquei"; "Descartar" se não era pedido. Ambos com Desfazer. */
export function BookingRequests({ refreshKey, onCount }: { refreshKey: number; onCount: (n: number) => void }) {
  const [items, setItems] = useState<Req[]>([]);
  useEffect(() => {
    let alive = true;
    listOpenBookingRequests()
      .then((r) => {
        if (!alive) return;
        setItems(r);
        onCount(r.length);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [refreshKey, onCount]);

  const restore = (req: Req) =>
    setItems((cur) => {
      const back = [...cur.filter((i) => i.id !== req.id), req].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      onCount(back.length);
      return back;
    });

  const act = async (req: Req, status: "SCHEDULED" | "DISCARDED") => {
    setItems((cur) => {
      const next = cur.filter((i) => i.id !== req.id);
      onCount(next.length);
      return next;
    });
    try {
      await resolveBookingRequest(req.id, status);
      toast.success(status === "SCHEDULED" ? "Pedido marcado como agendado" : "Pedido descartado", {
        action: { label: "Desfazer", onClick: () => void resolveBookingRequest(req.id, "OPEN").then(() => restore(req)) },
      });
    } catch {
      restore(req);
      toast.error("Não foi possível salvar. Tente de novo.");
    }
  };

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="pedidos-titulo" className="glass-surface overflow-hidden ring-1 ring-violet-300/60 dark:ring-violet-800/60">
      <h2 id="pedidos-titulo" className="flex items-center gap-2 px-4 pt-3 text-sm font-semibold">
        <CalendarPlus className="h-4 w-4 text-violet-700 dark:text-violet-400" aria-hidden />
        Pedidos de marcação
        <span className="text-xs font-normal text-slate-500 tabular-nums">{items.length}</span>
      </h2>
      <p className="px-4 text-xs text-slate-500 dark:text-slate-400">Tirados do Chat pela IA. Marque no sistema da clínica e dê baixa.</p>
      <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((r) => (
          <li key={r.id} className="space-y-1.5 px-4 py-2.5 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">{toTitleCase(r.patientName || r.phone || "Paciente")}</span>
              <span className="shrink-0 text-xs text-slate-500">{ago(r.createdAt)}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300">{r.summary}</p>
            {r.notes && <p className="text-xs text-slate-500 dark:text-slate-400">{r.notes}</p>}
            <div className="flex flex-wrap gap-2 pt-0.5">
              <Link
                href={`/clinic/inbox?c=${r.conversationId}`}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-3 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Conversa
              </Link>
              <button
                type="button"
                onClick={() => void act(r, "SCHEDULED")}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <Check className="h-3.5 w-3.5" aria-hidden /> Marquei
              </button>
              <button
                type="button"
                onClick={() => void act(r, "DISCARDED")}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <X className="h-3.5 w-3.5" aria-hidden /> Descartar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
