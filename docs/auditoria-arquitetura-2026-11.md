# Auditoria de código e arquitetura — MARCACAO / Conecta Saúde

Data: 10/11/2026. Commit de referência: `2c92608` (branch `main`).

Auditoria só de leitura e medição: nada foi alterado no código nem no banco. A inspeção de UI foi feita na clínica demo ("Clínica Vida (demo)"), sem dado real.

**Ressalva sobre as medições:** o navegador embutido estava em segundo plano e atrasou os temporizadores. Os tempos de cada pedido de rede são confiáveis; os tempos de "página pronta" não são, e não foram usados como prova.

**Status (10/11):** Prioridade 1 feita em parte no commit `7fd69ef`; Prioridade 2 feita, menos o segredo obrigatório (ver "Andamento da Prioridade 2"); Prioridade 3 não iniciada. Cada prioridade deve ser feita em sessão própria (ver "Como executar" no fim).

### Andamento da Prioridade 1 (commit `7fd69ef`)

- **Feito:** `prefetch={false}` no menu da clínica e do admin; `loading.tsx` e `error.tsx` em `/clinic` e `/admin`, com componente `Skeleton`; 5 cartões secundários do Relatório saíram do `Promise.all` e carregam em `Suspense`.
- **Não feito, por decisão:** juntar as actions do CRM (a ordem atual veio de propósito no `2c92608`); fotos em lote (não reduziria as chamadas à Evolution).
- **Pendente:** partir o resto do Relatório, que pede refatoração própria.

### Andamento da Prioridade 2 (10/11, com TDD)

- **Feito:** a API oficial devolve 500 quando algum evento não é gravado, e a Meta reenvia. O webhook da Evolution pula a mensagem cujo `whatsappKeyId` já está gravado (responde `duplicate` sem rodar a automação de novo) e tem try/catch geral: erro vira 500 e um `WebhookLog` FAILED com o corpo inteiro e só a 1ª linha do erro. `maxDuration` explícito (Evolution 120 s, API oficial 60 s). `x-internal-secret` comparado em tempo constante (`isInternalSecretAuthorized`).
- **Testes:** `src/app/api/webhooks/whatsapp-cloud/route.test.ts`, `src/app/api/webhooks/whatsapp/route.test.ts` e `src/lib/request-auth.test.ts`.
- **Segredo do webhook, em duas etapas (10/11):** a tela da Evolution não tem campo de cabeçalho, então o sistema passou a enviá-lo ao registrar o webhook.
  1. Preparo: criar `WHATSAPP_WEBHOOK_SECRET` na Vercel, redeploy, e em `/admin/clinicas` → Instância WhatsApp → "Reaplicar webhook" em cada clínica. Mensagem sem o token ainda é aceita e gera aviso no log da Vercel com o nome da instância.
  2. Trava: quando o aviso parar de aparecer, criar `WHATSAPP_WEBHOOK_ENFORCE=1` na Vercel e redeploy. Para desfazer, apagar essa variável.
  - A instância global (TIVDC, configurada por variável de ambiente) tem botão próprio no topo de `/admin/clinicas`: "Reaplicar webhook global".
- **Risco que continua:** se a automação passar de 25 s antes de gravar (download de mídia lento), a API oficial grava direto pelo caminho reserva. A automação então para na chave única (500), e a mensagem fica sem resposta automática. Resolve de vez com a fila de webhooks (seção 3).

### Medição depois do `7fd69ef` (10/11, clínica demo, produção)

| Item | Antes | Depois |
|---|---|---|
| Pré-carregamentos do menu por página | ~16 | 0 |
| Actions do Chat | 0,3 a 6,4 s cada | 0,15 a 0,55 s |
| Actions do CRM | ~5,5 s até o quadro completo | 0,2 a 0,8 s cada (~2,5 s no total) |
| `/api/auth/session` | 0,7 a 3,3 s | 0,1 a 0,5 s (um caso de 2,3 s) |
| `/api/chat/unread-count` | 1 a 2 s | 0,1 a 0,4 s (um caso de 2,3 s) |
| Troca de página pelo menu | tela parada | skeleton em 0,3 a 1 s |

- Relatório: primeiro byte em 0,25 s e página completa em ~2 s; trocando pelo menu, os blocos chegam em 0,9 a 1,8 s.
- Ressalvas: uma amostra por página, clínica demo com poucos dados, e o painel do navegador ficou oculto em parte da medição (tempos de rede valem; tempos de tela são aproximados). Falta confirmar numa clínica real em horário de uso.

## 1. Pontos fortes

- **Isolamento entre clínicas consistente.** Das ~480 actions exportadas, as que não checam sessão são públicas de propósito (totem, TV, portal do paciente por token, busca do site). Nos pontos conferidos em `src/actions/inbox.ts` e `src/actions/clinic-broadcast.ts`, toda escrita por id passa antes por `assertClinicOwnsConversation` ou `assertClinicOwnsCampaign`.
- **Sessão revogável na hora.** `isLive` derruba usuário desativado ou com senha trocada, com leitura do usuário em cache por requisição (`src/lib/session.ts`).
- **Crons bem fechados.** As 14 rotas usam `isCronAuthorized` (`src/lib/request-auth.ts`), com comparação em tempo constante e recusa quando falta o `CRON_SECRET`.
- **Webhooks da Meta, Instagram e Resend validam assinatura.** O da API oficial tem checagem de duplicidade por `whatsappKeyId`.
- **LGPD nos pontos certos.** Sentry sem PII e sem tracing, portão único da IA (`src/lib/ai-gateway.ts`), retenção diária (log de webhook 60 dias, ficha 1 ano, cliques 90 dias) e Realtime por sinal vazio, sem expor tabelas à chave pública.
- **Base de testes real.** 140 arquivos de teste, CI com typecheck, e comentários que explicam o porquê das decisões.
- **Nada regrediu** dos itens da auditoria de outubro que foram conferidos (cron, webhook, atribuição entre clínicas).

## 2. Gargalos críticos

### 2.1 Velocidade do painel

- **O menu lateral dispara 16 pré-carregamentos a cada página aberta.** Nenhum `Link` usa `prefetch={false}`. No Chat, os 5 primeiros levaram 8 s cada, e a primeira action da lista de conversas só saiu depois deles. Com `connection_limit=1`, tudo isso entra na mesma fila do banco.
- **Não existe nenhum `loading.tsx` nem `error.tsx` em `src/app`** (só o `global-error.tsx`). Ao trocar de página a tela fica parada até o servidor terminar, sem skeleton, e um erro de página derruba a tela inteira.
- **Actions lentas mesmo com 5 conversas na demo:** de 0,3 a 6,4 s cada. A lentidão é custo fixo por chamada (sessão + fila + conexão única), não volume de dados.
- **O CRM faz 7 actions em sequência** para montar o quadro (~5,5 s até completar).
- **A foto de contato é um pedido por contato** (`/api/chat/contact-photo`, 0,3 a 2,4 s cada).
- **Relatório roda 17 funções em `Promise.all`** (`src/app/(clinic)/clinic/relatorio/page.tsx:202`). Com uma conexão só, viram fila e a página inteira espera a última. Só há 3 `<Suspense>`.

### 2.2 Resiliência do WhatsApp

- **API oficial devolve 200 mesmo quando a gravação falha** (`src/app/api/webhooks/whatsapp-cloud/route.ts`). Se o banco cair, a Meta não reenvia e a mensagem do paciente se perde. Deveria devolver 5xx nesse caso.
- **Webhook da Evolution não tem proteção geral.** `processWhatsappWebhook` não tem try/catch externo, e a mensagem recebida é criada sem checar duplicidade (`src/app/api/webhooks/whatsapp/route.ts:768`). Um reenvio estoura a chave única (`whatsappKeyId`) e vira erro 500.
- **Trabalho pesado antes de responder.** Download de mídia, IA e várias consultas rodam dentro do pedido, e a rota não declara `maxDuration`. A API oficial ainda reencaminha por HTTP para a mesma aplicação, com limite de 25 s.
- **`WHATSAPP_WEBHOOK_SECRET` segue opcional.** Sem ele, qualquer um pode forjar mensagem de paciente. É decisão conhecida, mas continua sendo o maior risco de integridade. Torná-lo obrigatório exige configurar Vercel e Evolution juntos.
- **`x-internal-secret` comparado com `===`**, não em tempo constante.

### 2.3 Banco

Recomendações por leitura de código; tamanho real das tabelas não foi conferido (ver seção 5).

| Tabela | Falta | Onde pesa |
|---|---|---|
| `BroadcastRecipient` | índice em `phone` | consultado a cada mensagem recebida (`webhooks/whatsapp/route.ts:856`) |
| `WebhookLog` | índice em `created_at` (não tem nenhum) | limpeza diária de retenção |
| `Conversation` | `(clinicId, lastMessageAt)` e `assignedUserId` | fila do Chat ordena e filtra por eles |
| `Message` | índice parcial de não lidas (INBOUND, `readAt` nulo) | contagem de não lidas varre mensagens |
| `Appointment` | índice em `patientPhone` | histórico do paciente no Chat |
| `BroadcastCampaign` | `clinicId` / `status` | dispatcher roda todo minuto |

- **Lista de conversas sem paginação.** As "finalizadas" do CRM carregam tudo e só crescem (`src/actions/inbox.ts:386`).
- **Busca por nome usa `contains` sem índice de texto** (trigram).

### 2.4 LGPD

- **Telefone do paciente em log:** `console.log('[WhatsApp Envio] Disparando para:', target)` em `src/lib/whatsapp.ts:183`.
- **Cerca de 60 `console.error` passam o objeto de erro inteiro.** Erro de validação do Prisma inclui os argumentos da consulta, que podem ter nome, telefone ou texto.
- **Painel de afiliados continua aberto.** `getAffiliateDashboard(affiliateId)` é action pública sem sessão, o login não tem limite de tentativas e o cookie guarda o id cru (`src/actions/affiliates.ts:81`). Era pendência adiada e segue igual.
- **`/api/chat` é público, sem limite de taxa**, com telefone fictício de reserva. Parece sobra do marketplace.

## 3. Melhorias de médio e longo prazo

### Estrutura

- **Quebrar os arquivos gigantes:**
  - `src/components/chat/inbox-layout.tsx` — 3.568 linhas;
  - `src/actions/inbox.ts` — 2.361 linhas, 68 exports;
  - `src/actions/admin-inbox.ts` — 1.818 linhas, em boa parte espelho do anterior;
  - `src/components/clinic/broadcast-management.tsx` — 1.718 linhas;
  - `src/app/api/webhooks/whatsapp/route.ts` — 1.574 linhas, uma função só com regra de negócio. Pede uma cadeia de etapas testáveis.
- **Unificar `inbox.ts` e `admin-inbox.ts`** num serviço com escopo (clínica ou admin).
- **Organizar `src/lib`**, hoje com 330 arquivos soltos, em pastas por domínio (whatsapp, disparos, agenda, IA, relatórios).
- **Isolamento por construção.** Hoje depende de cada action lembrar do `clinicId`; uma extensão do Prisma ou RLS tiraria esse risco.

### Dados e performance

- **Leituras por rota GET, não server action.** As actions rodam em fila e seguram a navegação; lista, mensagens e contadores deveriam seguir o caminho do `unread-count`.
- **Guardar na conversa** a direção e a prévia da última mensagem e o total de não lidas. Elimina três consultas por atualização da fila.
- **`Appointment` sem `clinicId` direto** e sem vínculo com `Contact` (casa por telefone). Limita relatórios e índices.
- **Fila para webhooks:** gravar o evento cru e processar depois, com reprocessamento.

### UI/UX

- **Aderência ao Shadcn é baixa** em `src/components/clinic` e `src/components/chat`:
  - 345 `<button>` crus contra 11 `<Button>`;
  - 100 `<input>` contra 24 `<Input>`;
  - 28 `<textarea>` crus; 7 `<table>` contra 3 `<Table>`;
  - 37 `<select>` nativos (decisão proposital, manter).
- **208 usos de texto de 9 a 11 px** e 30 cores fixas em hexadecimal.
- **Não há componente `Skeleton`** em `src/components/ui`.
- **Scroll aninhado no CRM.** O quadro rola na horizontal e cada coluna rola na vertical (`src/components/chat/crm-kanban.tsx:420`); o Chat tem 8 áreas com rolagem própria.

### Limpeza

- O cron `appointment-reminders` existe mas não está no `vercel.json`.
- Vários crons sem `maxDuration` (`broadcast-dispatch`, `lead-outreach` e outros).

## 4. Plano de ação: 3 prioridades

### Prioridade 1 — Destravar a navegação

- `prefetch={false}` nos links do menu (`clinic-sidebar.tsx`, `clinic-nav.tsx`).
- `loading.tsx` com skeleton e `error.tsx` em `/clinic` e `/admin`.
- Juntar as 7 actions do CRM e buscar as fotos de contato em lote.
- Dividir o Relatório em blocos com `Suspense`.
- Depois, medir de novo com o painel visível.

### Prioridade 2 — Não perder mensagem de paciente

- API oficial devolve 5xx quando a gravação falha.
- Checagem de duplicidade e try/catch geral no webhook da Evolution.
- `maxDuration` explícito.
- Tornar o `WHATSAPP_WEBHOOK_SECRET` obrigatório (Vercel e Evolution juntos).

### Prioridade 3 — Índices e higiene de dados

- Uma migration com os índices da seção 2.3 (o usuário roda).
- Paginar as finalizadas.
- Remover o log de telefone e padronizar os erros para logar só a mensagem.
- Fechar ou desligar o painel de afiliados e o `/api/chat`.

## 5. O que não foi verificado

- Tamanho real das tabelas e planos de consulta: leitura do banco de produção é bloqueada. Conferir no Supabase (`pg_stat_statements`, Reports) antes de criar os índices.
- `code-review` e `claude-security` não foram rodados; a revisão foi manual.
- Mobile e empty states de cada tela não foram testados.
- A UI foi vista só na clínica demo, com poucos dados.

## 6. Como executar (economia de tokens)

Uma sessão nova por prioridade, lendo este arquivo primeiro.

| Prioridade | Modelo | Esforço |
|---|---|---|
| 1. Navegação | Sonnet 5.5 | médio |
| 2. Webhooks | Opus 5.5 | alto |
| 3. Índices e higiene | Sonnet 5.5 | médio |
| Refatorações grandes (seção 3) | Opus 5.5 | alto, uma parte por sessão |

Regras que continuam valendo: código novo com TDD; migration quem roda é o usuário, e código que depende dela só sobe depois; nunca shadow DB contra produção; testes com `npx vitest run --exclude src/actions/appointments.test.ts` e `npx tsc --noEmit`.
