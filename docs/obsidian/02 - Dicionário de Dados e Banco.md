#banco-de-dados #arquitetura

> [!info] Sobre esta nota
> Reflete exatamente o `prisma/schema.prisma` atual. Parte de [[00 - Visão Geral]]. Para os comandos de migração, ver [[01 - Setup e Infraestrutura]]. Para como editar esses dados manualmente, ver [[04 - Manual de Edição Manual e Manutenção]]. As tabelas do inbox de chat (`Contact`/`Conversation`/`Message`/`CannedResponse`) têm contexto de arquitetura próprio em [[05 - Módulo de Atendimento e Chat Realtime]]; `PartnerLead` tem o dela em [[07 - Guia de Encaminhamento e Captação B2B]].

> [!success] Migrado e populado
> Cinco migrações aplicadas contra o Postgres do Supabase, em ordem: `20260815230834_init_healthcare_schema` (schema inicial), `20260815235715_add_clinic_rating` (avaliação da clínica, para o portal público — ver [[00 - Visão Geral]]), `20260816003001_add_auth_and_clinic_settings` (login, `User.clinicId`, status `NO_SHOW`, horário de atendimento), `20260816022709_add_inbox_module` (`Contact`/`Conversation`/`Message`/`CannedResponse`, RLS deny-by-default — ver [[05 - Módulo de Atendimento e Chat Realtime]]) e `20260816153445_add_partner_leads` (`PartnerLead`, captação B2B — ver [[07 - Guia de Encaminhamento e Captação B2B]]). O seed (`prisma/seed.ts`) hoje popula 11 clínicas parceiras de Vitória da Conquista, 6 especialidades, 12 procedimentos, 23 vínculos clínica×procedimento, 8 agendamentos de exemplo e 5 usuários — credenciais em [[01 - Setup e Infraestrutura#Acessos (credenciais de desenvolvimento)]]. `PartnerLead` não é populado pelo seed — só cresce com envios reais do formulário `/seja-parceiro`.

> [!warning] Segunda versão do schema — domínio de saúde
> Este schema **substituiu** um desenho anterior (que tinha `Doctor`/`Patient` como entidades e vínculo direto `Appointment → Clinic`). O modelo atual não tem contas de paciente: dados do paciente ficam embutidos no próprio `Appointment` (`patientName`, `patientPhone`, `patientCpf`), e o preço/tipo de agendamento vivem em `ClinicProcedure`, não em `Appointment` nem em `Procedure` diretamente.

## Convenção de nomes

Modelos em PascalCase no Prisma (`User`, `Appointment`...), mapeados via `@@map` para tabelas em `snake_case` no PostgreSQL (`users`, `appointments`...) — conforme diretriz do projeto de "nomes de tabelas em inglês no banco, interface em português". Campos seguem o mesmo padrão com `@map` (`passwordHash` → `password_hash`).

## Diagrama relacional

```mermaid
erDiagram
    CLINIC ||--o{ USER : "tem equipe (opcional)"
    CLINIC ||--o{ CLINIC_PROCEDURE : "oferece"
    PROCEDURE ||--o{ CLINIC_PROCEDURE : "é oferecido em"
    SPECIALTY ||--o{ PROCEDURE : "classifica (opcional)"
    CLINIC_PROCEDURE ||--o{ APPOINTMENT : "é agendado como"

    USER {
        string id PK
        string name
        string email UK
        string phone "opcional"
        enum role "ADMIN, CLINIC"
        string passwordHash
        string clinicId FK "opcional, só p/ role CLINIC"
        int maxConcurrentChats "default 5"
        datetime createdAt
        datetime updatedAt
    }
    CLINIC {
        string id PK
        string name "razão social"
        string tradeName "nome fantasia"
        string cnpj UK
        string phone "opcional"
        string whatsapp "opcional"
        string address
        string neighborhood
        string city
        boolean active
        decimal commissionRate "5,2"
        float rating
        int reviewCount
        json businessHours "opcional"
        datetime createdAt
        datetime updatedAt
    }
    SPECIALTY {
        string id PK
        string name UK
    }
    PROCEDURE {
        string id PK
        string specialtyId FK "opcional"
        string name UK
        enum category "CONSULTATION, EXAM, SURGERY"
        string description "opcional"
        string preparationInstructions "opcional"
        datetime createdAt
        datetime updatedAt
    }
    CLINIC_PROCEDURE {
        string id PK
        string clinicId FK
        string procedureId FK
        decimal price "10,2"
        decimal promotionalPrice "10,2 opcional"
        boolean requiresAppointment
        enum appointmentType "SCHEDULED, ARRIVAL_ORDER"
    }
    APPOINTMENT {
        string id PK
        string patientName
        string patientPhone
        string patientCpf
        string clinicProcedureId FK
        date date
        string timeSlot "opcional"
        enum status "PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW"
        string paymentMethod "opcional"
        string notes "opcional"
        string affiliateId FK "opcional"
        decimal affiliateCommission "10,2 opcional"
        boolean commissionReleased "default false"
        datetime reminderSentAt "opcional"
        string reminderStatus "PENDING, SENT, CONFIRMED, RESCHEDULE_REQUESTED"
        datetime createdAt
        datetime updatedAt
    }
        string patientPhone
        string patientCpf
        string clinicProcedureId FK
        date date
        string timeSlot "opcional"
        enum status "PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW"
        string paymentMethod "opcional"
        string notes "opcional"
        datetime createdAt
        datetime updatedAt
    }
    WEBHOOK_LOG {
        string id PK
        string event
        json payload
        string status
        int responseCode "opcional"
        datetime createdAt
    }
    CONTACT ||--o{ CONVERSATION : "tem"
    CLINIC ||--o{ CONVERSATION : "pertence a"
    USER ||--o{ CONVERSATION : "atribuída a (opcional)"
    CONVERSATION ||--o{ MESSAGE : "contém"
    USER ||--o{ MESSAGE : "enviou (opcional)"
    CLINIC ||--o{ CANNED_RESPONSE : "tem (ou global)"

    CONTACT {
        string id PK
        string name
        string phone UK
        string cpf "opcional"
        datetime createdAt
        datetime updatedAt
    }
    CONVERSATION {
        string id PK
        string clinicId FK
        string contactId FK
        string assignedUserId FK "opcional"
        enum status "OPEN, PENDING, RESOLVED"
        string[] tags
        datetime lastMessageAt "opcional"
        datetime createdAt
        datetime updatedAt
    }
    MESSAGE {
        string id PK
        string conversationId FK
        enum direction "INBOUND, OUTBOUND"
        string content
        enum status "PENDING, SENT, DELIVERED, READ, FAILED"
        string senderUserId FK "opcional"
        datetime readAt "opcional"
        datetime createdAt
    }
    CANNED_RESPONSE {
        string id PK
        string clinicId FK "opcional, null = global"
        string shortcut
        string content
        datetime createdAt
    }
```

`WebhookLog` não aparece ligado a nada no diagrama porque é uma tabela de auditoria independente, sem relação com o resto do schema (ver [[03 - APIs e Webhooks n8n]]). `Contact`/`Conversation`/`Message`/`CannedResponse` são do módulo de inbox/chat — arquitetura completa em [[05 - Módulo de Atendimento e Chat Realtime]].

## Enums

### `UserRole` (tabela `user_role`)
| Valor | Significado |
|---|---|
| `ADMIN` | Administrador da plataforma |
| `CLINIC` | Usuário de uma clínica parceira |
| `PATIENT` | Paciente — valor padrão de `User.role` |

### `ProcedureCategory` (tabela `procedure_category`)
| Valor | Significado |
|---|---|
| `CONSULTATION` | Consulta médica |
| `EXAM` | Exame (laboratorial, imagem, etc.) |
| `SURGERY` | Procedimento cirúrgico |

### `AppointmentType` (tabela `appointment_type`)
| Valor | Significado |
|---|---|
| `SCHEDULED` | Agendamento com data/horário marcado |
| `ARRIVAL_ORDER` | Atendimento por ordem de chegada, sem horário fixo |

### `AppointmentStatus` (tabela `appointment_status`)
| Valor | Significado |
|---|---|
| `PENDING` | Agendado, aguardando confirmação (padrão ao criar) |
| `CONFIRMED` | Confirmado pela clínica |
| `COMPLETED` | Atendimento realizado |
| `CANCELLED` | Cancelado |
| `NO_SHOW` | Paciente não compareceu ("Falta", no painel da clínica) |

### `ConversationStatus` (tabela `conversation_status`)
| Valor | Significado |
|---|---|
| `OPEN` | Conversa ativa, padrão ao criar (ou ao reabrir) |
| `PENDING` | Reservado no schema; não é usado pela UI hoje — todo filtro que trata "ativo" considera `OPEN` e `PENDING` juntos (ver [[05 - Módulo de Atendimento e Chat Realtime]]) |
| `RESOLVED` | Atendimento finalizado pela equipe ("Finalizar Atendimento") |

### `MessageDirection` (tabela `message_direction`)
| Valor | Significado |
|---|---|
| `INBOUND` | Mensagem recebida do paciente via webhook |
| `OUTBOUND` | Mensagem enviada pela equipe da clínica |

### `MessageStatus` (tabela `message_status`)
| Valor | Significado |
|---|---|
| `PENDING` | Criada, ainda tentando enviar (só faz sentido em `OUTBOUND`) |
| `SENT` | Envio confirmado pelo provedor de WhatsApp (só `OUTBOUND`) |
| `DELIVERED` | Usado como status padrão de mensagens `INBOUND` ao chegar pelo webhook — não representa confirmação de entrega do provedor (o WhatsApp não manda isso de volta), é só o valor usado para "mensagem recebida" |
| `READ` | Reservado no schema; não é escrito por nenhum código hoje — se a mensagem foi lida pela equipe é rastreado por `Message.readAt` (campo separado, ver `markConversationRead` em [[05 - Módulo de Atendimento e Chat Realtime]]), não por este enum |
| `FAILED` | Todas as tentativas de envio falharam (ver retry em [[03 - APIs e Webhooks n8n]]) |

### `PartnerLeadStatus` (tabela `partner_lead_status`)
| Valor | Significado |
|---|---|
| `NEW` | Recebido pelo formulário `/seja-parceiro`, ainda sem contato (padrão ao criar) |
| `CONTACTED` | Equipe comercial já entrou em contato |
| `PARTNER` | Virou clínica parceira de fato (não cria a `Clinic` automaticamente — ver [[07 - Guia de Encaminhamento e Captação B2B]]) |
| `REJECTED` | Não seguiu adiante |

## Tabelas

### `users` (model `User`)
Conta de acesso — usada para login via NextAuth (Credentials + JWT, ver [[03 - APIs e Webhooks n8n]]). O papel (`role`) define o que o usuário pode fazer; usuários `CLINIC` têm `clinicId` apontando para a clínica que gerenciam.

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | — |
| `name` | `String` | — | Nome |
| `email` | `String` | **único** | Login |
| `phone` | `String?` | opcional | Telefone |
| `role` | `UserRole` | default `PATIENT` | Papel do usuário |
| `passwordHash` | `String` | — | Hash bcrypt da senha |
| `clinicId` | `String?` | FK opcional → `clinics.id` | Só é usado por usuários `role = CLINIC`; define qual painel `/clinic` a pessoa acessa |
| `createdAt` / `updatedAt` | `DateTime` | auto | — |

> [!note] `ADMIN` e `PATIENT` não usam `clinicId`
> Usuários `role = PATIENT` existem no schema mas **não são usados hoje** — o agendamento público não exige conta (ver [[00 - Visão Geral]]). Só `CLINIC` depende de `clinicId` para o middleware e as Server Actions saberem qual clínica mostrar.

### `clinics` (model `Clinic`)
Clínica parceira (tenant), agora com dados cadastrais completos (CNPJ, endereço) e taxa de comissão própria.

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK | — |
| `name` | `String` | — | Razão social |
| `tradeName` | `String` | — | Nome fantasia (usado nas telas) |
| `cnpj` | `String` | **único** | CNPJ |
| `phone` | `String?` | opcional | Telefone fixo |
| `whatsapp` | `String?` | opcional | Número de WhatsApp — usado nas notificações propostas em [[03 - APIs e Webhooks n8n]] |
| `address` | `String` | — | Logradouro e número |
| `neighborhood` | `String` | — | Bairro |
| `city` | `String` | — | Cidade |
| `active` | `Boolean` | default `true` | Clínica ativa na plataforma |
| `commissionRate` | `Decimal(5,2)` | — | Percentual de comissão da plataforma sobre essa clínica — editável no painel admin |
| `rating` | `Float` | default `0` | Nota média exibida no portal público (busca/detalhe) |
| `reviewCount` | `Int` | default `0` | Quantidade de avaliações por trás da nota |
| `businessHours` | `Json?` | opcional | Horário de atendimento por dia da semana — editável no painel da clínica |
| `createdAt` / `updatedAt` | `DateTime` | auto | — |

Relações: `users[]` (equipe com login), `clinicProcedures[]` (procedimentos oferecidos, com preço próprio — ver `ClinicProcedure` abaixo).

> [!note] Formato de `businessHours`
> Objeto JSON livre (sem schema de banco próprio), com uma chave por dia (`seg`, `ter`, `qua`, `qui`, `sex`, `sab`, `dom`), cada uma `{ open: "08:00", close: "18:00" }` ou `{ closed: true }`. Validado no lado da aplicação por `businessHoursSchema` (Zod) em `src/lib/schemas/clinic.ts`, não pelo Postgres.

> [!note] Comissão é nativa do schema
> `commissionRate` já existe em `Clinic` e é editável diretamente no painel admin (`/admin/clinicas`) — não depende mais do Prisma Studio. Uma comissão *por procedimento* ou *por médico*, se vier a ser necessária, ainda exigiria uma migração nova.

### `specialties` (model `Specialty`)
Catálogo simples de especialidades médicas, usado para classificar procedimentos de consulta.

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK | — |
| `name` | `String` | **único** | Ex: "Cardiologia" |

Relação: `procedures[]`.

### `procedures` (model `Procedure`)
Catálogo global de consultas/exames/cirurgias — independe de clínica. O preço e a forma de agendamento ficam em `ClinicProcedure`, não aqui.

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK | — |
| `specialtyId` | `String?` | FK opcional → `specialties.id` | Só faz sentido para `category = CONSULTATION`; exames hoje não têm especialidade vinculada no seed |
| `name` | `String` | **único** | Ex: "Colonoscopia" |
| `category` | `ProcedureCategory` | — | Ver enum acima |
| `description` | `String?` | opcional | Descrição para o paciente |
| `preparationInstructions` | `String?` | opcional | Instruções de preparo/jejum — ex: "Jejum de 8 horas" |
| `createdAt` / `updatedAt` | `DateTime` | auto | — |

> [!note] Regras de jejum já têm campo próprio
> `preparationInstructions` cobre o caso de "regras de jejum" citado em [[04 - Manual de Edição Manual e Manutenção]] — não é um campo dedicado só a jejum, é texto livre para qualquer instrução de preparo.

### `clinic_procedures` (model `ClinicProcedure`)
Tabela de associação — **é aqui que vivem preço e forma de agendamento**, porque a mesma `Procedure` pode ter preços e regras diferentes em cada clínica.

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK | — |
| `clinicId` | `String` | FK → `clinics.id` | — |
| `procedureId` | `String` | FK → `procedures.id` | — |
| `price` | `Decimal(10,2)` | — | Preço cheio |
| `promotionalPrice` | `Decimal(10,2)?` | opcional | Preço promocional, quando houver |
| `requiresAppointment` | `Boolean` | default `true` | Se `false`, é atendimento livre (ex: exame por ordem de chegada sem reserva prévia) |
| `appointmentType` | `AppointmentType` | default `SCHEDULED` | `SCHEDULED` ou `ARRIVAL_ORDER` |

Constraint: `@@unique([clinicId, procedureId])` — uma clínica não pode ter duas entradas para o mesmo procedimento.

Relação: `appointments[]`.

### `appointments` (model `Appointment`)
O agendamento em si. Não referencia `User`/`Patient` — os dados do paciente são capturados diretamente no agendamento (fluxo sem conta obrigatória).

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK | — |
| `patientName` | `String` | — | Nome do paciente |
| `patientPhone` | `String` | — | Telefone do paciente — usado na notificação (ver [[03 - APIs e Webhooks n8n]]) |
| `patientCpf` | `String` | — | CPF do paciente |
| `clinicProcedureId` | `String` | FK → `clinic_procedures.id` | Define clínica, procedimento e preço aplicado |
| `date` | `Date` | — | Data do agendamento |
| `timeSlot` | `String?` | opcional | Horário (ex: "14:30"); tende a ficar vazio quando `appointmentType = ARRIVAL_ORDER` |
| `status` | `AppointmentStatus` | default `PENDING` | Ver enum acima |
| `paymentMethod` | `String?` | opcional | Ex: "Dinheiro", "Cartão", "Convênio" — texto livre, não é enum |
| `notes` | `String?` | opcional | Observações |
| `createdAt` / `updatedAt` | `DateTime` | auto | — |

Índice: `@@index([clinicProcedureId, date])` — otimiza "agenda de um procedimento numa clínica em um período" (usada por `listUpcomingAppointments`, ver [[03 - APIs e Webhooks n8n]]).

### `webhook_logs` (model `WebhookLog`)
Registro de auditoria de eventos disparados (ou a disparar) para integrações externas.

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK | — |
| `event` | `String` | — | Ex: `"agendamento.criado"` |
| `payload` | `Json` | — | Corpo enviado/recebido |
| `status` | `String` | — | Texto livre, ex: `"SUCCESS"` / `"FAILED"` (não é enum) |
| `responseCode` | `Int?` | opcional | Código HTTP de resposta do destino |
| `createdAt` | `DateTime` | auto | — |

> [!warning] Tabela existe, mas nada grava nela ainda
> `WebhookLog` está pronta no banco, mas nenhum código da aplicação escreve nela hoje — é infraestrutura para quando a integração com n8n (proposta em [[03 - APIs e Webhooks n8n]]) for implementada de fato.

### `contacts` (model `Contact`)
Pessoa identificada pelo telefone — quem conversa pelo WhatsApp, não necessariamente quem tem um `Appointment`. Ver arquitetura completa em [[05 - Módulo de Atendimento e Chat Realtime]].

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK | — |
| `name` | `String` | — | Nome (do provedor de WhatsApp, se disponível; senão o próprio telefone) |
| `phone` | `String` | **único** | Só os últimos 11 dígitos (DDD + número, sem `55`) |
| `cpf` | `String?` | opcional | Preenchido só se capturado num agendamento feito a partir da conversa |
| `createdAt` / `updatedAt` | `DateTime` | auto | — |

Relação: `conversations[]`.

### `conversations` (model `Conversation`)
Uma thread de atendimento entre uma clínica e um contato.

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK | — |
| `clinicId` | `String` | FK → `clinics.id` | A qual clínica a conversa pertence — ver heurística de atribuição em [[05 - Módulo de Atendimento e Chat Realtime]] |
| `contactId` | `String` | FK → `contacts.id` | — |
| `assignedUserId` | `String?` | FK opcional → `users.id` | Membro da equipe responsável, se atribuído |
| `status` | `ConversationStatus` | default `OPEN` | Ver enum acima |
| `tags` | `String[]` | default `[]` | Texto livre, sem vocabulário fixo |
| `lastMessageAt` | `DateTime?` | opcional | Usado para ordenar a lista de conversas |
| `createdAt` / `updatedAt` | `DateTime` | auto | — |

Índices: `@@index([clinicId, status])` (filtros da lista), `@@index([contactId])` (achar conversa existente de um contato).

Relações: `clinic`, `contact`, `assignedUser` (opcional), `messages[]`.

### `messages` (model `Message`)
Cada mensagem trocada dentro de uma `Conversation`.

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK | — |
| `conversationId` | `String` | FK → `conversations.id` | — |
| `direction` | `MessageDirection` | — | `INBOUND`/`OUTBOUND`, ver enum acima |
| `content` | `String` | — | Texto da mensagem |
| `status` | `MessageStatus` | default `PENDING` | Ver enum acima |
| `senderUserId` | `String?` | FK opcional → `users.id` | Só para `OUTBOUND` — quem da equipe enviou |
| `readAt` | `DateTime?` | opcional | Marcado por `markConversationRead` quando a equipe abre a conversa; só usado em `INBOUND` |
| `createdAt` | `DateTime` | auto | — |

Índice: `@@index([conversationId, createdAt])` — otimiza carregar o histórico de uma conversa em ordem.

Relações: `conversation`, `senderUser` (opcional).

### `canned_responses` (model `CannedResponse`)
Respostas rápidas por atalho, usadas no campo de mensagem do inbox.

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK | — |
| `clinicId` | `String?` | FK opcional → `clinics.id` | `null` = disponível para todas as clínicas (global) |
| `shortcut` | `String` | — | Ex: `"/jejum"` |
| `content` | `String` | — | Texto completo que substitui o atalho |
| `createdAt` | `DateTime` | auto | — |

Constraint: `@@unique([clinicId, shortcut])` — o mesmo atalho pode existir uma vez por clínica e também como global, mas não duplicado dentro do mesmo escopo.

> [!warning] Sem tela de gestão — só seed/Prisma Studio
> Não existe formulário em `/clinic` para criar/editar `CannedResponse` — ver [[04 - Manual de Edição Manual e Manutenção]] e [[05 - Módulo de Atendimento e Chat Realtime]].

### `partner_leads` (model `PartnerLead`)
Cadastro de interesse de clínicas/consultórios que querem virar parceiras — captado pelo formulário público `/seja-parceiro`. Tabela isolada, sem FK para `Clinic`: virar parceiro de fato ainda é um passo manual. Arquitetura completa em [[07 - Guia de Encaminhamento e Captação B2B]].

| Campo | Tipo | Constraints | Descrição |
|---|---|---|---|
| `id` | `String` | PK | — |
| `clinicName` | `String` | — | Nome da clínica/consultório informado no formulário |
| `contactName` | `String` | — | Nome do responsável |
| `phone` | `String` | — | Telefone/WhatsApp, sem normalização/único (texto livre validado só no formato via Zod) |
| `email` | `String` | — | E-mail de contato |
| `neighborhood` | `String` | — | Bairro em Vitória da Conquista |
| `specialties` | `String` | — | Texto livre — quais especialidades/exames a clínica realiza |
| `notes` | `String?` | opcional | Observações adicionais |
| `status` | `PartnerLeadStatus` | default `NEW` | Ver enum acima |
| `createdAt` / `updatedAt` | `DateTime` | auto | — |

> [!note] Virar `PARTNER` não cria a `Clinic` automaticamente
> Mudar o status para `PARTNER` em `/admin/leads` é só uma anotação — cadastrar a clínica de verdade (com CNPJ, preços, usuário de login) continua sendo o fluxo manual já existente em `/admin/clinicas` (ver [[04 - Manual de Edição Manual e Manutenção]]). Os dois fluxos não estão conectados hoje.

## Notas relacionadas

- [[00 - Visão Geral]]
- [[01 - Setup e Infraestrutura]]
- [[03 - APIs e Webhooks n8n]]
- [[04 - Manual de Edição Manual e Manutenção]]
- [[05 - Módulo de Atendimento e Chat Realtime]]
- [[07 - Guia de Encaminhamento e Captação B2B]]
