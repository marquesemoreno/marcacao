import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Trava de segurança (auditoria 17/11/2026): o Supabase publica toda tabela do schema
 * `public` pela API REST com a chave `anon`, que vai no JavaScript do site. Tabela sem
 * RLS = qualquer pessoa lê, altera e apaga, sem login. Em 15/09 o RLS foi ligado nas
 * tabelas da época, mas 36 tabelas criadas depois ficaram abertas porque nada cobrava.
 *
 * Se este teste falhar: acrescente na MESMA migration que cria a tabela
 *   ALTER TABLE "nome_da_tabela" ENABLE ROW LEVEL SECURITY;
 * O app conecta como dono do banco (Prisma) e não é afetado. */
const MIGRATIONS = join(__dirname, "..", "..", "prisma", "migrations");

function readMigrations(): string {
  return readdirSync(MIGRATIONS)
    .sort()
    .map((dir) => join(MIGRATIONS, dir, "migration.sql"))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

const name = (raw: string) => raw.replace(/"/g, "").replace(/^public\./, "");

describe("RLS em toda tabela criada por migration", () => {
  it("cada CREATE TABLE tem o seu ENABLE ROW LEVEL SECURITY", () => {
    const sql = readMigrations();
    const table = String.raw`((?:"?public"?\.)?"?[A-Za-z_][A-Za-z0-9_]*"?)`;
    const created = [...sql.matchAll(new RegExp(String.raw`CREATE TABLE\s+(?:IF NOT EXISTS\s+)?${table}`, "gi"))].map((m) => name(m[1]));
    const dropped = new Set([...sql.matchAll(new RegExp(String.raw`DROP TABLE\s+(?:IF EXISTS\s+)?${table}`, "gi"))].map((m) => name(m[1])));
    const secured = new Set(
      [...sql.matchAll(new RegExp(String.raw`ALTER TABLE\s+(?:IF EXISTS\s+)?${table}\s+ENABLE ROW LEVEL SECURITY`, "gi"))].map((m) => name(m[1])),
    );
    expect(created.length).toBeGreaterThan(50); // o leitor achou as migrations
    const open = [...new Set(created)].filter((t) => !dropped.has(t) && !secured.has(t)).sort();
    expect(open).toEqual([]);
  });
});
