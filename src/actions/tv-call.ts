"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicManager, requireClinicPermission } from "@/lib/session";
import { tvTopicFor } from "@/lib/realtime-server";
import { createPatientCall, issueTvDisplay, recentCalls, resolveTvDisplay, toTvCall } from "@/lib/tv-call-server";
import { doctorKey, type TvCall } from "@/lib/tv-call";
import { getBaseUrl } from "@/lib/format";
import { getSupabaseServerClient, WHATSAPP_MEDIA_BUCKET } from "@/lib/supabase-server";
import { checkTvUpload, parseSpotifyUrl, parseYoutubeUrl, type TvMediaKind } from "@/lib/tv-media";

/** Recepção/gestão chama um paciente na TV (o status "Em atendimento" é marcado à parte,
 * pelo setAgendaStatus de sempre). */
export async function callPatientOnTv(input: {
  source: "BRIDGE" | "LOCAL";
  externalId: string;
  patientName: string;
  doctor: string | null;
  room?: string | null;
}): Promise<TvCall> {
  const { clinicId, userId } = await requireClinicPermission("chamar");
  return createPatientCall(clinicId, userId, input);
}

/** Salas fixas + TVs da clínica (tela Configurações › TV da sala de espera). */
export async function getTvSettings() {
  const { clinicId } = await requireClinicManager();
  const [rooms, displays] = await Promise.all([
    prisma.doctorRoom.findMany({ where: { clinicId }, orderBy: { doctor: "asc" } }),
    prisma.tvDisplay.findMany({ where: { clinicId, revokedAt: null }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    rooms: rooms.map((r) => ({ doctor: r.doctor, room: r.room })),
    displays: displays.map((d) => ({ id: d.id, name: d.name, lastSeenAt: d.lastSeenAt?.toISOString() ?? null })),
  };
}

export async function saveDoctorRoom(input: { doctor: string; room: string }) {
  const { clinicId } = await requireClinicManager();
  const doctor = input.doctor.trim();
  const room = input.room.trim().slice(0, 40);
  if (!doctor) throw new Error("Escolha o médico.");
  const key = doctorKey(doctor);
  if (!room) {
    await prisma.doctorRoom.deleteMany({ where: { clinicId, doctorKey: key } });
  } else {
    await prisma.doctorRoom.upsert({
      where: { clinicId_doctorKey: { clinicId, doctorKey: key } },
      update: { room, doctor },
      create: { clinicId, doctorKey: key, doctor, room },
    });
  }
  revalidatePath("/clinic/tv");
  return { success: true as const };
}

/** Gera o link da TV. O endereço completo só aparece agora — guarde ou gere outro. */
export async function createTvLink(name: string): Promise<{ id: string; url: string }> {
  const { clinicId } = await requireClinicManager();
  const { id, raw } = await issueTvDisplay(clinicId, name);
  revalidatePath("/clinic/tv");
  return { id, url: `${getBaseUrl()}/tv/${raw}` };
}

export async function revokeTvLink(id: string) {
  const { clinicId } = await requireClinicManager();
  await prisma.tvDisplay.updateMany({ where: { id, clinicId, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/clinic/tv");
  return { success: true as const };
}

/** Salas fixas pra quem chama (recepção/médico) mostrar a sugestão e trocar na hora. */
export async function getDoctorRooms(): Promise<{ doctor: string; room: string }[]> {
  const { clinicId } = await requireClinicPermission("chamar");
  const rows = await prisma.doctorRoom.findMany({ where: { clinicId }, select: { doctor: true, room: true } });
  return rows;
}

// ── Lado da TV (sem login, só o token do link) ──────────────────────────────────

export async function getTvState(token: string): Promise<{ clinicName: string; topic: string | null; calls: TvCall[] } | null> {
  const tv = await resolveTvDisplay(token);
  if (!tv) return null;
  const clinic = await prisma.clinic.findUnique({ where: { id: tv.clinicId }, select: { name: true } });
  return { clinicName: clinic?.name ?? "", topic: tvTopicFor(tv.clinicId), calls: await recentCalls(tv.clinicId) };
}

export async function getTvCall(token: string, id: string): Promise<TvCall | null> {
  const tv = await resolveTvDisplay(token);
  if (!tv) return null;
  const row = await prisma.patientCall.findFirst({ where: { id, clinicId: tv.clinicId } });
  return row ? toTvCall(row) : null;
}

// ── Mídia da TV (vídeos, propaganda, música) ────────────────────────────────────

export type TvMediaView = { id: string; kind: TvMediaKind; title: string; source: string; durationSec: number; active: boolean; url: string | null };

async function mediaView(rows: { id: string; kind: string; title: string; source: string; durationSec: number; active: boolean }[], signHours: number): Promise<TvMediaView[]> {
  const supabase = getSupabaseServerClient();
  return Promise.all(
    rows.map(async (r) => {
      let url: string | null = null;
      if (r.kind === "YOUTUBE" || r.kind === "SPOTIFY") url = r.source;
      else if (supabase) {
        const { data } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).createSignedUrl(r.source, signHours * 3600);
        url = data?.signedUrl ?? null;
      }
      return { id: r.id, kind: r.kind as TvMediaKind, title: r.title, source: r.source, durationSec: r.durationSec, active: r.active, url };
    }),
  );
}

export async function listTvMedia(): Promise<TvMediaView[]> {
  const { clinicId } = await requireClinicManager();
  const rows = await prisma.tvMediaItem.findMany({ where: { clinicId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return mediaView(rows, 1);
}

/** Link do YouTube ou Spotify. */
export async function addTvMediaLink(input: { kind: "YOUTUBE" | "SPOTIFY"; url: string; title?: string }) {
  const { clinicId } = await requireClinicManager();
  let source: string;
  if (input.kind === "YOUTUBE") {
    const yt = parseYoutubeUrl(input.url);
    if (!yt) throw new Error("Link do YouTube inválido. (Globoplay e outros streamings não permitem exibição em outro site.)");
    source = `https://www.youtube.com/watch?${yt.videoId ? `v=${yt.videoId}` : ""}${yt.videoId && yt.playlistId ? "&" : ""}${yt.playlistId ? `list=${yt.playlistId}` : ""}`;
  } else {
    const sp = parseSpotifyUrl(input.url);
    if (!sp) throw new Error("Link do Spotify inválido. Use o link de uma playlist, álbum ou faixa.");
    source = sp;
    // Uma música de fundo por vez.
    await prisma.tvMediaItem.deleteMany({ where: { clinicId, kind: "SPOTIFY" } });
  }
  const last = await prisma.tvMediaItem.aggregate({ where: { clinicId }, _max: { position: true } });
  await prisma.tvMediaItem.create({
    data: { clinicId, kind: input.kind, source, title: (input.title?.trim() || (input.kind === "YOUTUBE" ? "Vídeo do YouTube" : "Música (Spotify)")).slice(0, 80), position: (last._max.position ?? 0) + 1 },
  });
  revalidatePath("/clinic/tv");
  return { success: true as const };
}

/** 1º passo do upload: URL assinada pro navegador subir direto ao Storage (vídeo grande não
 * passa pelo limite de 20 MB das server actions). */
export async function startTvMediaUpload(file: { name: string; type: string; size: number }): Promise<{ path: string; token: string; kind: "VIDEO" | "IMAGE" }> {
  const { clinicId } = await requireClinicManager();
  const check = checkTvUpload(file);
  if (!check.ok) throw new Error(check.error);
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Armazenamento não configurado.");
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  const path = `tv/${clinicId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("Não deu pra preparar o envio. Tente de novo.");
  return { path, token: data.token, kind: check.kind };
}

/** 2º passo: registra o arquivo já enviado. */
export async function finishTvMediaUpload(input: { path: string; kind: "VIDEO" | "IMAGE"; title: string; durationSec?: number }) {
  const { clinicId } = await requireClinicManager();
  if (!input.path.startsWith(`tv/${clinicId}/`) || input.path.includes("..")) throw new Error("Arquivo inválido.");
  const last = await prisma.tvMediaItem.aggregate({ where: { clinicId }, _max: { position: true } });
  await prisma.tvMediaItem.create({
    data: {
      clinicId,
      kind: input.kind,
      source: input.path,
      title: input.title.trim().slice(0, 80) || (input.kind === "VIDEO" ? "Vídeo" : "Imagem"),
      durationSec: Math.min(Math.max(Math.round(input.durationSec ?? 15), 5), 120),
      position: (last._max.position ?? 0) + 1,
    },
  });
  revalidatePath("/clinic/tv");
  return { success: true as const };
}

export async function updateTvMedia(id: string, patch: { active?: boolean; move?: -1 | 1; durationSec?: number }) {
  const { clinicId } = await requireClinicManager();
  const item = await prisma.tvMediaItem.findFirst({ where: { id, clinicId } });
  if (!item) throw new Error("Item não encontrado.");
  if (patch.move) {
    const all = await prisma.tvMediaItem.findMany({ where: { clinicId, kind: { not: "SPOTIFY" } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } });
    const i = all.findIndex((x) => x.id === id);
    const j = i + patch.move;
    if (i >= 0 && j >= 0 && j < all.length) {
      [all[i], all[j]] = [all[j], all[i]];
      await prisma.$transaction(all.map((x, k) => prisma.tvMediaItem.update({ where: { id: x.id }, data: { position: k + 1 } })));
    }
  }
  if (patch.active !== undefined || patch.durationSec !== undefined) {
    await prisma.tvMediaItem.update({
      where: { id },
      data: {
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(patch.durationSec !== undefined ? { durationSec: Math.min(Math.max(Math.round(patch.durationSec), 5), 120) } : {}),
      },
    });
  }
  revalidatePath("/clinic/tv");
  return { success: true as const };
}

export async function deleteTvMedia(id: string) {
  const { clinicId } = await requireClinicManager();
  const item = await prisma.tvMediaItem.findFirst({ where: { id, clinicId } });
  if (!item) return { success: true as const };
  await prisma.tvMediaItem.delete({ where: { id } });
  if (item.kind === "VIDEO" || item.kind === "IMAGE") {
    await getSupabaseServerClient()?.storage.from(WHATSAPP_MEDIA_BUCKET).remove([item.source]);
  }
  revalidatePath("/clinic/tv");
  return { success: true as const };
}

/** Lado da TV: só itens ativos, URLs assinadas por 12 h (a TV recarrega às 4 h). */
export async function getTvMedia(token: string): Promise<TvMediaView[] | null> {
  const tv = await resolveTvDisplay(token);
  if (!tv) return null;
  const rows = await prisma.tvMediaItem.findMany({ where: { clinicId: tv.clinicId, active: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return mediaView(rows, 12);
}
