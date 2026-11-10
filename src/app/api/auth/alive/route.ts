import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isLive } from "@/lib/session";

/** A sessão desta aba ainda vale? Usado pela tela quando uma consulta falha, para levar
 * ao login em vez de ficar parada (sessão vencida, senha trocada, "sair dos outros
 * aparelhos", usuário desativado). Não revela nada além de sim/não. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const alive = !!session && (await isLive(session));
  return NextResponse.json({ alive }, { headers: { "Cache-Control": "no-store" } });
}
