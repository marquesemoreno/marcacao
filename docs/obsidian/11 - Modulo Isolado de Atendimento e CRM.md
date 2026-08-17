#whatsapp #crm #kanban #arquitetura #open-design

> [!info] Sobre esta nota
> Continuação de [[05 - Módulo de Atendimento e Chat Realtime]] — aquela nota cobre o modelo de dados original (`Contact`/`Conversation`/`Message`/`CannedResponse`) e o inbox de 3 colunas construído do zero. Esta nota cobre a **camada visual nova** (gerada externamente pela ferramenta "Open Design" e integrada por cima do mesmo backend) e o **CRM em Kanban** que veio junto — funcionalidade nova, sem equivalente na versão anterior.

## O que mudou

A ferramenta Open Design gerou um protótipo visual (`atendimento-crm-prototype.html`, autocontido em React+Tailwind+Babel via CDN) e 4 componentes React/TSX em `src/components/chat/` — `inbox-layout.tsx`, `crm-kanban.tsx`, `message-bubble.tsx`, `schedule-modal.tsx` — com dados 100% mockados (arrays hardcoded, fotos de banco de imagens, `useState` local sem nenhuma chamada de rede). Este trabalho foi a **integração real**: religar esses componentes ao Prisma/Server Actions existentes, e não apenas trocar o visual.

> [!success] Estado atual
> Chat e CRM agora existem como **rotas próprias e separadas**, tanto no painel da clínica quanto no do Admin: `/clinic/inbox` + `/clinic/crm`, e `/admin/inbox` + `/admin/crm` (cross-clínica). Todas renderizam o mesmo `ChatCrmApp` (`src/components/chat/chat-crm-app.tsx`), parametrizado por `scope` ("clinic" ou "admin") e `view` ("inbox" ou "crm") — 100% ligado a dados reais, nenhum mock restante. O antigo `src/components/inbox/*` (a versão de 3 colunas mais simples da nota 05) continua no repositório, mas não é mais importado por nenhuma rota — ver seção "Componente antigo" abaixo.

## Admin: Chat/CRM cross-clínica (`/admin/inbox`, `/admin/crm`)

O Admin não tem `clinicId` de sessão — ele precisa enxergar conversas de **todas** as clínicas ao mesmo tempo, não de uma só. Em vez de sobrecarregar `src/actions/inbox.ts` (que assume `requireClinicSession()` em toda função) com parâmetros opcionais, foi criado um módulo espelho `src/actions/admin-inbox.ts`, protegido por `requireAdminSession()`, com a mesma "forma" de função a função (`listChatContactsAdmin`, `getChatMessagesAdmin`, `sendMessageAdmin`, etc.) mas sem nenhum filtro por `clinicId` nas queries.

`ChatCrmApp` escolhe o conjunto de Server Actions certo em tempo de execução via um mapa `ACTIONS_BY_SCOPE = { clinic: {...}, admin: {...} }`, indexado pela prop `scope` — o resto do componente (estado, handlers, JSX) não sabe nem precisa saber qual dos dois está por trás.

Duas diferenças de dado exigidas pela visão cross-clínica:
- **`Contact.clinicId`/`Contact.clinicName`** (novos campos opcionais em `src/types/chat-crm.ts`) — só populados quando o adapter (`toChatContact`, `src/lib/chat-crm-adapters.ts`) recebe a relação `clinic` no include da query (o `listConversations` de clínica não inclui; o `listConversationsAdmin` inclui). A UI (`inbox-layout.tsx`, `crm-kanban.tsx`) mostra um badge com o nome da clínica sempre que esse campo existe — e simplesmente não renderiza nada quando não existe (visão de clínica única).
- **`listClinicProceduresForAppointmentAdmin(clinicId)`** — o catálogo de procedimentos do agendamento rápido precisa ser filtrado pela clínica *daquela conversa específica* (cada conversa pertence a uma única clínica), não pela clínica da sessão (que não existe para o Admin). `ScheduleModal` foi desacoplado disso: recebe uma prop `fetchProcedures: () => Promise<...>` em vez de chamar a Server Action direto — `ChatCrmApp` decide qual função passar de acordo com o `scope`.

> [!note] Agentes para transferência, no escopo Admin
> `listChatAgentsAdmin()` lista usuários `CLINIC` **e** `ADMIN` de todas as clínicas (não só uma) — faz sentido, já que o Admin pode transferir uma conversa entre clínicas diferentes ou assumir ele mesmo. `listCannedResponsesAdmin()` só traz as respostas rápidas globais (`clinicId: null`) — as específicas de uma clínica (ex. `/endereco`) exigiriam recarregar a lista a cada troca de conversa selecionada, o que não foi implementado (escopo consciente, não esquecimento).

## Por que a Contact da UI é, na prática, uma Conversation

Os tipos do Open Design (`src/types/chat-crm.ts`) modelam um `Contact` com campos que, no schema real, pertencem à *conversa* (departamento, canal, etapa do funil, valor estimado, tags, atendente responsável) — não à pessoa em si. Em vez de reformular os componentes visuais para separar as duas coisas, o adapter (`src/lib/chat-crm-adapters.ts`) trata cada `Contact` retornado para a UI como **uma `Conversation` com o `Contact` aninhado**, igual ao `ConversationListItem` já usado pelo inbox antigo: o campo `id` retornado é o `conversationId`, e é isso que toda mutação (tag, funil, transferência, mensagem) recebe como parâmetro.

## Extensão de schema (aditiva, migração `20260817123608_add_chat_crm_module`)

Quatro colunas novas, todas com valor padrão — não quebram nenhuma escrita já existente (seed, webhook, `sendMessage` antigo):

```prisma
enum ConversationChannel { WHATSAPP INSTAGRAM WEBCHAT }
enum ConversationDepartment { RECEPCAO AGENDAMENTO FINANCEIRO }
enum ConversationFunnelStage { NOVOS TRIAGEM ORCAMENTO AGENDADO }
enum MessageType { TEXT AUDIO INTERNAL_NOTE ATTACHMENT }

model Conversation {
  // ...campos existentes (ver [[02 - Dicionário de Dados e Banco]])
  channel        ConversationChannel     @default(WHATSAPP)
  department     ConversationDepartment  @default(RECEPCAO)
  funnelStage    ConversationFunnelStage @default(NOVOS)
  estimatedValue Decimal?                @db.Decimal(10, 2)
}

model Message {
  // ...campos existentes
  type           MessageType @default(TEXT)
  attachmentName String?
  attachmentSize String?
  audioDuration  String?
}
```

- **`channel`/`department`** — só existiam implicitamente (sempre WhatsApp, sem departamento) na nota 05. Agora ficam explícitos, alimentando o filtro "Depto:" da coluna 1 e o badge de canal no avatar.
- **`funnelStage`/`estimatedValue`** — é o dado novo que sustenta o Kanban de CRM (`crm-kanban.tsx`). Não existia nenhum conceito de funil de vendas antes desta integração.
- **`Message.type = INTERNAL_NOTE`** — nota interna (visível só para a equipe, nunca sai pelo WhatsApp) é uma funcionalidade nova de verdade: antes, toda `Message` saía necessariamente para o paciente. `sendMessage()` (`src/actions/inbox.ts`) agora recebe um terceiro parâmetro opcional (`isInternalNote`, default `false`) — quando `true`, grava a mensagem com `type: INTERNAL_NOTE` e **não** chama `whatsappService.sendMessage`.
- **`AUDIO`/`ATTACHMENT`** — o schema já suporta esses tipos (para quando o webhook de WhatsApp passar a ingerir mídia de verdade), mas os botões de microfone/anexo no composer continuam desabilitados (`disabled`, com tooltip explicando) — não existe infraestrutura de upload/gravação hoje. Isso é honesto, não um corte de escopo silencioso: os botões já eram só decorativos no protótipo original do Open Design.

## Avatares: iniciais locais, não fotos de banco de imagens

O protótipo original usava fotos do Unsplash como avatar de pacientes e atendentes reais. Isso foi **removido** por dois motivos: (1) não existe foto de paciente nenhuma no sistema — seria uma foto de banco de imagens fingindo ser a pessoa; (2) gerar avatar via serviço externo (ex. `ui-avatars.com`) a partir do nome do paciente vazaria dado pessoal identificável para um terceiro a cada carregamento de tela, o que não é aceitável num sistema de saúde sob LGPD. Em vez disso, `src/components/chat/avatar-badge.tsx` renderiza as iniciais do nome num círculo colorido, localmente, sem nenhuma chamada de rede.

## Agendamento a partir do chat: catálogo real, não texto livre

O `schedule-modal.tsx` original tinha selects de "Especialidade" e "Médico" com opções hardcoded e um campo de "Valor" editável livremente — nenhum desses três dados existe como conceito solto no schema (não há cadastro de médico, e o preço vem do `ClinicProcedure`, não pode ser digitado à mão sem descolar do que a clínica realmente cobra). Foi reescrito para reusar o mesmo padrão do atalho já existente no inbox antigo (`create-appointment-shortcut.tsx`, nota 05): busca o catálogo real via `fetchProcedures()` (prop injetada por `ChatCrmApp` — `listClinicProceduresForAppointment()` no escopo clínica, `listClinicProceduresForAppointmentAdmin(clinicId)` no escopo Admin), mostra o preço já formatado por procedimento, e cria o agendamento de verdade via `createAppointment()` (`src/actions/appointments.ts`) — a mesma Server Action do portal público, disparando a notificação de WhatsApp automática já existente (`notifyAppointmentStatus`).

Depois de criado, o botão "➕ Criar Agendamento Rápido" (painel do contato, coluna 3) faz três coisas automaticamente: (1) registra uma nota interna na conversa com o resumo da consulta **e o link de `/comprovante/[appointmentId]`** (a guia com QR Code — "colada no chat", nas palavras do pedido original, embora quem efetivamente recebe a guia pelo WhatsApp seja o fluxo de notificação automática já existente; a nota interna serve para o atendente ver/copiar o link sem precisar abrir outra tela); (2) avança a etapa do funil para `agendado`; (3) atualiza o Histórico Clínico do contato na hora.

## Ferramentas do atendente na Coluna 2/3 (`inbox-layout.tsx`)

- **Respostas rápidas por `/`** — digitar `/` na caixa de mensagem abre a lista (antes só abria clicando no botão "/respostas"); continuar digitando filtra pelo texto do atalho (`/pix`, `/preparo-jejum`, `/horarios`, `/confirmacao`, `/endereco` — seed atualizado, ver nota 05). Selecionar um item **substitui** o texto digitado (não concatena) — esse já era o comportamento documentado na nota 05 para o inbox antigo, e foi restaurado aqui.
- **Alternador "💬 Mensagem WhatsApp" / "🔒 Nota Interna (Privada)"** — inalterado no mecanismo (nota 05), só ganhou os emojis no rótulo pedidos nesta tarefa.
- **Tags coloridas predefinidas** — além do campo de texto livre já existente (nota 05), três botões de atalho ("⚡ Prioritário" em âmbar, "🔬 Jejum" em azul, "✅ Confirmado" em verde) só aparecem se a tag ainda não estiver no contato; a tag já aplicada ganha a cor correspondente automaticamente (`tagClasses()` em `inbox-layout.tsx`, mapa fixo por rótulo exato — uma tag digitada à mão com texto diferente cai no estilo cinza padrão).
- **Histórico do Paciente** — inalterado (nota 05, seção "Histórico Rápido de Consultas"); no escopo Admin, o campo que mostra "médico" é substituído pelo nome da clínica (`getChatContactHistoryAdmin`), já que não há médico cadastrado e a informação relevante ali é *onde* foi o atendimento anterior.

## CRM em Kanban (`crm-kanban.tsx`)

Segunda visão de `ChatCrmApp`, em rota própria (`/clinic/crm` ou `/admin/crm`, não mais uma aba dentro da mesma página — a troca entre Caixa de Entrada e CRM agora navega de verdade via `<Link>`, preservando a conversa selecionada como query string `?c=<conversationId>`). Organiza os leads em **5 colunas**: 🆕 Novos Contatos → 💬 Em Atendimento → 💲 Orçamento Enviado → ✅ Agendamento Confirmado → 🏁 Finalizado, com valor total do pipeline por coluna e no topo (a partir de `estimatedValue`, formatado em BRL). Cada card mostra nome, telefone, última interação (mensagem + horário), valor estimado e o atalho "💬 Abrir no Chat" (navega para a Caixa de Entrada com aquela conversa já selecionada).

As 4 primeiras colunas mapeiam direto para `Conversation.funnelStage`; a 5ª ("Finalizado") é **derivada de `Conversation.status === RESOLVED`**, não é um valor de `funnelStage` — mover um card para lá chama `resolveConversation`/`resolveConversationAdmin` (a mesma ação do botão "Finalizar Atendimento" da Caixa de Entrada), e voltar de lá chama `reopenConversation`/`reopenConversationAdmin`, preservando a etapa do funil que já estava salva.

> [!danger] Bug corrigido: coluna "Finalizado" nunca populava
> O filtro `"todas"` usado pelo Kanban (`listChatContacts("todas", ...)`) exclui deliberadamente conversas `RESOLVED` — é o mesmo filtro da aba "Todas" da Caixa de Entrada, que não deveria misturar finalizadas com ativas. Como o Kanban não tem abas de filtro próprias, ele herdava esse comportamento e a coluna "Finalizado" ficava sempre vazia, mesmo com conversas de verdade resolvidas. Corrigido em `chat-crm-app.tsx`: quando `view === "crm"`, `refreshContacts()` busca `"todas"` e `"finalizadas"` em paralelo e concatena o resultado — só para a visão de CRM, sem alterar o comportamento das abas da Caixa de Entrada.

> [!note] `estimatedValue` não é preenchido automaticamente
> Hoje não existe nenhuma automação que estime o valor de um lead a partir do histórico de agendamentos ou da mensagem recebida — o campo existe no schema e a UI mostra "—" quando vazio. Preencher isso exigiria uma tela de edição manual (não construída) ou uma regra de negócio (ex: valor do último procedimento perguntado na conversa) — nenhuma das duas está implementada.

## Novas Server Actions (`src/actions/inbox.ts`)

Adicionadas junto das já existentes (nota 05) — nenhuma assinatura antiga mudou de forma incompatível:

| Action | O que faz |
|---|---|
| `listChatContacts(filter, search?)` | `listConversations()` + `toChatContact()` — mesma consulta, formato novo |
| `getChatMessages(conversationId)` | `getConversation()` + `toChatMessage()` em cada mensagem |
| `getChatContactHistory(conversationId)` | Busca `Appointment` por `patientPhone` (não há FK Contact→Appointment — ver nota abaixo) dentro da clínica da sessão |
| `listChatAgents()` | Usuários `role: CLINIC` da clínica, para o menu de transferência |
| `assignConversationToUser(conversationId, userId)` | Transferência para qualquer atendente (o antigo `assignConversationToMe` só cobria "atribuir a mim mesmo") |
| `updateConversationFunnelStage(conversationId, stage)` | Grava a etapa do Kanban |
| `updateConversationDepartment(conversationId, department)` | Grava o departamento (sem UI de edição direta ainda — preparado para uso futuro) |

Todas têm uma equivalente em `src/actions/admin-inbox.ts` (sufixo `Admin`, ex. `listChatContactsAdmin`) usada pelo Admin — ver seção "Admin: Chat/CRM cross-clínica" acima.

> [!note] Por que `getChatContactHistory` casa por telefone, não por `contactId`
> `Appointment` nunca teve uma coluna `contactId` — o fluxo público de agendamento não exige login nem contato prévio, então ele grava só `patientPhone`/`patientCpf`/`patientName` soltos. Casar por telefone dentro da mesma clínica (`clinicProcedure.clinicId`) é a mesma heurística já usada em outros lugares do sistema (ex. o webhook de WhatsApp, nota 05) — não é um vínculo garantido (duas pessoas diferentes usando o mesmo número em momentos diferentes apareceriam com o mesmo histórico), mas é o dado que existe.

## Componente antigo (`src/components/inbox/*`)

Ficou **sem nenhuma rota apontando para ele** depois desta integração (`/clinic/inbox` agora usa `ChatCrmApp`). Não foi apagado nesta tarefa — apagar 8 arquivos de uma funcionalidade que funcionava (e está documentada na nota 05) é uma decisão de limpeza que vale confirmar com o time antes, não United a uma tarefa de integração visual. Reaproveitado dali: o padrão de `create-appointment-shortcut.tsx` (linha de raciocínio do novo `schedule-modal.tsx`) e as Server Actions (`listConversations`, `getConversation`, `resolveConversation`, `updateConversationTags`, todas em `src/actions/inbox.ts`, continuam sendo a mesma base de dados usada pelos dois).

## Notas relacionadas

- [[00 - Visão Geral]]
- [[02 - Dicionário de Dados e Banco]]
- [[05 - Módulo de Atendimento e Chat Realtime]] — modelo de dados original, ingestão via webhook, Realtime/polling, respostas rápidas
- [[10 - Central de Testes e Acessos]]
