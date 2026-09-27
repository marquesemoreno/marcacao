"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Circle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { InstagramGlyph } from "@/components/chat/instagram-glyph";
import { getInstagramAccount, saveInstagramAccount, toggleInstagramAccountActive } from "@/actions/admin-instagram-account";

type AccountState = Awaited<ReturnType<typeof getInstagramAccount>>;

const inputClass =
  "w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500";

/** Conecta a conta profissional de Instagram da clínica ao Inbox (Instagram Direct) —
 * mesmo padrão do HospitalIntegrationModal. */
export function InstagramAccountModal({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [account, setAccount] = useState<AccountState>(null);
  const [accessToken, setAccessToken] = useState("");

  async function load() {
    setLoading(true);
    try {
      setAccount(await getInstagramAccount(clinicId));
    } catch {
      toast.error("Erro ao carregar conta do Instagram.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) load();
    else setAccessToken("");
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveInstagramAccount(clinicId, { accessToken });
      toast.success(`Conta ${result.username ? `@${result.username} ` : ""}conectada e inscrita no webhook.`);
      setAccessToken("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar conta.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!account) return;
    setToggling(true);
    try {
      await toggleInstagramAccountActive(clinicId, !account.active);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar conta.");
    } finally {
      setToggling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="inline-flex items-center justify-center w-9 h-9 text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/60 hover:bg-pink-100 dark:hover:bg-pink-900 border border-pink-200 dark:border-pink-800 rounded-xl transition-all cursor-pointer"
        title="Instagram Direct"
        aria-label="Instagram Direct"
      >
        <InstagramGlyph className="w-4 h-4" />
      </DialogTrigger>

      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <InstagramGlyph className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            Instagram Direct — {clinicName}
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Conecta a conta profissional de Instagram da clínica ao Inbox. Use o token de acesso de longa duração gerado
            no painel do App da Meta (Instagram API com Instagram Login).
          </p>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            {account && (
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    account.active
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {account.active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                  {account.active ? "Conectada" : "Desativada"}
                  {account.username && <span className="font-medium">· @{account.username}</span>}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={account.active}
                  disabled={toggling}
                  onClick={handleToggle}
                  className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-50"
                >
                  {account.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="ig-token" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Token de acesso
                </label>
                <input
                  id="ig-token"
                  type="password"
                  autoComplete="off"
                  placeholder={account ? `Preenchido (${account.tokenMasked}) — deixe em branco para manter` : "IGAA..."}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-50 rounded-xl transition-all"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? "Validando na Meta..." : account ? "Revalidar e Salvar" : "Conectar Conta"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
