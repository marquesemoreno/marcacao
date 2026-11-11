"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getSession, signIn } from "next-auth/react";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Verificação em duas etapas: a senha conferiu e o servidor pediu o código do app.
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState("");
  const expired = searchParams.get("expirada") === "1";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      code: needCode ? code : "",
      redirect: false,
    });

    if (result?.error === "2FA_REQUIRED") {
      setNeedCode(true);
      return;
    }
    if (result?.error === "2FA_INVALID") {
      setFormError("Código incorreto. Use o código que aparece agora no app autenticador.");
      return;
    }
    if (!result || result.error) {
      const message = "E-mail ou senha inválidos.";
      setFormError(message);
      toast.error(message);
      return;
    }

    toast.success("Login realizado com sucesso.");

    const session = await getSession();
    const callbackUrl = searchParams.get("callbackUrl");
    if (callbackUrl) {
      router.push(callbackUrl);
    } else if (session?.user.role === "ADMIN") {
      router.push("/admin");
    } else if (session?.user.role === "CLINIC") {
      router.push("/clinic/inbox");
    } else {
      router.push("/");
    }
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl sm:p-10">
      <div className="flex flex-col items-center text-center">
        <Logo variant="full" size="lg" />
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Acesse seu Painel</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Entre com suas credenciais de clínica ou administrador
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-semibold text-slate-700">
            E-mail
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-900 transition-all focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder="seuemail@clinica.com.br"
              {...register("email")}
            />
          </div>
          {errors.email && <p className="text-xs font-medium text-rose-600">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-semibold text-slate-700">
            Senha
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm text-slate-900 transition-all focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder="••••••••"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs font-medium text-rose-600">{errors.password.message}</p>
          )}
        </div>

        {needCode && (
          <div className="space-y-1.5">
            <label htmlFor="code" className="text-xs font-semibold text-slate-700">
              Código do app autenticador
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-lg tracking-[0.4em] tabular-nums text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder="000000"
            />
            <p className="text-xs text-slate-500">Abra o Google Authenticator (ou outro app) e digite os 6 números do Conecta Saúde.</p>
          </div>
        )}

        {expired && !formError && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            Sua sessão foi encerrada (senha trocada ou acesso revisto). Entre de novo.
          </p>
        )}

        {formError && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
            {formError}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 h-12 rounded-2xl bg-gradient-to-r from-sky-600 to-teal-600 text-sm font-bold text-white shadow-sm transition-all hover:shadow-lg hover:brightness-105 active:scale-[0.99]"
        >
          {isSubmitting ? "Entrando..." : "Entrar"}
        </Button>
        <a href="/esqueci-senha" className="text-center text-xs font-medium text-slate-500 hover:text-teal-700">
          Esqueci minha senha
        </a>
      </form>

      <div className="mt-7 border-t border-slate-100 pt-5 text-center">
        <a
          href="https://wa.me/5577999999999?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20acessar%20o%20painel%20da%20Conecta%20Sa%C3%BAde"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Precisa de ajuda? Fale com o suporte no WhatsApp
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-sky-500/10 via-teal-500/10 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:28px_28px]"
      />
      <div className="relative z-10 flex w-full justify-center">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
