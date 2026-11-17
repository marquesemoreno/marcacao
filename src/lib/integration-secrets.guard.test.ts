import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

/** Trava da auditoria de segurança 16/11/2026, M6: WhatsappInstance.apiKey,
 * HospitalIntegration.apiToken e InstagramAccount.accessToken ficam cifrados no banco.
 * Quem lê a linha do banco tem que passar por decryptToken — senão manda o valor cifrado
 * no cabeçalho e a integração para. Esta trava pega leitura direta nos nomes usados hoje
 * para a linha do banco (instance, dedicated, integration, account…). */
const ROW_READ = /\b(instance|dedicated|dedicatedInstance|inst|i|existing|integration|account|a)\.(apiKey|apiToken|accessToken)\b/g;
// Telas e ações da API oficial (WhatsappCloudAccount) já decifram por conta própria.
const SKIP = [/whatsapp-cloud/i, /\.test\.tsx?$/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("chaves de integração cifradas (M6)", () => {
  it("nenhuma leitura direta de apiKey/apiToken/accessToken da linha do banco", () => {
    const offenders: string[] = [];
    for (const file of [...files("src"), ...files("scripts")]) {
      if (SKIP.some((r) => r.test(file))) continue;
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, n) => {
          for (const m of line.matchAll(ROW_READ)) {
            const before = line.slice(0, m.index);
            if (/decryptToken\($/.test(before) || /isEncryptedToken\($/.test(before)) continue;
            offenders.push(`${file}:${n + 1}  ${m[0]}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
