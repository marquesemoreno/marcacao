"use client";

import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { requestPasswordReset } from "@/actions/account";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    await requestPasswordReset(email).catch(() => null);
    setSending(false);
    setSent(true);
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xs sm:p-10">
        <div className="flex flex-col items-center text-center">
          <Logo variant="full" size="lg" />
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">Esqueci minha senha</h1>
        </div>
        {sent ? (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm text-slate-600">
              Se esse e-mail tiver acesso ao painel, enviamos um link para criar uma senha nova. Ele vale por 1 hora.
            </p>
            <p className="text-xs text-slate-500">Não chegou? Veja a caixa de spam ou peça ao responsável da clínica.</p>
            <a href="/entrar" className="inline-block text-sm font-medium text-emerald-700 hover:underline">
              Voltar para o login
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">Digite o e-mail que você usa para entrar. Vamos mandar um link para criar uma senha nova.</p>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-slate-600">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="seuemail@clinica.com.br"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="h-11 w-full rounded-full bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {sending ? "Enviando…" : "Enviar link"}
            </button>
            <a href="/entrar" className="block text-center text-xs text-slate-500 hover:text-slate-700">
              Voltar para o login
            </a>
          </form>
        )}
      </div>
    </main>
  );
}
