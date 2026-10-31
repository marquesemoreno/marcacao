/**
 * Teste de restauração do backup (docs/teste-restauracao-backup.md): compara o banco
 * RESTAURADO (RESTORE_TEST_URL no .env) com produção (DATABASE_URL). SÓ LEITURA nos dois.
 * Mostra, por tabela, quantas linhas e o registro mais novo — o restaurado deve bater com
 * produção até a hora do backup (diferença só no que entrou depois).
 *
 *   npx tsx scripts/compare-restored-db.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const restoredUrl = process.env.RESTORE_TEST_URL;
if (!restoredUrl) throw new Error("Defina RESTORE_TEST_URL no .env (connection string do projeto restaurado).");
// Supabase: o usuário do pooler é "postgres.<ref do projeto>" — mesmo ref = mesmo banco.
const projectRef = (url?: string) => url?.match(/\/\/postgres\.([a-z0-9]+)[:@]/)?.[1] ?? url?.match(/db\.([a-z0-9]+)\.supabase/)?.[1] ?? url;
if (projectRef(restoredUrl) === projectRef(process.env.DATABASE_URL)) {
  throw new Error("RESTORE_TEST_URL aponta para o MESMO projeto de produção — use a connection string do projeto restaurado.");
}

const prod = new PrismaClient();
const restored = new PrismaClient({ datasources: { db: { url: restoredUrl } } });

type Stat = { rows: number; newest: string | null };

async function stats(db: PrismaClient): Promise<Map<string, Stat>> {
  const tables = await db.$queryRawUnsafe<{ t: string; has_created: boolean }[]>(`
    SELECT c.table_name AS t,
      bool_or(c.column_name = 'created_at') AS has_created
    FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_name = c.table_name AND tb.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND tb.table_type = 'BASE TABLE'
    GROUP BY c.table_name ORDER BY 1`);
  const out = new Map<string, Stat>();
  for (const { t, has_created } of tables) {
    const [r] = await db.$queryRawUnsafe<{ n: bigint; newest: Date | null }[]>(
      `SELECT count(*) AS n, ${has_created ? "max(created_at)" : "NULL::timestamp"} AS newest FROM "${t}"`,
    );
    out.set(t, { rows: Number(r.n), newest: r.newest ? new Date(r.newest).toISOString().slice(0, 16).replace("T", " ") : null });
  }
  return out;
}

(async () => {
  const [p, r] = await Promise.all([stats(prod), stats(restored)]);
  const names = [...new Set([...p.keys(), ...r.keys()])].sort();
  let missing = 0;
  let empty = 0;
  console.log("tabela".padEnd(38), "produção".padStart(10), "restaurado".padStart(11), "  mais novo (restaurado, UTC)");
  for (const n of names) {
    const a = p.get(n);
    const b = r.get(n);
    if (!b) missing++;
    if (a && a.rows > 0 && b && b.rows === 0) empty++;
    const flag = !b ? "  ❌ FALTA NO RESTAURADO" : a && a.rows > 0 && b.rows === 0 ? "  ❌ VAZIA" : "";
    console.log(n.padEnd(38), String(a?.rows ?? "-").padStart(10), String(b?.rows ?? "-").padStart(11), " ", b?.newest ?? "", flag);
  }
  const lag = r.get("messages")?.newest;
  console.log(`\nTabelas: ${names.length} · faltando: ${missing} · vazias no restaurado: ${empty} · última mensagem no backup: ${lag ?? "?"} UTC`);
  console.log(missing || empty ? "RESULTADO: ❌ restauração incompleta" : "RESULTADO: ✅ restauração completa (diferenças de contagem = o que entrou depois do backup)");
  await prod.$disconnect();
  await restored.$disconnect();
})();
