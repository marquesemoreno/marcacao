#manual #banco-de-dados #manutencao

> [!info] Sobre esta nota
> Guia prático do dia a dia. Parte de [[00 - Visão Geral]]. Pressupõe o setup de [[01 - Setup e Infraestrutura]] e o schema de [[02 - Dicionário de Dados e Banco]].

> [!danger] Não existe painel administrativo com formulários ainda
> As rotas `/admin/dashboard` e `/clinic/dashboard` (ver [[00 - Visão Geral]]) hoje só exibem números fixos e uma tabela vazia — não há formulário de cadastro de clínica, exame, preço ou comissão em nenhuma tela. Todo procedimento abaixo usa o **Prisma Studio** (UI de administração de banco que já vem com o Prisma) ou SQL direto, até que o painel real seja construído.

> [!warning] `DATABASE_URL` hoje aponta para o Supabase, não para o Docker local
> Desde a migração do schema de saúde, o `.env` do ambiente de desenvolvimento está configurado com a connection string do Supabase (`db.vmkfdvrvdawjdsaxfugf.supabase.co`), não com o Postgres do `docker-compose.yml`. Ou seja: `npx prisma studio`, migrações e o seed hoje operam **direto no banco do Supabase**, não em um banco local isolado. O `docker-compose.yml` continua existindo para quem preferir rodar 100% local — nesse caso, troque o `DATABASE_URL` de volta antes de migrar (ver [[01 - Setup e Infraestrutura]]).

## Como abrir o Prisma Studio

```bash
npx prisma studio
```

Abre em `http://localhost:5555` uma interface para ver e editar as tabelas descritas em [[02 - Dicionário de Dados e Banco]] diretamente. Exige que `DATABASE_URL` esteja configurado e as migrações aplicadas.

## Como cadastrar uma nova clínica parceira manualmente

1. Rode `npx prisma studio`.
2. Abra a tabela `clinics` (model `Clinic`) e clique em **Add record**.
3. Preencha `name` (razão social), `tradeName` (nome fantasia), `cnpj` (único), `address`, `neighborhood`, `city`, e opcionalmente `phone`/`whatsapp`.
4. Defina `commissionRate` (percentual de comissão da plataforma sobre essa clínica — ver seção de comissão abaixo) e `active` (`true` para já entrar no ar).
5. Salve. `id`, `createdAt`, `updatedAt` são preenchidos automaticamente.

> [!note] Ainda não há vínculo formal entre `User` e `Clinic`
> Para dar acesso de login a alguém dessa clínica, crie um registro em `users` com `role = CLINIC` — mas hoje `User` não tem nenhuma FK para `clinics` (ver [[02 - Dicionário de Dados e Banco]]), então esse vínculo é só pelo papel, não é rastreável no banco ainda. Também não há hash de senha automático: `User.passwordHash` precisa de um valor já hasheado (ex: bcrypt), e a autenticação (NextAuth) ainda não está implementada — ver [[03 - APIs e Webhooks n8n]].

**Alternativa via SQL direto** (funciona tanto no Supabase quanto num Postgres local via Docker):

```sql
INSERT INTO clinics (id, name, trade_name, cnpj, phone, whatsapp, address, neighborhood, city, active, commission_rate, created_at, updated_at)
VALUES (gen_random_uuid()::text, 'Clínica Exemplo Ltda', 'Clínica Exemplo', '11.222.333/0001-44', '+55 11 90000-0000', '+55 11 90000-0000', 'Rua Exemplo, 123', 'Centro', 'São Paulo', true, 15.00, now(), now());
```

## Como adicionar novos exames/consultas, regras de jejum e preços

O catálogo é dividido em duas tabelas (ver [[02 - Dicionário de Dados e Banco]]):
- **`procedures`** — o procedimento em si (nome, categoria, instruções de preparo), independente de clínica.
- **`clinic_procedures`** — o preço e a forma de agendamento *daquele procedimento naquela clínica específica*.

### 1. Cadastrar o procedimento (se ainda não existir no catálogo)

No Prisma Studio, abra `procedures` → **Add record**:
- `name`: ex. `"Ressonância Magnética"` (precisa ser único no catálogo).
- `category`: `CONSULTATION`, `EXAM` ou `SURGERY`.
- `specialtyId`: opcional — só preencha para consultas vinculadas a uma especialidade (`specialties`).
- `description`: texto livre para o paciente.
- `preparationInstructions`: **é aqui que entram as regras de jejum**, ex: `"Jejum de 6 horas. Remover objetos metálicos."` — texto livre, não é um campo dedicado só a jejum.

### 2. Oferecer o procedimento em uma clínica, com preço

Abra `clinic_procedures` → **Add record**:
- `clinicId` / `procedureId`: os `id`s da clínica e do procedimento.
- `price`: preço cheio.
- `promotionalPrice`: opcional, preço promocional.
- `requiresAppointment`: `true`/`false`.
- `appointmentType`: `SCHEDULED` (horário marcado) ou `ARRIVAL_ORDER` (ordem de chegada).

> [!note] Um procedimento, vários preços
> O mesmo procedimento (ex: "Hemograma Completo") pode ter uma linha em `clinic_procedures` para cada clínica que o oferece, cada uma com seu próprio preço — é assim que o seed (`prisma/seed.ts`) popula os dados, ver [[01 - Setup e Infraestrutura]].

## Como alterar as regras de comissão

A comissão é por clínica, direto no campo `Clinic.commissionRate` (`Decimal(5,2)`, percentual).

1. No Prisma Studio, abra `clinics`, localize a clínica e edite `commissionRate` (ex: `15.00` para 15%).
2. Salve.

```sql
UPDATE clinics SET commission_rate = 15.00 WHERE trade_name = 'Clínica São Lucas';
```

> [!note] Só existe comissão por clínica hoje
> Não há campo de comissão em `Procedure` nem em `ClinicProcedure` — se for necessário ter comissão diferente por procedimento (não só por clínica inteira), isso exige uma migração nova (`commissionRate` em `ClinicProcedure`, por exemplo).

## Como resolver problemas e ler logs de erro

### Erros do servidor de desenvolvimento
`npm run dev` imprime erros de compilação e de runtime (Server Components, Server Actions) diretamente no terminal onde o comando está rodando, e também no overlay de erro no navegador em desenvolvimento.

### Erros do Prisma / banco de dados
`src/lib/prisma.ts` configura o log do Prisma Client:

```ts
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
```

Em desenvolvimento, avisos e erros de query aparecem no terminal do `npm run dev`. Erros comuns:
- **`Can't reach database server`**: `DATABASE_URL` está errado, ou (se estiver usando o Docker local em vez do Supabase) o container `postgres` não está rodando — ver [[01 - Setup e Infraestrutura]].
- **`Table 'xxx' does not exist`**: faltou rodar `npx prisma migrate dev`.
- **`Unique constraint failed`**: violação de campo único (`email`, `cnpj`, `procedures.name`) — verifique duplicidade antes de inserir.

### Erros de build de produção

```bash
npm run build
```
O script roda `prisma generate && next build`. Erros de tipo (`tsc`) e de lint aparecem antes de "Compiled successfully".

> [!warning] Ambiente com pouca memória pode derrubar o build
> Em máquinas com pouca RAM livre, `next build` pode falhar com erro de "out of memory" mesmo com o código correto (aconteceu neste projeto: o `tsc --noEmit` passou limpo, mas o `next build` crashou por falta de memória do sistema, não por bug de código). Se isso acontecer, feche outros programas para liberar memória e rode `npm run build` de novo — não é necessariamente um problema no código.

### Checklist rápido quando algo não sobe

1. `.env` existe e `DATABASE_URL` aponta para um banco realmente acessível (Supabase ou Docker local)?
2. `npx prisma validate` — o schema está sintaticamente correto?
3. `npx prisma generate` foi rodado após a última mudança no schema?
4. `npx prisma migrate dev` foi aplicado (as tabelas existem de fato no banco)?
5. Se usando Docker local: `docker compose ps` — o container `postgres` está `Up`?

## Notas relacionadas

- [[00 - Visão Geral]]
- [[01 - Setup e Infraestrutura]]
- [[02 - Dicionário de Dados e Banco]]
- [[03 - APIs e Webhooks n8n]]
