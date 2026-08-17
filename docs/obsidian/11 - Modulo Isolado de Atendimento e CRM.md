#whatsapp #crm #kanban #arquitetura #open-design

> [!info] Sobre esta nota
> Continuação de [[05 - Módulo de Atendimento e Chat Realtime]] — aquela nota cobre o modelo de dados original (`Contact`/`Conversation`/`Message`/`CannedResponse`) e o inbox de 3 colunas construído do zero. Esta nota cobre a **camada visual nova** (gerada externamente pela ferramenta "Open Design" e integrada por cima do mesmo backend) e o **CRM em Kanban** que veio junto — funcionalidade nova, sem equivalente na versão anterior.

## O que mudou

A ferramenta Open Design gerou um protótipo visual (`atendimento-crm-prototype.html`, autocontido em React+Tailwind+Babel via CDN) e 4 componentes React/TSX em `src/components/chat/` — `inbox-layout.tsx`, `crm-kanban.tsx`, `message-bubble.tsx`, `schedule-modal.tsx` — com dados 100% mockados (arrays hardcoded, fotos de banco de imagens, `useState` local sem nenhuma chamada de rede). Este trabalho foi a **integração real**: religar esses componentes ao Prisma/Server Actions existentes, e não apenas trocar o visual.

> [!success] Estado atual
> `/clinic/inbox` agora renderiza `ChatCrmApp` (`src/components/chat/chat-crm-app.tsx`), com duas visões alternáveis por abas: **Caixa de Entrada** (o layout de 3 colunas do Open Design) e **CRM** (Kanban por etapa do funil). Ambas 100% ligadas a dados reais — nenhum mock restante. O antigo `src/components/inbox/*` (a versão de 3 colunas mais simples da nota 05) continua no repositório, mas não é mais importado por nenhuma rota — ver seção "Componente antigo" abaixo.

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

O `schedule-modal.tsx` original tinha selects de "Especialidade" e "Médico" com opções hardcoded e um campo de "Valor" editável livremente — nenhum desses três dados existe como conceito solto no schema (não há cadastro de médico, e o preço vem do `ClinicProcedure`, não pode ser digitado à mão sem descolar do que a clínica realmente cobra). Foi reescrito para reusar o mesmo padrão do atalho já existente no inbox antigo (`create-appointment-shortcut.tsx`, nota 05): busca o catálogo real via `listClinicProceduresForAppointment()`, mostra o preço já formatado por procedimento, e cria o agendamento de verdade via `createAppointment()` (`src/actions/appointments.ts`) — a mesma Server Action do portal público, disparando a notificação de WhatsApp automática já existente (`notifyAppointmentStatus`). Depois de criado, uma nota interna com o resumo é registrada na conversa e a etapa do funil avança automaticamente para `agendado`.

## CRM em Kanban (`crm-kanban.tsx`)

Segunda visão de `ChatCrmApp`, alternável por aba. Mostra as mesmas conversas (já carregadas por `listChatContacts`) organizadas em 4 colunas por `funnelStage`, com valor total do pipeline por coluna e no topo (calculado a partir de `estimatedValue`, formatado em BRL). Mover um card de etapa (setas ◀/▶) chama `updateConversationFunnelStage` e recarrega a lista — sem drag-and-drop por enquanto, só avançar/voltar uma etapa por vez. "Abrir Chat" num card troca para a visão de Caixa de Entrada já com aquela conversa selecionada.

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

> [!note] Por que `getChatContactHistory` casa por telefone, não por `contactId`
> `Appointment` nunca teve uma coluna `contactId` — o fluxo público de agendamento não exige login nem contato prévio, então ele grava só `patientPhone`/`patientCpf`/`patientName` soltos. Casar por telefone dentro da mesma clínica (`clinicProcedure.clinicId`) é a mesma heurística já usada em outros lugares do sistema (ex. o webhook de WhatsApp, nota 05) — não é um vínculo garantido (duas pessoas diferentes usando o mesmo número em momentos diferentes apareceriam com o mesmo histórico), mas é o dado que existe.

## Componente antigo (`src/components/inbox/*`)

Ficou **sem nenhuma rota apontando para ele** depois desta integração (`/clinic/inbox` agora usa `ChatCrmApp`). Não foi apagado nesta tarefa — apagar 8 arquivos de uma funcionalidade que funcionava (e está documentada na nota 05) é uma decisão de limpeza que vale confirmar com o time antes, não United a uma tarefa de integração visual. Reaproveitado dali: o padrão de `create-appointment-shortcut.tsx` (linha de raciocínio do novo `schedule-modal.tsx`) e as Server Actions (`listConversations`, `getConversation`, `resolveConversation`, `updateConversationTags`, todas em `src/actions/inbox.ts`, continuam sendo a mesma base de dados usada pelos dois).

## Notas relacionadas

- [[00 - Visão Geral]]
- [[02 - Dicionário de Dados e Banco]]
- [[05 - Módulo de Atendimento e Chat Realtime]] — modelo de dados original, ingestão via webhook, Realtime/polling, respostas rápidas
- [[10 - Central de Testes e Acessos]]
