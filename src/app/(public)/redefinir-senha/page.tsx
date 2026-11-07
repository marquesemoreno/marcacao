"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { checkResetToken, resetPasswordWithToken } from "@/actions/account";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "expired" | "used" | "invalid">("loading");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return setStatus("invalid");
    checkResetToken(token).then(setStatus).catch(() => setStatus("invalid"));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== pw2) return setError("As duas senhas não são iguais.");
    setSaving(true);
    try {
      await resetPasswordWithToken(token, pw);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") return <p className="mt-6 text-center text-sm text-slate-500">Conferindo o link…</p>;
  if (done)
    return (
      <div className="mt-6 space-y-4 text-center">
        <p className="text-sm text-slate-600">Senha nova salva. Por segurança, todos os aparelhos foram desconectados.</p>
        <a href="/entrar" className="inline-block rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
          Entrar
        </a>
      </div>
    );
  if (status !== "ok")
    return (
      <div className="mt-6 space-y-4 text-center">
        <p className="text-sm text-slate-600">
          {status === "expired" ? "Este link venceu (vale 1 hora)." : "Este link é inválido ou já foi usado."}
        </p>
        <a href="/esqueci-senha" className="inline-block text-sm font-medium text-emerald-700 hover:underline">
          Pedir outro link
        </a>
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {[
        { id: "pw", label: "Senha nova", v: pw, set: setPw },
        { id: "pw2", label: "Repita a senha nova", v: pw2, set: setPw2 },
      ].map((f) => (
        <div key={f.id} className="space-y-1.5">
          <label htmlFor={f.id} className="text-xs font-medium text-slate-600">
            {f.label}
          </label>
          <input
            id={f.id}
            type="password"
            required
            autoComplete="new-password"
            value={f.v}
            onChange={(e) => f.set(e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      ))}
      <p className="text-xs text-slate-500">Pelo menos 8 caracteres, com letra e número.</p>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="h-11 w-full rounded-full bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {saving ? "Salvando…" : "Salvar senha nova"}
      </button>
    </form>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xs sm:p-10">
        <div className="flex flex-col items-center text-center">
          <Logo variant="full" size="lg" />
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">Criar senha nova</h1>
        </div>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
