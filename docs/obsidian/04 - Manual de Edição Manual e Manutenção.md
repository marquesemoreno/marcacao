#manual #banco-de-dados #manutencao #autenticacao

> [!info] Sobre esta nota
> Guia prático do dia a dia. Parte de [[00 - Visão Geral]]. Pressupõe o setup de [[01 - Setup e Infraestrutura]] e o schema de [[02 - Dicionário de Dados e Banco]]. Para operar o inbox de chat (`/clinic/inbox`) no dia a dia, ver a seção própria abaixo; arquitetura completa em [[05 - Módulo de Atendimento e Chat Realtime]].

> [!success] Painéis reais existem agora
> `/admin` (gestão de clínicas, comissão, relatório financeiro, KPIs) e `/clinic` (agenda, status de agendamento, tabela de preços, horários) são telas de verdade agora, protegidas por login (NextAuth) — não são mais só o Prisma Studio. Esta nota foi atualizada para refletir isso; o que ainda depende do Prisma Studio está marcado explicitamente abaixo.

> [!warning] `DATABASE_URL` hoje aponta para o Supabase, não para o Docker local
> O `.env` de desenvolvimento está configurado com a connection string do Supabase (`db.vmkfdvrvdawjdsaxfugf.supabase.co`), não com o Postgres do `docker-compose.yml`. O `.env` também precisa de `NEXTAUTH_SECRET` e `NEXTAUTH_URL` para o login funcionar (ver [[01 - Setup e Infraestrutura]]).

## Credenciais de teste

Tabela completa e atualizada em [[01 - Setup e Infraestrutura#Acessos (credenciais de desenvolvimento)]] — resumo rápido:

| Painel | E-mail | Senha |
|---|---|---|
| Admin (`/admin`) | `admin@tivdc.com.br` | `Admin@123` |
| Clínica — Santa Clara (`/clinic`) | `santaclara@clinica.com.br` | `Clinica@123` |
| Clínica — Imad (`/clinic`) | `imad@clinica.com.br` | `Clinica@123` |
| Atendente — Santa Clara (`/clinic`, incl. inbox) | `atendente@tivdc.com.br` | `Atendente@123` |

Login em `/entrar`. O middleware (`src/middleware.ts`) redireciona automaticamente por `role` — uma conta `CLINIC` não consegue abrir `/admin`, e vice-versa.

> [!warning] Troque essas senhas antes de qualquer uso real
> São senhas de desenvolvimento, previsíveis, comitadas no `prisma/seed.ts`. Nunca as reaproveite em um ambiente com dados de pacientes de verdade.

## Como cadastrar uma nova clínica parceira

**Pelo painel (recomendado):** login como admin → `/admin/clinicas` → formulário "Cadastrar nova clínica" no fim da página. Preenche `name` (razão social), `tradeName`, `cnpj`, `address`, `neighborhood`, `city`, `phone`/`whatsapp` (opcionais) e `commissionRate`.

> [!warning] Cadastrar a clínica não cria login para ela
> O formulário de `/admin/clinicas` cria só o registro em `clinics`. Para dar acesso de login à equipe dessa clínica, ainda é preciso criar o `User` manualmente (`role = CLINIC`, `clinicId` apontando para a clínica, `passwordHash` já hasheado com bcrypt) — não há tela para isso ainda. Use o Prisma Studio (`npx prisma studio`) ou o script abaixo como referência:
> ```ts
> import bcrypt from "bcryptjs";
> const passwordHash = await bcrypt.hash("SenhaProvisoria123", 10);
> // depois: prisma.user.create({ data: { name, email, role: "CLINIC", clinicId, passwordHash } })
> ```

**Alternativa via SQL direto**, se preferir não usar o painel:

```sql
INSERT INTO clinics (id, name, trade_name, cnpj, phone, whatsapp, address, neighborhood, city, active, commission_rate, created_at, updated_at)
VALUES (gen_random_uuid()::text, 'Clínica Exemplo Ltda', 'Clínica Exemplo', '11.222.333/0001-44', '+55 77 3000-0000', '+55 77 90000-0000', 'Rua Exemplo, 123', 'Centro', 'Vitória da Conquista', true, 15.00, now(), now());
```

## Como adicionar novos exames/consultas, regras de jejum e preços

O catálogo é dividido em duas tabelas (ver [[02 - Dicionário de Dados e Banco]]):
- **`procedures`** — o procedimento em si (nome, categoria, instruções de preparo), independente de clínica.
- **`clinic_procedures`** — o preço e a forma de agendamento *daquele procedimento naquela clínica específica*.

### 1. Cadastrar o procedimento no catálogo (se ainda não existir)

> [!warning] Ainda só via Prisma Studio
> Não existe tela em `/admin` nem `/clinic` para criar um novo `Procedure` no catálogo global — só dá para vincular à clínica procedimentos que **já existem** no catálogo (formulário "Adicionar procedimento" em `/clinic/precos`, ver abaixo). Para criar um procedimento novo:

```bash
npx prisma studio
```
Abra `procedures` → **Add record**:
- `name`: ex. `"Ressonância Magnética"` (precisa ser único no catálogo).
- `category`: `CONSULTATION`, `EXAM` ou `SURGERY`.
- `specialtyId`: opcional — só para consultas vinculadas a uma especialidade (`specialties`).
- `description`: texto livre para o paciente.
- `preparationInstructions`: **é aqui que entram as regras de jejum**, ex: `"Jejum de 6 horas. Remover objetos metálicos."` — texto livre.

### 2. Oferecer o procedimento em uma clínica, com preço

**Pelo painel:** login como a clínica → `/clinic/precos` → seção "Adicionar procedimento" (só lista o que ainda não é oferecido por essa clínica) → escolhe o procedimento, define preço, preço promocional (opcional), se requer agendamento e o tipo (`Horário marcado` ou `Ordem de chegada`).

Para **editar** um procedimento já oferecido (preço, promoção, tipo de atendimento), a mesma página `/clinic/precos` lista cada item da tabela de preços da clínica com um formulário de edição inline e botão "Salvar".

> [!note] Um procedimento, vários preços
> O mesmo procedimento (ex: "Hemograma Completo") pode ter uma linha em `clinic_procedures` para cada clínica que o oferece, cada uma com seu próprio preço.

## Como configurar horários de atendimento

Login como a clínica → `/clinic/precos` → seção "Horários de atendimento", no topo da página. Um formulário por dia da semana: checkbox "Fechado" ou par de campos de horário (abertura/fechamento). Botão "Salvar horários" grava tudo de uma vez em `Clinic.businessHours` (ver [[02 - Dicionário de Dados e Banco]]).

## Como confirmar presença ou mudar o status de um agendamento

Login como a clínica → `/clinic/dashboard` (agenda de hoje) ou `/clinic/agendamentos` (lista completa, com filtro por status). Cada linha tem botões de ação rápida conforme o status atual:

- **Pendente** → `Confirmar` ou `Cancelar`
- **Confirmado** → `Concluir`, `Falta` (no-show) ou `Cancelar`
- **Concluído / Cancelado / Falta** → estados finais, sem ações

Cada botão é um pequeno formulário HTML ligado direto a `updateAppointmentStatus` (`src/actions/clinic.ts`) — funciona mesmo sem JavaScript no navegador (progressive enhancement).

## Como alterar as regras de comissão

Login como admin → `/admin/clinicas` → cada clínica tem um campo "Comissão (%)" editável com botão "Salvar", que grava direto em `Clinic.commissionRate`.

**Alternativa via SQL:**
```sql
UPDATE clinics SET commission_rate = 15.00 WHERE trade_name = 'Clinica Cirurgica Santa Clara';
```

> [!note] Só existe comissão por clínica hoje
> Não há campo de comissão em `Procedure` nem em `ClinicProcedure` — se for necessário ter comissão diferente por procedimento (não só por clínica inteira), isso exige uma migração nova.

## Como consultar (ou testar) as notificações de WhatsApp

Toda tentativa de mensagem — enviada de verdade ou não — fica registrada em `webhook_logs`. Sem `WHATSAPP_API_URL`/`WHATSAPP_API_KEY`/`WHATSAPP_INSTANCE_NAME` configurados (ver [[01 - Setup e Infraestrutura]]), é assim que dá pra conferir o que *seria* enviado, sem precisar de um provedor de verdade:

```bash
npx prisma studio
```
Abra `webhook_logs`, ordene por `created_at` desc. Cada linha tem `event` (`appointment.pending`, `appointment.confirmed`, `appointment.cancelled`, `appointment.completed`, `appointment.no_show` ou `whatsapp.inbound`), `status` (`SUCCESS`/`FAILED`/`SKIPPED`/`IGNORED`) e `payload` com o texto completo da mensagem.

**Para testar o webhook de resposta do paciente** (`/api/webhooks/whatsapp`) sem depender de um provedor real conectado:

```bash
curl -X POST http://localhost:3000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"phone": "11999998888", "text": "SIM"}'
```
Troque `phone` pelo `patientPhone` (só dígitos, sem DDI) de um agendamento `PENDING` ou `CONFIRMED` real. `"SIM"`/`"1"` confirma, `"CANCELAR"`/`"2"` cancela — qualquer outro texto é ignorado (loga `IGNORED`, mas responde `200` do mesmo jeito).

> [!warning] Ative um provedor real com cuidado
> Definir `WHATSAPP_API_URL`/`WHATSAPP_API_KEY`/`WHATSAPP_INSTANCE_NAME` de verdade faz o app **tentar enviar mensagens reais** para os números cadastrados nos agendamentos. Não aponte para uma instância de produção usando dados de teste do seed.

## Como gerenciar leads de clínicas parceiras (`/admin/leads`)

Login como admin → `/admin/leads` — lista todo cadastro de interesse recebido pelo formulário público `/seja-parceiro`. Cada card tem botão "Chamar no WhatsApp" (abre conversa direto com o telefone informado) e um seletor de status (`Novo` → `Em contato` → `Parceiro`/`Recusado`). Arquitetura completa em [[07 - Guia de Encaminhamento e Captação B2B]].

> [!warning] Marcar como "Parceiro" não cadastra a clínica
> Mudar o status pra `PARTNER` é só uma anotação no lead — para a clínica aparecer de verdade na busca pública, ainda é preciso cadastrá-la em `/admin/clinicas` (ver seção acima) e criar o login da equipe manualmente.

## Como usar o Inbox de atendimento (`/clinic/inbox`)

Login como a clínica → link "Inbox" na navegação → 3 colunas: lista de conversas, chat, dados do contato (a terceira só aparece em telas ≥1024px de largura). Arquitetura completa e o que é real vs. proposta em [[05 - Módulo de Atendimento e Chat Realtime]].

- **Filtrar conversas**: abas "Minhas" (atribuídas a você), "Não Atribuídas", "Todas" (qualquer conversa ativa) e "Finalizadas". Campo de busca filtra por nome ou telefone do contato.
- **Responder**: abrir a conversa, digitar e apertar Enter (Shift+Enter quebra linha sem enviar) ou clicar no botão de enviar. Sai de verdade pelo `WhatsAppService` — mesmo caminho das notificações automáticas (ver [[03 - APIs e Webhooks n8n]]), então precisa das variáveis `WHATSAPP_*` configuradas para sair da caixa; sem elas, a mensagem fica registrada como `PENDING`/`FAILED` mas não sai de verdade.
- **Respostas rápidas**: digite `/` no campo de mensagem para abrir o menu (ex: `/jejum`, `/pix`, `/confirmacao`, `/atraso`, `/endereco-<clinica>`) — escolher um item substitui o texto digitado pela resposta completa.
- **Atribuir/Finalizar**: no cabeçalho da conversa, "Atribuir a mim" (se ainda não tiver responsável) e "Finalizar Atendimento" (muda para `RESOLVED` — some da aba "Todas"/"Minhas", aparece em "Finalizadas"; pode reabrir a qualquer momento).
- **Tags**: painel de contato (coluna 3) → digitar e apertar Enter, ou clicar num dos botões de sugestão (`Exame Pendente`, `Retorno`, `Prioritário`, `Confirmado`). Remove clicando no `x` do badge da tag.
- **Criar agendamento a partir da conversa**: botão "Criar Agendamento de Consulta/Exame" no painel de contato — abre um formulário pré-preenchido com nome/telefone/CPF do contato (CPF fica editável, já que contatos de WhatsApp podem não ter CPF cadastrado) e usa o mesmo catálogo de procedimentos da clínica.

> [!warning] Uma única caixa de entrada para todas as clínicas do número configurado
> O número de WhatsApp (`WHATSAPP_*`, ver [[01 - Setup e Infraestrutura]]) é único para toda a plataforma, não um por clínica. Se uma clínica nunca teve um agendamento associado a um telefone e o paciente manda mensagem "do nada", a conversa pode não ser criada (não há como saber a qual clínica pertence) — ver limitação detalhada em [[05 - Módulo de Atendimento e Chat Realtime]].

**Para testar sem depender de um provedor de WhatsApp real conectado**, simule uma mensagem recebida com `curl` (mesmo endpoint do webhook de confirmação de agendamento, ver [[03 - APIs e Webhooks n8n]]):

```bash
curl -X POST http://localhost:3000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"phone": "11999998888", "text": "Olá, gostaria de saber o valor da consulta", "name": "Paciente Teste"}'
```

Se `phone` já tiver um agendamento `PENDING`/`CONFIRMED` (ou já tiver conversado antes), a mensagem aparece em `/clinic/inbox` da clínica correspondente em até 5 segundos (polling — ver [[05 - Módulo de Atendimento e Chat Realtime]] sobre por que não é sempre instantâneo).

> [!note] Não existe tela para gerenciar respostas rápidas
> `CannedResponse` só é criada/editada via `prisma/seed.ts` ou Prisma Studio (`npx prisma studio`, tabela `canned_responses`) — mesma situação do catálogo de procedimentos abaixo.

## Como ver o relatório financeiro e os KPIs da plataforma

Login como admin → `/admin/relatorio` (receita e comissão por clínica, calculadas sobre agendamentos `Concluído`) ou `/admin/dashboard` (clínicas ativas, total de pedidos, taxa de conversão, procedimentos mais buscados). Detalhes de como cada número é calculado estão em [[03 - APIs e Webhooks n8n]], incluindo a ressalva de que a receita usa o **preço vigente**, não o preço no momento do agendamento.

## Testes automatizados

```bash
npm test          # roda a suíte uma vez
npm run test:watch  # modo watch, para desenvolvimento
```

Usa **Vitest**. Dois tipos de teste, em `src/`:

- **Unitários** (`src/lib/schemas/*.test.ts`) — validam as regras de cada schema Zod (`createAppointmentSchema`, `loginSchema`, e os schemas de `clinic.ts`) isoladamente, sem tocar no banco.
- **Integração** (`src/actions/appointments.test.ts`) — chama `createAppointment` de verdade, contra o banco configurado em `DATABASE_URL`.

> [!warning] Os testes de integração usam o mesmo banco do desenvolvimento
> Este projeto não tem um banco de testes isolado — os testes de integração rodam contra o Supabase configurado em `.env` (o mesmo do `npm run dev`). Eles criam seus próprios registros e **sempre limpam depois** (`afterEach` deleta o que criaram), e dependem de dados do seed já existirem (`Consulta - Clínica Geral`). Rode `npx prisma db seed` antes, se ainda não rodou. Idealmente, um projeto maduro teria um banco de testes separado — não é o caso aqui ainda.

> [!note] Por que Vitest precisa de `dotenv/config` explícito
> Ao contrário do Next.js e da CLI do Prisma (`npx prisma ...`), o Vitest **não carrega `.env` sozinho**. `vitest.config.mts` importa `dotenv/config` no topo do arquivo — sem isso, os testes de integração falham com `Environment variable not found: DATABASE_URL` mesmo com o `.env` presente e correto. Isso já causou uma falha real durante o desenvolvimento deste projeto; se um teste novo disser que `DATABASE_URL` não foi encontrada, comece verificando esse import antes de qualquer outra coisa.

## Checklist de fechamento técnico

Passos para validar que o projeto está saudável antes de um deploy (ou de dar por encerrada uma etapa):

1. `npm test` — suíte de testes (schemas + integração de agendamento).
2. `npx tsc --noEmit` — sem erros de TypeScript no projeto inteiro (inclui os arquivos de teste).
3. `npm run lint` — sem warnings/erros do ESLint.
4. `npm run build` — build de produção completo (`prisma generate && next build`) sem erros. Gera 20 rotas (incluindo `/clinic/inbox`, `/termos`, `/privacidade`, `/seja-parceiro`, `/admin/leads` e `/comprovante/[id]`); confira que nenhuma vira erro de prerender (ex: uso de `useSearchParams()` sem `<Suspense>` — já aconteceu em `/entrar`, foi corrigido).
5. Formulários novos: têm estado de carregamento (botão desabilitado/texto muda) **e** toast de sucesso/erro? Ver `src/hooks/use-action-feedback.ts` — é o hook padrão para isso nos painéis `/admin` e `/clinic`.

## Como resolver problemas e ler logs de erro

### Erros de login
- **Redirecionado para `/entrar` mesmo com credenciais certas**: confira se `NEXTAUTH_SECRET` e `NEXTAUTH_URL` estão no `.env` (ver [[01 - Setup e Infraestrutura]]) — sem eles o NextAuth não consegue assinar/validar a sessão.
- **Login de clínica cai em `/clinic` mas mostra clínica errada (ou erro)**: confira se o `User` tem `clinicId` preenchido e apontando para a clínica certa (`src/lib/session.ts` exige os dois — `role = CLINIC` **e** `clinicId` não nulo).
- **Consigo abrir `/admin` logado como `CLINIC` (ou vice-versa)**: não deveria acontecer — o middleware bloqueia por `role` antes mesmo da página carregar. Se acontecer, é bug em `src/middleware.ts`.

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
> Em máquinas com pouca RAM livre, `next build` (ou até `npm`/`npx` em geral) pode falhar com erro de "out of memory" ou "Could not determine Node.js install directory" mesmo com o código correto — já aconteceu neste projeto mais de uma vez, sempre resolvido tentando de novo depois de fechar outros programas. Não assuma que é bug de código antes de descartar isso.

### Checklist rápido quando algo não sobe

1. `.env` existe, com `DATABASE_URL`, `NEXTAUTH_SECRET` e `NEXTAUTH_URL`?
2. `npx prisma validate` — o schema está sintaticamente correto?
3. `npx prisma generate` foi rodado após a última mudança no schema?
4. `npx prisma migrate dev` foi aplicado (as tabelas existem de fato no banco)?
5. Se usando Docker local: `docker compose ps` — o container `postgres` está `Up`?

## Notas relacionadas

- [[00 - Visão Geral]]
- [[01 - Setup e Infraestrutura]]
- [[02 - Dicionário de Dados e Banco]]
- [[03 - APIs e Webhooks n8n]]
- [[05 - Módulo de Atendimento e Chat Realtime]]
- [[07 - Guia de Encaminhamento e Captação B2B]]
