import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Trava da barreira LGPD: nenhuma chamada a modelo de IA fora de src/lib/ai-gateway.ts.
 * Se este teste falhar, use aiChat / aiJev / aiTranscribe do gateway em vez de chamar
 * a API direto — senão os dados do paciente vão sem máscara. */
const SRC = join(__dirname, "..");
const ALLOWED = new Set(["lib/ai-gateway.ts"]);

const FORBIDDEN: Array<[RegExp, string]> = [
  [/new\s+OpenAI\s*\(/, "cria cliente OpenAI"],
  [/^\s*import\s+(?!type\b)[^;]*from\s+["']openai/m, "importa o SDK da OpenAI (use `import type`)"],
  [/\.chat\.completions\.create\s*\(/, "chama chat.completions direto"],
  [/audio\.transcriptions/, "chama transcrição direto"],
  [/api\.openai\.com/, "chama a API da OpenAI direto"],
  [/api\.typesafe\.ai/, "chama o Jev direto"],
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe("barreira LGPD — portão único da IA", () => {
  it("nenhum arquivo fala com a IA sem passar por src/lib/ai-gateway.ts", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).split(sep).join("/");
      if (ALLOWED.has(rel)) continue;
      const code = readFileSync(file, "utf8");
      for (const [re, why] of FORBIDDEN) if (re.test(code)) offenders.push(`${rel}: ${why}`);
    }
    expect(offenders).toEqual([]);
  });
});
