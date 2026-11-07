"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

/** Sessão encerrada no servidor (senha trocada, sessões encerradas, usuário desativado):
 * apaga o cookie e volta para o login. */
export default function SairPage() {
  useEffect(() => {
    void signOut({ callbackUrl: "/entrar?expirada=1" });
  }, []);
  return <p className="p-8 text-center text-sm text-slate-500">Saindo…</p>;
}
