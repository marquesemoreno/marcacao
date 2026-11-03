import { NextResponse, type NextRequest } from "next/server";
import { refreshContactPhoto } from "@/actions/inbox";
import { refreshContactPhotoAdmin } from "@/actions/admin-inbox";

export const dynamic = "force-dynamic";

/** Foto de perfil por GET em vez de server action: as actions de uma aba rodam em fila
 * (uma por vez), e o backfill de fotos (uma chamada à Evolution por contato) fazia o
 * "Salvar" do cadastro esperar atrás de dezenas delas. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id" }, { status: 400 });
  try {
    const url = request.nextUrl.searchParams.get("scope") === "admin" ? await refreshContactPhotoAdmin(id) : await refreshContactPhoto(id);
    return NextResponse.json({ url: url ?? null });
  } catch {
    return NextResponse.json({ url: null }, { status: 403 });
  }
}
