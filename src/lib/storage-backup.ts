/** Cópia dos arquivos do Supabase Storage (fotos, áudios, PDFs do WhatsApp) para um bucket
 * fora do Supabase compatível com S3 (Cloudflare R2, Backblaze B2…). O backup do banco não
 * inclui o Storage — visto no teste de restauração de 31/10/2026. */
export type StorageBackupConfig = { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region: string };

export function storageBackupConfig(env: Record<string, string | undefined>): StorageBackupConfig | null {
  const endpoint = env.BACKUP_S3_ENDPOINT?.trim();
  const bucket = env.BACKUP_S3_BUCKET?.trim();
  const accessKeyId = env.BACKUP_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.BACKUP_S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, region: env.BACKUP_S3_REGION?.trim() || "auto" };
}

export type StorageMarker = { createdAt: string; name: string };

/** Marcador = último arquivo copiado (ordem created_at, name). Próxima rodada continua dali. */
export function nextStorageMarker(
  current: StorageMarker | null,
  copied: { name: string; createdAt: Date }[],
): StorageMarker | null {
  const last = copied[copied.length - 1];
  return last ? { createdAt: last.createdAt.toISOString(), name: last.name } : current;
}
