/** Importa marcadores de um JSON [{name, phones[]}] (extraído dos cartões de contato do
 * WhatsApp) pra uma clínica. Dry-run por padrão; --apply grava.
 * Uso: npx tsx scripts/import-marcadores.ts <arquivo.json> <clinicId> [--apply] */
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { cleanMarcadorName, makeMarcadorCode, phoneTail } from "../src/lib/marcadores";

const [file, clinicId] = process.argv.slice(2);
const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function main() {
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { name: string; phones: string[] }[];
  const existing = await prisma.marcador.findMany({ where: { clinicId }, select: { code: true, phone: true } });
  const codes = new Set(existing.map((m) => m.code));
  const tails = new Set(existing.map((m) => phoneTail(m.phone)));
  const rows: { name: string; phone: string; code: string }[] = [];
  for (const r of raw) {
    const phone = r.phones[0];
    if (!phone || tails.has(phoneTail(phone))) continue;
    tails.add(phoneTail(phone));
    const name = cleanMarcadorName(r.name);
    const code = makeMarcadorCode(name, codes);
    codes.add(code);
    rows.push({ name, phone, code });
  }
  for (const r of rows) console.log(`${r.code.padEnd(20)} ${r.name.padEnd(45)} ${r.phone}`);
  console.log(`${rows.length} novos${apply ? "" : " (dry-run — use --apply)"}`);
  if (apply) await prisma.marcador.createMany({ data: rows.map((r) => ({ ...r, clinicId })) });
}

main().finally(() => prisma.$disconnect());
