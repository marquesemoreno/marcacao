"use client";

import { useMemo, useState } from "react";
import { AvatarBadge } from "@/components/chat/avatar-badge";
import { avatarTone } from "@/lib/avatar-tone";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Loader2, Search, Upload, X } from "lucide-react";
import { importMarcadores, updateMarcador, type MarcadorWithStats } from "@/actions/marcadores";

function formatPhone(p: string): string {
  const d = p.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const panel = "glass-surface";

/** Tabela de marcadores em dois modos: "cadastro" (página Marcadores: link pessoal pra copiar,
 * ativar/desativar e importar lista colada) e "relatorio" (Relatórios › Marcadores: indicados →
 * agendados → atendidos no período, só leitura). */
export function MarcadoresTable({
  rows,
  hasClinicWhatsapp,
  mode,
  periodLabel = "",
}: {
  rows: MarcadorWithStats[];
  hasClinicWhatsapp: boolean;
  mode: "cadastro" | "relatorio";
  periodLabel?: string;
}) {
  const report = mode === "relatorio";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.phone.includes(q.replace(/\D/g, "") || "§")) : rows;
  }, [rows, query]);

  const totals = useMemo(
    () => rows.reduce((t, r) => ({ referred: t.referred + r.referred, scheduled: t.scheduled + r.scheduled, attended: t.attended + r.attended }), { referred: 0, scheduled: 0, attended: 0 }),
    [rows]
  );
  const activeWithReferrals = rows.filter((r) => r.referred > 0).length;

  async function copyLink(r: MarcadorWithStats) {
    if (!r.link) return;
    try {
      await navigator.clipboard.writeText(r.link);
      setCopied(r.id);
      toast.success(`Link de ${r.name} copiado.`);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  async function toggleActive(r: MarcadorWithStats) {
    setBusy(r.id);
    try {
      await updateMarcador(r.id, { active: !r.active });
      toast.success(r.active ? `${r.name} desativado — o link deixa de contar.` : `${r.name} reativado.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  }

  async function runImport() {
    setImporting(true);
    try {
      const r = await importMarcadores(importText);
      toast.success(`${r.created} marcador(es) cadastrado(s)${r.skipped ? ` · ${r.skipped} já existia(m)` : ""}.`);
      setImportText("");
      setImportOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível importar.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {report && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: `Pacientes indicados (${periodLabel})`, value: totals.referred },
          { label: "Agendaram", value: totals.scheduled, hint: totals.referred ? pct(totals.scheduled / totals.referred) : null },
          { label: "Atendidos", value: totals.attended, hint: totals.scheduled ? `${pct(totals.attended / totals.scheduled)} dos agendados` : null },
          { label: "Marcadores que indicaram", value: `${activeWithReferrals} de ${rows.length}` },
        ].map((k) => (
          <div key={k.label} className={`${panel} p-3`}>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{k.value}</p>
            {k.hint && <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{k.hint}</p>}
          </div>
        ))}
      </div>
      )}

      {!report && !hasClinicWhatsapp && (
        <p className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/85 dark:bg-amber-950/40 backdrop-blur-xl px-4 py-2.5 text-sm text-amber-900 dark:text-amber-200">
          Cadastre o WhatsApp da clínica em Configurações para gerar os links dos marcadores.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar marcador"
            placeholder="Buscar por nome ou telefone…"
            className="h-10 w-full rounded-full border border-transparent bg-white/80 ring-1 ring-slate-900/5 shadow-xs dark:bg-white/[0.08] dark:ring-white/10 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        {!report && (
        <button
          type="button"
          onClick={() => setImportOpen((o) => !o)}
          aria-expanded={importOpen}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white/80 ring-1 ring-slate-900/5 shadow-xs dark:bg-white/[0.08] dark:ring-white/10 hover:bg-white dark:hover:bg-white/[0.14] px-4 text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <Upload className="w-4 h-4" aria-hidden /> Adicionar marcadores
        </button>
        )}
      </div>

      {!report && importOpen && (
        <div className={`${panel} p-5 space-y-3`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Colar lista de marcadores</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Um por linha: nome e telefone (ex.: “Lene – 77 98831-4115”). Telefones já cadastrados são ignorados.</p>
            </div>
            <button type="button" onClick={() => setImportOpen(false)} aria-label="Fechar" className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            aria-label="Lista de marcadores"
            placeholder={"Lene – 77 98831-4115\nMais Saúde; (77) 99821-3969"}
            className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!importText.trim() || importing}
              onClick={runImport}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 text-sm font-semibold text-white"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Cadastrar
            </button>
          </div>
        </div>
      )}

      <div className={`${panel} overflow-x-auto`}>
        <table className="w-full text-sm">
          <caption className="sr-only">{report ? `Desempenho dos marcadores — ${periodLabel}` : "Marcadores cadastrados"}</caption>
          <thead>
            <tr className="border-b border-slate-900/[0.07] dark:border-white/[0.07] text-left text-xs font-medium text-slate-600 dark:text-slate-400">
              <th scope="col" className="px-4 py-3">Marcador</th>
              {report ? (
                <>
                  <th scope="col" className="px-3 py-2 text-right">Indicados</th>
                  <th scope="col" className="px-3 py-2 text-right">Agendaram</th>
                  <th scope="col" className="px-3 py-2 text-right">Atendidos</th>
                  <th scope="col" className="px-3 py-2 text-right" title="Conversas com o próprio marcador no período (ele marcando direto pelo WhatsApp)">Conversas dele</th>
                </>
              ) : (
                <>
                  <th scope="col" className="px-3 py-2">Link pessoal</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Ativo</span></th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={report ? 5 : 3} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                  {rows.length === 0 ? (report ? "Nenhum marcador cadastrado ainda. Cadastre em Marcadores." : "Nenhum marcador cadastrado ainda. Use “Adicionar marcadores”.") : "Nenhum marcador encontrado."}
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.id} className={`border-b border-slate-900/[0.05] dark:border-white/[0.05] last:border-0 transition-colors hover:bg-white/50 dark:hover:bg-white/[0.03] ${r.active ? "" : "opacity-55"}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <AvatarBadge
                        name={r.name}
                        size={36}
                        className="ring-2 ring-white/80 dark:ring-white/10"
                        fallbackClassName={r.active ? avatarTone(r.id) : "bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400"}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{r.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatPhone(r.phone)} · <span className="font-mono">#m-{r.code}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  {report ? (
                    <>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">{r.referred}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.scheduled}
                    {r.referred > 0 && <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">({pct(r.conversion)})</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.attended}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{r.ownConversations}</td>
                    </>
                  ) : (
                    <>
                  <td className="px-3 py-2">
                    {r.link ? (
                      <button
                        type="button"
                        onClick={() => copyLink(r)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/80 ring-1 ring-slate-900/5 shadow-xs dark:bg-white/[0.08] dark:ring-white/10 hover:bg-white dark:hover:bg-white/[0.14] px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                        aria-label={`Copiar link de ${r.name}`}
                      >
                        {copied === r.id ? <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
                        {copied === r.id ? "Copiado" : "Copiar link"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => toggleActive(r)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {r.active ? "Desativar" : "Reativar"}
                    </button>
                  </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {report && (
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Conta a partir de quando o paciente chega pelo link do marcador (a mensagem já vem com o código, ex.: #m-lene). “Agendaram” considera
        agendamento no Conecta, lembrete da agenda da clínica, etapa Agendado ou finalização com agendamento; “Atendidos”, quem foi marcado como
        Presente/Atendido na Agenda.
      </p>
      )}
    </div>
  );
}
