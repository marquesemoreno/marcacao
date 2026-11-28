import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/token-crypto";
import { createPatientCall } from "@/lib/tv-call-server";

/** Chamada na TV vinda do sistema da clínica (ponte Firebird). A ponte vigia o banco
 * (ex.: Urolaser — médico abre o atendimento no Prontuário → MARCACAO.STATUS vira 3) e
 * avisa aqui. Autenticação: o mesmo token que o Conecta usa pra falar com a ponte
 * (HospitalIntegration.apiToken) — é ele que diz de qual clínica é a chamada. */

const DUPLICATE_WINDOW_MS = 90_000;

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function clinicForToken(provided: string): Promise<string | null> {
  if (!provided || provided.length > 500) return null;
  const rows = await prisma.hospitalIntegration.findMany({ where: { active: true }, select: { clinicId: true, apiToken: true } });
  for (const row of rows) {
    try {
      if (sameToken(provided, decryptToken(row.apiToken))) return row.clinicId;
    } catch {
      // token ilegível dessa clínica: segue pras outras
    }
  }
  return null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const s = String(value).replace(/\s+/g, " ").trim().slice(0, max);
  return s || null;
}

export async function POST(req: Request) {
  const clinicId = await clinicForToken(req.headers.get("x-api-token") ?? "");
  if (!clinicId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const externalId = text(body?.numero, 40);
  const patientName = text(body?.paciente, 120);
  if (!externalId || !patientName) return NextResponse.json({ error: "numero e paciente são obrigatórios" }, { status: 400 });

  // A ponte reenvia quando a rede falha: a mesma marcação em 90 s não vira "rechamada".
  const recent = await prisma.patientCall.findFirst({
    where: { clinicId, source: "BRIDGE", externalId, createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } },
    select: { id: true },
  });
  if (recent) return NextResponse.json({ ok: true, duplicate: true });

  const call = await createPatientCall(clinicId, null, {
    source: "BRIDGE",
    externalId,
    patientName,
    doctor: text(body?.medico, 120),
    room: text(body?.sala, 40),
  });
  return NextResponse.json({ ok: true, id: call.id });
}
