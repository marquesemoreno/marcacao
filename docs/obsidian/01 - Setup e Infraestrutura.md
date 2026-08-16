#infraestrutura #setup #docker

> [!info] Sobre esta nota
> Como rodar o projeto localmente. Parte de [[00 - Visão Geral]]. Para o schema do banco que essas migrações criam, ver [[02 - Dicionário de Dados e Banco]]. Para as variáveis específicas do inbox/chat (Supabase Realtime), ver também [[05 - Módulo de Atendimento e Chat Realtime]].

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

### Build de produção via Docker (imagem isolada)

```bash
docker build -t marcacao .
docker run -p 3000:3000 --env-file .env marcacao
```

O `Dockerfile` usa build multi-stage (`deps` → `builder` → `runner`) e depende de `output: "standalone"` no `next.config.mjs` para gerar um bundle mínimo.

> [!success] Build funciona sem nenhuma variável de ambiente
> Testado explicitamente (rodando `npm run build` sem `.env` presente): `prisma generate` não precisa de `DATABASE_URL` (só lê o schema, não conecta), e desde que a home (`src/app/(public)/page.tsx`) ganhou `export const dynamic = "force-dynamic"`, nenhuma página é pré-renderizada estaticamente consultando o banco — então `next build` também não precisa de banco acessível. Antes dessa mudança, a home era pré-renderizada (`○`) e chamava `searchClinicProcedures` em build-time, o que quebraria um `docker build` limpo (Postgres/dados ainda não existem na primeira vez) e deixaria preços/avaliações "congelados" no instante do build até o próximo deploy.

## Deploy completo: docker-compose.prod.yml (App + Postgres + Nginx)

Diferente do `docker-compose.yml` (só Postgres, para dev local), `docker-compose.prod.yml` sobe a stack inteira: Postgres, o app Next.js (a partir do `Dockerfile`) e um Nginx como reverse proxy na porta 80. Nem o Postgres nem o app expõem porta ao host diretamente — só o Nginx.

```bash
# 1. Copiar e preencher as variáveis (nunca comitar o resultado)
cp .env.prod.example .env.prod

# 2. Subir tudo (constrói as imagens, roda a migração, depois sobe o app e o nginx)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Ordem de subida, orquestrada pelo `depends_on` do compose:
1. `postgres` sobe e só é considerado pronto quando o `healthcheck` (`pg_isready`) passa.
2. `migrate` — serviço que builda até o estágio `builder` do `Dockerfile` (o único que tem o CLI do Prisma e a pasta `prisma/`; o estágio final `runner` é um bundle standalone sem eles) e roda `npx prisma migrate deploy` uma vez. `app` só inicia depois que `migrate` termina com sucesso (`condition: service_completed_successfully`).
3. `app` e `nginx` sobem.

> [!danger] Sem seed automático em produção — de propósito
> `docker-compose.prod.yml` **não** roda `prisma db seed`. Os dados do seed são de demonstração, com senhas previsíveis e comitadas em `prisma/seed.ts` (ver [[04 - Manual de Edição Manual e Manutenção]]) — não é algo que deveria existir num banco de produção. Se quiser rodar o seed mesmo assim (ex: ambiente de staging), faça manualmente: `docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate npx prisma db seed`.

> [!warning] Sem TLS configurado
> `deploy/nginx.conf` escuta só na porta 80 (HTTP puro). Para HTTPS de verdade, coloque um proxy com certificado na frente (Nginx com certbot, Caddy, um load balancer gerenciado) ou edite `deploy/nginx.conf` adicionando um bloco `server` na porta 443 com seus próprios certificados. Isso não foi implementado — não fingir que existe.

> [!warning] `docker compose` não pôde ser executado neste ambiente
> Docker não estava disponível onde este projeto foi desenvolvido. O `docker-compose.prod.yml` e o `deploy/nginx.conf` foram validados como YAML sintaticamente correto e revisados manualmente linha a linha, mas **não foram testados de ponta a ponta** subindo os containers de verdade. Valide com `docker compose -f docker-compose.prod.yml config` antes do primeiro deploy real.

## Dicionário de variáveis de ambiente

> [!success] Autenticação e WhatsApp implementados
> `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` e as variáveis de WhatsApp abaixo estão todas em uso (`src/lib/auth.ts`, `src/middleware.ts`, `src/lib/whatsapp.ts`). As variáveis de WhatsApp são as únicas realmente opcionais: sem elas, o app roda normalmente e só loga `SKIPPED` em vez de enviar mensagens — ver [[03 - APIs e Webhooks n8n]].

| Variável | Status | Exemplo | Descrição |
|---|---|---|---|
| `DATABASE_URL` | ✅ Em uso (`src/lib/prisma.ts`, `prisma/schema.prisma`) | Local: `postgresql://marcacao:marcacao@localhost:5432/marcacao?schema=public` · Supabase: `postgresql://postgres:SENHA@db.vmkfdvrvdawjdsaxfugf.supabase.co:5432/postgres` | String de conexão do PostgreSQL. Hoje o `.env` de desenvolvimento usa o Supabase (ver [[00 - Visão Geral]]) — pegue a senha real com quem administra o projeto |
| `NEXTAUTH_SECRET` | ✅ Em uso (`src/lib/auth.ts`) | Gerar com `openssl rand -base64 32` (ou `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) | Segredo usado pelo NextAuth para assinar sessões/JWT. Sem ele, login falha silenciosamente |
| `NEXTAUTH_URL` | ✅ Em uso (`src/lib/auth.ts`, `src/lib/whatsapp-templates.ts`) | `http://localhost:3000` | URL base da aplicação — usada também para montar o link de acompanhamento nas mensagens de WhatsApp |
| `WHATSAPP_PROVIDER` | ✅ Em uso, opcional (`src/lib/whatsapp.ts`) | `evolution` (padrão) · `uazapi` · `zapi` | Qual formato de requisição usar — os três provedores têm contratos HTTP diferentes, ver [[03 - APIs e Webhooks n8n]] |
| `WHATSAPP_API_URL` | ✅ Em uso, opcional | `https://sua-instancia-evolution.exemplo.com` | URL base da instância do provedor de WhatsApp |
| `WHATSAPP_API_KEY` | ✅ Em uso, opcional | `sua-api-key` | Chave/token de autenticação do provedor |
| `WHATSAPP_INSTANCE_NAME` | ✅ Em uso, opcional | `marcacao` | Nome da instância (Evolution API/UAZAPI) — parte da URL/corpo da requisição |
| `WHATSAPP_WEBHOOK_SECRET` | ✅ Em uso, opcional | valor aleatório | Se definido, `/api/webhooks/whatsapp` exige esse valor no header `x-webhook-token`. **Recomendado em produção** |
| `NEXT_PUBLIC_SUPABASE_URL` | 🚧 Em uso no código, **não configurado** neste ambiente (`src/lib/supabase-client.ts`) | `https://xxxxx.supabase.co` | URL do projeto Supabase — necessária só para o cliente de **Realtime** do inbox (WebSocket). A conexão de banco (`DATABASE_URL`) já funciona sem ela |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 🚧 Em uso no código, **não configurado** neste ambiente (`src/lib/supabase-client.ts`) | chave pública do projeto Supabase | Chave anônima do Supabase, usada pelo navegador para abrir o canal Realtime. Sem ela (e sem `NEXT_PUBLIC_SUPABASE_URL`), o inbox funciona normalmente por **polling** a cada 5s — ver [[05 - Módulo de Atendimento e Chat Realtime]] |

> [!warning] As 4 variáveis de WhatsApp são "tudo ou nada"
> `WHATSAPP_API_URL`, `WHATSAPP_API_KEY` e `WHATSAPP_INSTANCE_NAME` precisam estar **todas** preenchidas para o envio ser tentado (`WhatsAppService.isConfigured()`) — falta uma, e o serviço trata como "desligado" (loga `SKIPPED`, não tenta enviar, não dá erro). `WHATSAPP_PROVIDER` sozinho não ativa nada.

O `.env` está no `.gitignore` (nunca deve ser commitado); use `.env.example` como referência de quais chaves existem.

## Comandos principais

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências |
| `npm run dev` | Sobe o servidor de desenvolvimento (`http://localhost:3000`) |
| `npm run build` | Build de produção (Next.js) |
| `npm run start` | Roda o build de produção localmente |
| `npm run lint` | ESLint (`next lint`) |
| `npm test` | Roda a suíte de testes uma vez (Vitest) — ver [[04 - Manual de Edição Manual e Manutenção]] |
| `npm run test:watch` | Vitest em modo watch, para desenvolvimento |
| `npx prisma generate` | Gera o Prisma Client a partir do `schema.prisma` (necessário após qualquer alteração no schema) |
| `npx prisma migrate dev --name <nome>` | Cria e aplica uma nova migração em desenvolvimento |
| `npx prisma migrate deploy` | Aplica migrações pendentes em produção (sem gerar novas) |
| `npx prisma studio` | Abre uma UI web para visualizar/editar dados do banco — ver [[04 - Manual de Edição Manual e Manutenção]] |
| `npx prisma validate` | Valida a sintaxe do `schema.prisma` |
| `npx prisma db seed` | Roda `prisma/seed.ts` (clínicas, especialidades, procedimentos e preços de exemplo) |

> [!success] Seed implementado e já executado
> `prisma/seed.ts` existe, é rodado via `npx prisma db seed` (configurado em `package.json` → `"prisma": { "seed": "tsx prisma/seed.ts" }`) e já populou o banco atual (Supabase) com: 3 clínicas parceiras (com horário de atendimento padrão), 4 especialidades (Clínica Geral, Cardiologia, Oftalmologia, Dermatologia), 9 procedimentos (4 consultas + 5 exames: Ultrassom, Hemograma, Tomografia, ECG, Colonoscopia), 12 vínculos clínica×procedimento com preços, e 4 usuários de login (1 admin + 1 por clínica) — credenciais em [[04 - Manual de Edição Manual e Manutenção]]. O script usa `upsert`, então é seguro rodar de novo — não duplica dados.

## Histórico de migrações

Em ordem de aplicação, todas contra o Supabase (ver seção acima):

1. `20260815230834_init_healthcare_schema` — schema inicial (clínicas, procedimentos, agendamentos).
2. `20260815235715_add_clinic_rating` — `Clinic.rating` e `Clinic.reviewCount`, para o portal público (ver [[00 - Visão Geral]]).
3. `20260816003001_add_auth_and_clinic_settings` — `User.clinicId`, status `AppointmentStatus.NO_SHOW`, `Clinic.businessHours` — suporte à autenticação e aos painéis (ver [[03 - APIs e Webhooks n8n]]).
4. `20260816022709_add_inbox_module` — `Contact`, `Conversation`, `Message`, `CannedResponse` + RLS (deny-by-default) e publicação condicional `supabase_realtime` nas tabelas novas — suporte ao inbox de chat (ver [[05 - Módulo de Atendimento e Chat Realtime]]).

## Dependência nova: `@supabase/supabase-js`

Instalada via `npm install @supabase/supabase-js` (`^2.112.3` no `package.json`) — usada só pelo cliente de Realtime do inbox (`src/lib/supabase-client.ts`), opcional e client-side. Não afeta a conexão de banco (`DATABASE_URL`/Prisma), que continua sendo a via principal de acesso a dados em todo o resto da aplicação.

## Notas relacionadas

- [[00 - Visão Geral]]
- [[02 - Dicionário de Dados e Banco]]
- [[04 - Manual de Edição Manual e Manutenção]]
- [[05 - Módulo de Atendimento e Chat Realtime]]
