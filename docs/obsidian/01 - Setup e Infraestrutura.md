#infraestrutura #setup #docker

> [!info] Sobre esta nota
> Como rodar o projeto localmente. Parte de [[00 - Visão Geral]]. Para o schema do banco que essas migrações criam, ver [[02 - Dicionário de Dados e Banco]].

## Rodando localmente com Docker

O `docker-compose.yml` sobe **apenas o PostgreSQL** — a aplicação Next.js roda fora do container em desenvolvimento (`npm run dev`), e só é containerizada via `Dockerfile` para build de produção.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: marcacao
      POSTGRES_PASSWORD: marcacao
      POSTGRES_DB: marcacao
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Passo a passo:**

```bash
# 1. Subir o Postgres em background
docker compose up -d

# 2. Instalar dependências
npm install

# 3. Copiar o .env de exemplo (ver dicionário de variáveis abaixo)
cp .env.example .env

# 4. Rodar a primeira migração (cria as tabelas)
npx prisma migrate dev --name init

# 5. Subir o servidor de desenvolvimento
npm run dev
```

A aplicação sobe em `http://localhost:3000`.

> [!warning] Setup local via Docker ainda não validado de ponta a ponta
> As credenciais do `docker-compose.yml` (`marcacao`/`marcacao`) foram definidas ao criar o arquivo, mas o `docker compose up` nunca foi executado neste ambiente (Docker não estava disponível). A migração e o seed **foram** validados de verdade, só que contra o Supabase (ver seção abaixo) — não contra este Postgres local. Rode os comandos acima quando for usar o caminho 100% local e ajuste este aviso.

## Ambiente atual: Supabase

O `.env` de desenvolvimento deste projeto está apontando para um banco **Postgres hospedado no Supabase**, não para o `docker-compose.yml` local — foi contra ele que a migração `20260815230834_init_healthcare_schema` e o seed (ver [[02 - Dicionário de Dados e Banco]]) rodaram de fato.

```
host=db.vmkfdvrvdawjdsaxfugf.supabase.co
port=5432
database=postgres
user=postgres
```

> [!danger] Senha não fica nesta nota
> A senha de conexão está apenas no `.env` local (arquivo no `.gitignore`, nunca commitado) — não a copie para nenhuma nota do Obsidian nem para o repositório. Peça a credencial de quem administra o projeto se precisar reconectar.

Rodando contra este banco, os comandos são os mesmos da seção de comandos principais abaixo — a única diferença é não precisar do `docker compose up`, já que o Postgres já está no ar (no Supabase).

### Build de produção via Docker

```bash
docker build -t marcacao .
docker run -p 3000:3000 --env-file .env marcacao
```

O `Dockerfile` usa build multi-stage (`deps` → `builder` → `runner`) e depende de `output: "standalone"` no `next.config.mjs` para gerar um bundle mínimo. O estágio `builder` roda `npx prisma generate` antes do `next build`, então o `DATABASE_URL` precisa estar acessível nesse momento (mesmo que apenas para gerar o client, não para conectar de fato).

## Dicionário de variáveis de ambiente

> [!warning] Hoje só existe `DATABASE_URL`
> O restante da tabela abaixo (autenticação, notificações) é a expectativa **futura** com base no stack planejado em [[00 - Visão Geral]] — essas variáveis ainda não são lidas em nenhum lugar do código. Adicione-as ao `.env` e ao `.env.example` somente quando a funcionalidade correspondente for implementada.

| Variável | Status | Exemplo | Descrição |
|---|---|---|---|
| `DATABASE_URL` | ✅ Em uso (`src/lib/prisma.ts`, `prisma/schema.prisma`) | Local: `postgresql://marcacao:marcacao@localhost:5432/marcacao?schema=public` · Supabase: `postgresql://postgres:SENHA@db.vmkfdvrvdawjdsaxfugf.supabase.co:5432/postgres` | String de conexão do PostgreSQL. Hoje o `.env` de desenvolvimento usa o Supabase (ver [[00 - Visão Geral]]) — pegue a senha real com quem administra o projeto |
| `NEXTAUTH_SECRET` | 🚧 Planejada, não implementada | `openssl rand -base64 32` (gerar um valor aleatório) | Segredo usado pelo NextAuth para assinar sessões/JWT quando a autenticação for implementada |
| `NEXTAUTH_URL` | 🚧 Planejada, não implementada | `http://localhost:3000` | URL base da aplicação, exigida pelo NextAuth em produção |
| `N8N_WEBHOOK_URL` | 🚧 Planejada, não implementada | `https://seu-n8n.exemplo.com/webhook/agendamentos` | Endpoint do n8n que receberia os eventos de agendamento — ver [[03 - APIs e Webhooks n8n]] |

O `.env` está no `.gitignore` (nunca deve ser commitado); use `.env.example` como referência de quais chaves existem.

## Comandos principais

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências |
| `npm run dev` | Sobe o servidor de desenvolvimento (`http://localhost:3000`) |
| `npm run build` | Build de produção (Next.js) |
| `npm run start` | Roda o build de produção localmente |
| `npm run lint` | ESLint (`next lint`) |
| `npx prisma generate` | Gera o Prisma Client a partir do `schema.prisma` (necessário após qualquer alteração no schema) |
| `npx prisma migrate dev --name <nome>` | Cria e aplica uma nova migração em desenvolvimento |
| `npx prisma migrate deploy` | Aplica migrações pendentes em produção (sem gerar novas) |
| `npx prisma studio` | Abre uma UI web para visualizar/editar dados do banco — ver [[04 - Manual de Edição Manual e Manutenção]] |
| `npx prisma validate` | Valida a sintaxe do `schema.prisma` |
| `npx prisma db seed` | Roda `prisma/seed.ts` (clínicas, especialidades, procedimentos e preços de exemplo) |

> [!success] Seed implementado e já executado
> `prisma/seed.ts` existe, é rodado via `npx prisma db seed` (configurado em `package.json` → `"prisma": { "seed": "tsx prisma/seed.ts" }`) e já populou o banco atual (Supabase) com: 3 clínicas parceiras, 4 especialidades (Clínica Geral, Cardiologia, Oftalmologia, Dermatologia), 9 procedimentos (4 consultas + 5 exames: Ultrassom, Hemograma, Tomografia, ECG, Colonoscopia) e 12 vínculos clínica×procedimento com preços. O script usa `upsert`, então é seguro rodar de novo — não duplica dados.

## Notas relacionadas

- [[00 - Visão Geral]]
- [[02 - Dicionário de Dados e Banco]]
- [[04 - Manual de Edição Manual e Manutenção]]
