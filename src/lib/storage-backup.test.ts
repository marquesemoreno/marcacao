import { describe, expect, it } from "vitest";
import { storageBackupConfig, nextStorageMarker } from "./storage-backup";

describe("storageBackupConfig", () => {
  it("desligado sem todas as chaves", () => {
    expect(storageBackupConfig({ BACKUP_S3_ENDPOINT: "https://x.r2.cloudflarestorage.com" })).toBeNull();
  });
  it("monta a config com região padrão auto (R2)", () => {
    expect(
      storageBackupConfig({
        BACKUP_S3_ENDPOINT: "https://x.r2.cloudflarestorage.com",
        BACKUP_S3_BUCKET: "conecta-backup",
        BACKUP_S3_ACCESS_KEY_ID: "id",
        BACKUP_S3_SECRET_ACCESS_KEY: "segredo",
      }),
    ).toEqual({ endpoint: "https://x.r2.cloudflarestorage.com", bucket: "conecta-backup", accessKeyId: "id", secretAccessKey: "segredo", region: "auto" });
  });
});

describe("nextStorageMarker", () => {
  it("avança para o último arquivo copiado do lote", () => {
    const at = new Date("2026-10-31T10:00:00Z");
    expect(nextStorageMarker(null, [{ name: "a/1.jpg", createdAt: at }, { name: "a/2.jpg", createdAt: at }])).toEqual({ createdAt: at.toISOString(), name: "a/2.jpg" });
  });
  it("lote vazio mantém o marcador", () => {
    const m = { createdAt: "2026-10-30T00:00:00.000Z", name: "x" };
    expect(nextStorageMarker(m, [])).toBe(m);
  });
});
