import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/request-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { nextStorageMarker, storageBackupConfig, type StorageMarker } from "@/lib/storage-backup";

export const maxDuration = 300;

const BATCH = 200;
const TIME_BUDGET_MS = 240_000;

/** De hora em hora (vercel.json): copia os arquivos novos de todos os buckets do Storage
 * para o bucket de backup (BACKUP_S3_*), na chave "<bucket>/<caminho>". Incremental: o
 * marcador (último arquivo copiado) fica em webhook_logs event "storage.backup". Para no
 * primeiro erro para não pular arquivo; a próxima rodada tenta de novo dali. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const config = storageBackupConfig(process.env);
  const supabase = getSupabaseServerClient();
  if (!config || !supabase) return NextResponse.json({ skipped: "BACKUP_S3_* ou Supabase não configurados" });

  const started = Date.now();
  const last = await prisma.webhookLog.findFirst({ where: { event: "storage.backup" }, orderBy: { createdAt: "desc" }, select: { payload: true } });
  const marker = (last?.payload as { marker?: StorageMarker } | null)?.marker ?? null;

  const after = marker
    ? Prisma.sql`WHERE (created_at, name) > (${new Date(marker.createdAt)}::timestamptz, ${marker.name})`
    : Prisma.empty;
  const objects = await prisma.$queryRaw<{ bucket_id: string; name: string; created_at: Date; mimetype: string | null }[]>`
    SELECT bucket_id, name, created_at, metadata->>'mimetype' AS mimetype
    FROM storage.objects ${after}
    ORDER BY created_at, name LIMIT ${BATCH}`;

  const s3 = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: true,
  });

  const copied: { name: string; createdAt: Date }[] = [];
  let error: string | null = null;
  for (const o of objects) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const { data, error: dlError } = await supabase.storage.from(o.bucket_id).download(o.name);
    if (dlError || !data) {
      error = `download ${o.bucket_id}/${o.name}: ${dlError?.message ?? "vazio"}`;
      break;
    }
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: `${o.bucket_id}/${o.name}`,
          Body: Buffer.from(await data.arrayBuffer()),
          ContentType: o.mimetype ?? undefined,
        }),
      );
    } catch (e) {
      error = `upload ${o.bucket_id}/${o.name}: ${e instanceof Error ? e.message : String(e)}`;
      break;
    }
    copied.push({ name: o.name, createdAt: o.created_at });
  }

  const newMarker = nextStorageMarker(marker, copied);
  if (copied.length || error) {
    await prisma.webhookLog.create({
      data: { event: "storage.backup", payload: { marker: newMarker, copied: copied.length, error }, status: error ? "error" : "ok" },
    });
  }
  return NextResponse.json({ copied: copied.length, pendingInBatch: objects.length - copied.length, error });
}
