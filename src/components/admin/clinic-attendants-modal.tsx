"use client";

import { useState } from "react";
import { Users, UserPlus, Loader2, Mail, MessagesSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { listClinicUsers, createTeamMember } from "@/actions/admin";

type Attendant = {
  id: string;
  name: string;
  email: string;
  maxConcurrentChats: number;
  createdAt: Date | string;
};

export function ClinicAttendantsModal({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [maxConcurrentChats, setMaxConcurrentChats] = useState(5);

  async function loadAttendants() {
    setLoading(true);
    try {
      const data = await listClinicUsers(clinicId);
      setAttendants(data);
    } catch {
      toast.error("Erro ao carregar atendentes.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) loadAttendants();
  }

  async function handleCreate() {
    if (!name.trim() || !email.trim() || !password) {
      toast.error("Preencha nome, e-mail e senha.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("email", email.trim());
      formData.set("password", password);
      formData.set("clinicId", clinicId);
      formData.set("maxConcurrentChats", String(maxConcurrentChats));
      await createTeamMember(formData);
      toast.success(`Login criado para ${name.trim()}!`);
      setName("");
      setEmail("");
      setPassword("");
      setMaxConcurrentChats(5);
      await loadAttendants();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar login.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="inline-flex items-center justify-center w-9 h-9 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 rounded-xl transition-all cursor-pointer"
        title="Atendentes"
        aria-label="Atendentes"
      >
        <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
      </DialogTrigger>

      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Atendentes — {clinicName}
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Logins com acesso só aos dados desta clínica (inbox, agendamentos, CRM).
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <div className="p-4 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
              </div>
            ) : attendants.length === 0 ? (
              <div className="p-4 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                Nenhuma atendente cadastrada ainda.
              </div>
            ) : (
              attendants.map((attendant) => (
                <div key={attendant.id} className="p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{attendant.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {attendant.email}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                    <MessagesSquare className="w-3 h-3" /> até {attendant.maxConcurrentChats} simultâneas
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cadastrar nova atendente</p>
            <div>
              <label htmlFor="attendant-name" className="sr-only">
                Nome completo
              </label>
              <input
                id="attendant-name"
                type="text"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="attendant-email" className="sr-only">
                E-mail de acesso
              </label>
              <input
                id="attendant-email"
                type="email"
                placeholder="E-mail de acesso"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="attendant-password" className="sr-only">
                Senha
              </label>
              <input
                id="attendant-password"
                type="password"
                placeholder="Senha (mín. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="attendant-max-chats" className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Limite de conversas simultâneas
              </label>
              <input
                id="attendant-max-chats"
                type="number"
                min={1}
                max={50}
                value={maxConcurrentChats}
                onChange={(e) => setMaxConcurrentChats(Math.max(1, Math.min(50, Number(e.target.value) || 5)))}
                className="w-16 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleCreate}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              {saving ? "Criando..." : "Criar Login"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
