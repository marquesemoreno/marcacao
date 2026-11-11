import { NextResponse } from "next/server";
import { getMyUnreadCount } from "@/actions/clinic-shell";
import { getMyDueTaskCount } from "@/actions/reception-tasks";

/** Contador de não lidas do menu da clínica. Rota GET (não server action) de propósito:
 * server actions rodam em fila e seguram a troca de página; o menu pedia isso 2x a cada
 * navegação (versão celular + computador). Ver useUnreadCount. */
export async function GET() {
  try {
    const count = await getMyUnreadCount();
    // Tarefas para hoje ou atrasadas vêm no mesmo pedido; se falhar, o contador do Chat segue.
    const tasks = await getMyDueTaskCount().catch(() => null);
    return NextResponse.json({ count, tasks }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ count: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}
