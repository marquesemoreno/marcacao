# CRM HYPER (Hypersistema) — envio/recebimento de mensagens e webhook

Resumo técnico para integrar o CRM HYPER ao MARCACAO. Fontes: documentação pública
oficial (`https://documentacaoapi.hypersistema.com.br`, spec em
`/assets/openapi-public.json`, "API Externa do CRM Hyper v2") e observação do app
logado (v4.0.6.7, Next.js em `app.hypersistema.com.br`, back-end em
`backend.hypersistema.com.br`). Levantado em 2026-10-24.

> **Webhook:** o formato não está documentado publicamente. Foi medido em 2026-10-24
> com um canal de teste Telegram (3 eventos de mensagem recebida) — ver "Webhook de
> eventos". Ainda falta confirmar com um canal de WhatsApp e capturar os demais
> eventos (mensagem enviada, ticket aberto/fechado).

## Autenticação

- Base: `https://backend.hypersistema.com.br/v2/api/external/{apiId}`
- Header: `Authorization: Bearer {token}`
- `apiId` e `token` são gerados em **Configuração → API / Serviço externo → Nova API**
  (escolhe-se a Sessão/canal que a API controla). O token aparece uma única vez;
  "Atualizar" gera outro e invalida o anterior. A mesma tela tem um Sandbox.
- Respostas documentadas: `200` ok, `400` parâmetros inválidos, `401` token ausente/
  inválido/sem permissão, `409` ticket fechado (use `reopen: true`). O schema de
  resposta na spec é só `object`; exemplo conhecido de template:
  `{ "success": true, "data": { "message": "Message sent successfully", "ticketId": 123 } }`.
- O token é segredo: guardar em env var (ex.: `HYPER_API_TOKEN`, `HYPER_API_ID`), nunca
  no repositório.

## Envio de mensagens

Número no formato `5511999999999`. Vários endpoints aceitam `validateNumber`
(padrão `true`; com `false` usa o número exatamente como enviado, **sem normalização
do 9º dígito**) e `externalKey` (chave única do nosso lado, não pode repetir — serve
de idempotência). `isClosed` fecha o ticket após o envio.

| Método | Rota | Corpo (JSON salvo indicação) |
|---|---|---|
| POST | `/` | `number`, `body`, `externalKey`, `isClosed`, `validateNumber`. Com mídia: `multipart/form-data` com `media` + os mesmos campos |
| POST | `/url` | `number`, `mediaUrl`, `body`, `externalKey`, `isClosed`, `validateNumber` |
| POST | `/base64` | `number`, `base64Data`, `mimeType`, `fileName`, `body`, `isClosed`, `validateNumber` |
| POST | `/voice` | `number`, `audio` (URL), `externalKey`, `isClosed` |
| POST | `/group` | `number` = ID do grupo, `body`, `externalKey`, `isClosed` (ou multipart com `media`) |
| POST | `/groupMediaUrl` | `number` = ID do grupo, `mediaUrl`, `body`, `externalKey`, `isClosed` |
| POST | `/sendMessageByTicket` | `ticketId`, `body`, `externalKey`, `reopen`, `isClosed` (ou multipart com `media`) |
| POST | `/template`, `/templateBody`, `/templateMarketingBody` | `number`, `templateData` (objeto WABA), `isClosed`, `validateNumber`. Resposta traz `ticketId` |
| POST | `/sendButtonWABA`, `/sendListWABA` | interativos WABA |
| POST | `/sendLocation`, `/sendVcard`, `/sendPresence` | localização, cartão de contato, "digitando…" |
| POST | `/sendInteractive/{baileys\|uazapi\|zapo\|instagram\|messenger}/…` | botões, listas, enquete, PIX etc. por tipo de canal |
| POST | `/bulkSendMessage`, `/bulkSendMessageWithVariable`, `/bulkFastMessage`, `/bulkIndividual` | envio em massa |

Observações para o MARCACAO:
- Responder a um paciente que já tem conversa: `sendMessageByTicket` (precisa do
  `ticketId`; ticket fechado devolve 409 sem `reopen: true`).
- Iniciar conversa nova: `POST /` por número, ou `createTicket` (abaixo).
- Fora da janela de 24h em canal WABA só template (`/template*`).
- Há um GET `/params/` que aceita `bearertoken` na query string — evitar: token em URL
  vaza em logs.

## Tickets e consulta de mensagens

| Método | Rota | Parâmetros |
|---|---|---|
| POST | `/createTicket` | `number`, `body`, `userId`, `status` (`pending`/`open`/`closed`), `queueId`, `channelId`, `kanbanId`, `chatFlowId`, `externalKey` (e-mail em canal webmail), `validateNumber`; multipart aceita `media` |
| POST | `/showticket` | `{ number }` — ticket do contato |
| POST | `/showallticket` | `{ number }` — todos os tickets do contato |
| POST | `/showTicketById` | `{ ticketId }` |
| GET | `/listTickets` | query `pageNumber`, `status` |
| POST | `/showAllMessages` | `{ ticket }` — mensagens do ticket |
| GET | `/searchMessages` | query `ticketId`, `searchParam`, `page`, `limit` |
| GET | `/getMessageByMessageId` | query `messageId` |
| POST | `/updateticketinfo` | `ticketId`, `userId`, `status`, `queueId`, `chatFlowId`, flags de bot (`typebotStatus`, `chatgptStatus`, `dialogflowStatus`, `difyStatus`, `n8nStatus`) |
| POST | `/updatequeue` | `ticketId`, `queueId` |
| POST | `/updateTicketChannel` | `ticketId`, `whatsappId`, `channel` |
| POST | `/ticket/pause/start/{ticketId}`, `/ticket/pause/end/{ticketId}` | pausa de atendimento |
| POST | `/createNotes`, GET `/listNotes`, POST `/updateNote` | notas internas |

Apoio: `GET /listChannels`, `/listQueues`, `/listUsers`, `/listTags`, `/listContacts`
(IDs de canal, fila e usuário para os payloads acima). Contatos:
`createContact`, `showcontact`, `contacts/search`, `updateContact`.

## Webhook de eventos (recebimento)

O CRM avisa outro sistema quando há nova conversa, nova mensagem ou novo ticket. A URL
é configurada **por canal**: Configuração → Canais → editar o canal → "Configurações
do N8N" → campo **"URL do N8N"** (o nome é histórico; aceita qualquer URL HTTP(S)).
Salvar já passa a enviar os eventos. Há também flags de integração por ticket
(`n8nStatus` etc. em `updateticketinfo`) que provavelmente controlam se o ticket é
repassado.

### O que foi medido (canal Telegram, 2026-10-24)

Há dois pontos de configuração: o webhook geral do tenant e, por canal, o bloco
**Webhook do Canal** (Editar canal): interruptor "Habilitar Webhook do Canal", "URL de
destino" e o interruptor **"Mensagens recebidas"** — este vem **desligado** e, sem
ligá-lo, **nada é enviado** (a URL sozinha não dispara). O que segue foi medido com
esse interruptor ligado; o campo "URL do N8N" da documentação não foi testado.

Requisição: `POST` com `content-type: application/json`, ~4 KB, **sem nenhum cabeçalho
de autenticação ou assinatura** (só `accept`, `content-length`, `content-type`).
Resposta esperada: qualquer 2xx (o receptor de teste devolveu `200 {"ok":true}`);
política de retry desconhecida.

Corpo (um evento por mensagem recebida; 3 mensagens → 3 eventos, ~5 s entre eles):

```json
{
  "method": "message",
  "msg": {
    "body": "Disponha",
    "fromMe": false,
    "messageId": "tg:248:422738523:18",
    "telegramMessageId": 18
  },
  "ticket": { "...": "~100 campos" }
}
```

- `method` é sempre `"message"` nas capturas; não há campo de tipo de mídia.
- `msg` traz só `body`, `fromMe`, `messageId` e o id nativo do canal. **Imagem e áudio
  chegam com `body: ""` e sem URL, mimetype ou nome de arquivo** — para obter a mídia
  é preciso buscar a mensagem pela API (`showAllMessages` / `getMessageByMessageId`)
  usando o `messageId`. O formato do `messageId` no WhatsApp ainda não foi visto.
- `ticket`: `id`, `protocol`, `status` (`pending`/`open`/`closed`), `channel`,
  `contactId`, `whatsappId` (id do canal), `tenantId`, `userId`, `queueId`,
  `unreadMessages`, `lastMessage`, `lastMessageAt` (epoch ms), `answered`,
  `isGroup`, `closedAt`, flags de IA/bot (`chatgptStatus`, `typebotStatus` …),
  mais `contact` e `whatsapp` aninhados.
- `ticket.contact`: `id`, `name`, `number` (**`null` no Telegram**; no WhatsApp deve ser
  o telefone), `pushname`, `email`, `profilePicUrl`, e ids por rede (`telegramId`,
  `messengerId`, `instagramPK` …).
- `ticket.lastMessage` neste teste era a **resposta automática** do CRM ("estamos
  ausentes…"), não a mensagem do paciente — não usar `lastMessage` como texto
  recebido; usar `msg.body`.
- `ticket.whatsapp` é a configuração do canal embutida (`id`, `name`, `type`, `status`,
  `tokenAPI`, `bmToken`, `wabaId`, `chatgptApiKey` …). **Contém campos de credencial**
  (vazios no Telegram, mas o primeiro evento trouxe o objeto completo): tratar o corpo
  inteiro como sensível, não gravar em log nem em banco o objeto `ticket.whatsapp`.

### Segunda rodada (webhook geral do tenant ligado, 2026-10-24)

O webhook geral fica em Configuração → Configurações → Integrações → **Webhooks**:
"Webhook principal" (Ativar webhook, URL do Webhook, "Webhook mensagens: enviar eventos
de mensagem") e, abaixo, webhooks de criar/atualizar **canal, usuário e API** — não há
item para ticket. O campo "URL do N8N" da documentação **não existe** no canal
Telegram. Resultado com o webhook geral ligado e o do canal também: 4 eventos para 4
mensagens recebidas (sem duplicidade — só uma das duas fontes disparou, e não dá para
saber qual), todos `fromMe: false`. **Nenhuma resposta do atendente e nenhum
fechamento de ticket gerou evento.**

O único sinal de mudança de ticket é o próprio `ticket` do evento seguinte: o ticket
estava `pending` / `userId: null` e passou a `open` / `userId: 233` depois que o
atendente assumiu, e o objeto `ticket.user` (com horário de atendimento) acompanha a
partir daí.

### Ainda não capturado

- Mensagem **enviada** pelo atendente (`fromMe: true`), abertura, atribuição,
  transferência e **fechamento de ticket**: não são empurrados por nenhum dos dois
  webhooks testados. Para saber o desfecho, fazer **polling** (`listTickets` com
  `status`, `showTicketById`, `showAllMessages`) ou usar os eventos de canal/usuário/API
  só para administração.
- Status de entrega/leitura, reações, edição e exclusão de mensagem.
- Formato com canal **WhatsApp** (`number`, `messageId`, grupos, `@lid`).

### Desenho sugerido para `POST /api/webhooks/hyper`

1. Autenticar por **segredo longo no caminho** (ou query), já que o CRM não assina; o
   caminho identifica a clínica, e validar `ticket.tenantId` e `ticket.whatsappId`
   contra o cadastro da clínica.
2. Ignorar `fromMe: true` e `isGroup: true`.
3. Deduplicar por `msg.messageId` (o CRM pode reenviar).
4. Para mídia, chamar a API do CRM com o `messageId` — o webhook não traz o arquivo.
5. Reaproveitar `processWhatsappWebhook(body, forcedClinicId)` como no caminho da API
   oficial da Meta, convertendo este formato para o formato interno.
6. Responder 200 rápido e processar sem bloquear (o CRM não documenta timeout).

## Riscos e pontos de atenção

- **Canais não oficiais** (Baileys, UAZAPI, Zapo) têm o mesmo risco de bloqueio de
  número já visto nas clínicas; o canal WABA (API oficial) é o caminho seguro.
- **9º dígito:** `validateNumber: false` desliga a normalização; hoje o MARCACAO tem
  fallback próprio (ver `whatsapp.ts`). Decidir quem normaliza antes de integrar.
- **Idempotência:** usar `externalKey` estável por mensagem (ex.: id da mensagem do
  MARCACAO) para evitar duplicidade em retry.
- **Sem assinatura de webhook documentada:** qualquer um que descubra a URL pode forjar
  eventos — usar segredo longo na URL e validar o `apiId`/canal esperado no payload.
- **Multi-clínica:** token e `apiId` são por tenant/sessão; mapear para `clinicId`
  (como em `WhatsappCloudAccount`) em vez de uma credencial global.
- **Agenda do CRM (`appointment/*`) não tem médico/procedimento** — não substitui a
  agenda do MARCACAO; fora do escopo deste documento.
