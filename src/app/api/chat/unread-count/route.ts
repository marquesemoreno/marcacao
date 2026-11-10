import { NextResponse } from "next/server";
import { getMyUnreadCount } from "@/actions/clinic-shell";

/** Contador de não lidas do menu da clínica. Rota GET (não server action) de propósito:
 * server actions rodam em fila e seguram a troca de página; o menu pedia isso 2x a cada
 * navegação (versão celular + computador). Ver useUnreadCount. */
export async function GET() {
  try {
    return NextResponse.json({ count: await getMyUnreadCount() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ count: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}
