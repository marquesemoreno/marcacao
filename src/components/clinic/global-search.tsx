"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Search, User } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { globalSearch, type GlobalSearchResult } from "@/actions/clinic-shell";

export const OPEN_GLOBAL_SEARCH_EVENT = "open-global-search";

/** Abre a busca global de qualquer lugar (botão do cabeçalho/menu). */
export function openGlobalSearch() {
  window.dispatchEvent(new Event(OPEN_GLOBAL_SEARCH_EVENT));
}

/** N3 — busca global do painel (paciente, telefone, conversa). Atalho "/" em qualquer
 * tela, menos quando o foco está num campo de texto (não rouba a barra de quem digita). */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      setOpen(true);
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      globalSearch(q)
        .then((r) => {
          if (cancelled) return;
          setResults(r);
          setActive(0);
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  function go(r: GlobalSearchResult) {
    setOpen(false);
    router.push(r.match === "paciente" ? `/clinic/pacientes/${r.conversationId}` : `/clinic/inbox?c=${r.conversationId}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl rounded-2xl p-0 gap-0 top-[15%] translate-y-0" initialFocus={inputRef}>
        <DialogTitle className="sr-only">Buscar no painel</DialogTitle>
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-4">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                go(results[active]);
              }
            }}
            placeholder="Buscar paciente, telefone, CPF ou texto da conversa…"
            aria-label="Buscar paciente, telefone ou conversa"
            className="flex-1 h-12 bg-transparent text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <li className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Digite pelo menos 2 letras.</li>
          ) : results.length === 0 && !loading ? (
            <li className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Nada encontrado.</li>
          ) : (
            results.map((r, i) => (
              <li key={`${r.match}-${r.conversationId}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left ${i === active ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                >
                  {r.match === "paciente" ? <User className="w-4 h-4 text-slate-400 shrink-0" /> : <MessageCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{r.name}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{r.subtitle}</span>
                  </span>
                  <span className="text-xs text-slate-400">{r.match === "paciente" ? "Ficha" : "Conversa"}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="border-t border-slate-200 dark:border-slate-800 px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
          ↑ ↓ para navegar · Enter para abrir · Esc para fechar · atalho <kbd className="rounded border border-slate-300 dark:border-slate-700 px-1">/</kbd>
        </p>
      </DialogContent>
    </Dialog>
  );
}
