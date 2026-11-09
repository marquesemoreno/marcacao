"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  endMyOtherSessions,
  getMySecurity,
  startTwoFactorSetup,
} from "@/actions/account";

type Security = Awaited<ReturnType<typeof getMySecurity>>;

const REASON: Record<string, string> = {
  SENHA: "senha errada",
  BLOQUEADO: "bloqueado (muitas tentativas)",
  INATIVO: "usuário desativado",
  CODIGO_2FA: "código errado",
};

function device(ua: string | null) {
  if (!ua) return "—";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : "Outro";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "navegador";
  return `${br} · ${os}`;
}

/** Minha conta › Segurança: verificação em duas etapas, sair dos outros aparelhos e as
 * últimas entradas (para perceber acesso estranho). */
export function SecurityPanel() {
  const { update } = useSession();
  const [data, setData] = useState<Security | null>(null);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => getMySecurity().then(setData).catch(() => null);
  useEffect(() => {
    load();
  }, []);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  return (
    <div className="glass-surface max-w-md space-y-4 p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-emerald-600" />
        <h2 className="text-base font-semibold">Segurança</h2>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Verificação em duas etapas</h3>
        {data.twoFactor ? (
          <>
            <p className="text-xs text-slate-500">Ativa. Ao entrar, o sistema pede o código do app autenticador.</p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Sua senha"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                disabled={busy || !pw}
                onClick={() => run(() => disableTwoFactor(pw).then(() => setPw("")), "Verificação em duas etapas desligada.")}
                className="h-9 rounded-full bg-slate-100 px-4 text-xs font-semibold hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800"
              >
                Desligar
              </button>
            </div>
          </>
        ) : setup ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              1. No celular, abra o Google Authenticator (ou Microsoft Authenticator) e leia o QR. 2. Digite o código que aparecer.
            </p>
            <div className="w-fit rounded-xl bg-white p-3">
              <QRCodeSVG value={setup.uri} size={160} />
            </div>
            <p className="break-all text-[11px] text-slate-500">Sem câmera? Digite a chave: {setup.secret}</p>
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-9 w-32 rounded-lg border border-slate-200 px-3 text-center tracking-widest tabular-nums dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                disabled={busy || code.replace(/\D/g, "").length !== 6}
                onClick={() =>
                  run(async () => {
                    await confirmTwoFactorSetup(code);
                    setSetup(null);
                    setCode("");
                  }, "Verificação em duas etapas ativada.")
                }
                className="h-9 rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Ativar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              Recomendado para a gestão: mesmo com a senha, ninguém entra sem o código do seu celular.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setSetup(await startTwoFactorSetup());
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Não foi possível.");
                } finally {
                  setBusy(false);
                }
              }}
              className="h-9 rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Configurar
            </button>
          </>
        )}
      </section>

      <section className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <h3 className="text-sm font-semibold">Outros aparelhos</h3>
        <p className="text-xs text-slate-500">Esqueceu o painel aberto em outro computador? Desconecte tudo, menos este.</p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await endMyOtherSessions();
              await update();
            }, "Outros aparelhos desconectados.")
          }
          className="h-9 rounded-full bg-slate-100 px-4 text-xs font-semibold hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          Sair dos outros aparelhos
        </button>
      </section>

      {data.logins.length > 0 && (
        <section className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Últimas entradas</h3>
          <ul className="space-y-1 text-xs">
            {data.logins.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className={l.success ? "text-slate-700 dark:text-slate-300" : "text-rose-600"}>
                  {new Date(l.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  {!l.success && ` · ${REASON[l.reason ?? ""] ?? "falhou"}`}
                </span>
                <span className="text-slate-500">{device(l.userAgent)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
