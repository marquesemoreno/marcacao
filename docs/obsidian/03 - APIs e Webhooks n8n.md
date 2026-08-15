#n8n #arquitetura #api

> [!info] Sobre esta nota
> Parte de [[00 - Visão Geral]]. Modelos citados aqui estão detalhados em [[02 - Dicionário de Dados e Banco]].

> [!danger] Leia antes de usar esta nota
> Hoje o projeto **não tem nenhuma rota de API (`src/app/api`) nem nenhuma integração real com n8n ou WhatsApp**. Existe uma Server Action de leitura e uma tabela `WebhookLog` já migrada no banco (pronta para receber logs), mas nada no código escreve nela ainda. A segunda metade desta nota ("Proposta de Webhooks") é um **design proposto**, não uma API existente — os payloads JSON mostrados são sugestão de contrato a construir, não resposta real de nenhum endpoint.

## O que existe hoje

### Server Actions

Localizadas em `src/actions/`. São funções `"use server"` chamadas diretamente de Server/Client Components — não são endpoints HTTP com URL própria.

| Função | Arquivo | Assinatura | O que faz |
|---|---|---|---|
| `listUpcomingAppointments` | `src/actions/appointments.ts` | `(clinicId: string) => Promise<Appointment[]>` | Busca agendamentos futuros (`date >= agora`) de uma clínica, via `clinicProcedure.clinicId`, ordenados por data, incluindo `clinicProcedure` (com `clinic` e `procedure` aninhados) |

```ts
// src/actions/appointments.ts
"use server";

import { prisma } from "@/lib/prisma";

export async function listUpcomingAppointments(clinicId: string) {
  return prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      date: { gte: new Date() },
    },
    orderBy: { date: "asc" },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });
}
```

> [!note] Por que via `clinicProcedure`?
> `Appointment` não tem `clinicId` direto — o vínculo com a clínica passa por `clinicProcedureId` (ver [[02 - Dicionário de Dados e Banco]]). Por isso o filtro usa `clinicProcedure: { clinicId }` em vez de `clinicId` direto.

Nenhuma outra Server Action existe ainda (criar, confirmar ou cancelar agendamento, cadastrar clínica/procedimento, etc. — ver [[04 - Manual de Edição Manual e Manutenção]] para como fazer isso manualmente enquanto não existem).

### Route Handlers (API REST)

Não há nenhum arquivo `route.ts` sob `src/app/`. Não existe hoje nenhuma rota `/api/*`.

### `WebhookLog` — infraestrutura pronta, sem uso ainda

A tabela `webhook_logs` já existe no banco (`event`, `payload`, `status`, `responseCode`, `createdAt` — ver [[02 - Dicionário de Dados e Banco]]), pensada para registrar cada tentativa de chamada a um webhook externo (sucesso ou falha). Hoje nenhum código grava nela; ela só passa a ser útil quando a proposta abaixo for implementada.

## Proposta de Webhooks (não implementado)

Para o fluxo descrito em [[00 - Visão Geral]] (notificação via WhatsApp ao criar/confirmar/cancelar um agendamento), a integração mais direta é a aplicação **chamar um Webhook do n8n** (não o contrário) sempre que o `status` de um `Appointment` mudar — o n8n recebe o evento e decide como notificar (WhatsApp, e-mail, etc.).

### Como isso seria construído

1. Criar um **Webhook node** no n8n (`Webhook` trigger, método `POST`), que gera uma URL única — essa URL vai em `N8N_WEBHOOK_URL` no `.env` (ver [[01 - Setup e Infraestrutura]]).
2. Na aplicação, criar uma Server Action ou Route Handler que, após alterar o `status` de um `Appointment`, faça um `fetch(process.env.N8N_WEBHOOK_URL, { method: "POST", body: JSON.stringify(payload) })` com o payload proposto abaixo, e **grave o resultado em `WebhookLog`** (`event`, `payload` enviado, `status` = `"SUCCESS"`/`"FAILED"`, `responseCode` retornado).
3. No n8n, a partir do node `Webhook`, ramificar por `evento` (`Switch` node) para montar e enviar a mensagem de WhatsApp correspondente (ex: via node do WhatsApp Business API/Twilio/Evolution API — a escolha do provedor de WhatsApp ainda não foi definida neste projeto).

### Payload proposto — agendamento criado

```json
{
  "evento": "agendamento.criado",
  "agendamentoId": "clx1y2z3a0001",
  "status": "PENDING",
  "paciente": {
    "nome": "Maria Silva",
    "telefone": "+55 11 91234-5678",
    "cpf": "123.456.789-00"
  },
  "clinica": {
    "id": "clx1y2z3a0002",
    "nomeFantasia": "Clínica São Lucas",
    "whatsapp": "+55 11 91234-5678"
  },
  "procedimento": {
    "id": "clx1y2z3a0004",
    "nome": "Consulta - Cardiologia",
    "categoria": "CONSULTATION"
  },
  "precoAplicado": "250.00",
  "data": "2026-08-20",
  "horario": "14:30",
  "tipoAgendamento": "SCHEDULED",
  "criadoEm": "2026-08-15T10:00:00-03:00"
}
```

### Payload proposto — agendamento confirmado pela clínica

```json
{
  "evento": "agendamento.confirmado",
  "agendamentoId": "clx1y2z3a0001",
  "status": "CONFIRMED",
  "paciente": {
    "nome": "Maria Silva",
    "telefone": "+55 11 91234-5678"
  },
  "data": "2026-08-20",
  "horario": "14:30",
  "confirmadoEm": "2026-08-15T11:00:00-03:00"
}
```

### Payload proposto — agendamento cancelado

```json
{
  "evento": "agendamento.cancelado",
  "agendamentoId": "clx1y2z3a0001",
  "status": "CANCELLED",
  "paciente": {
    "nome": "Maria Silva",
    "telefone": "+55 11 91234-5678"
  },
  "data": "2026-08-20",
  "horario": "14:30",
  "canceladoEm": "2026-08-15T12:00:00-03:00",
  "motivo": "string opcional — viria do campo Appointment.notes"
}
```

> [!note] Campos derivados do schema real
> `agendamentoId`, `status`, `data` (`date`), `horario` (`timeSlot`) e `motivo` (`notes`) vêm diretamente do model `Appointment`. O bloco `paciente` vem dos campos inline `patientName`/`patientPhone`/`patientCpf` (não é mais uma relação — ver [[02 - Dicionário de Dados e Banco]]). `clinica` e `procedimento` vêm de `Appointment.clinicProcedure.clinic` e `.procedure`. `precoAplicado` viria de `clinicProcedure.promotionalPrice ?? clinicProcedure.price`.

### O que falta decidir antes de implementar

- Qual provedor de WhatsApp o n8n vai usar (WhatsApp Business Cloud API, Twilio, Evolution API, etc.) — impacta o desenho dos nodes depois do Webhook.
- Se o disparo deve ser síncrono (bloqueia a resposta ao usuário até o `fetch` ao n8n retornar) ou assíncrono/fire-and-forget.
- Autenticação do webhook (o n8n suporta header de autenticação no Webhook node — hoje não há segredo compartilhado definido).
- Retentativas em caso de falha do n8n ou do provedor de WhatsApp (o `WebhookLog.status = "FAILED"` seria o gatilho natural para uma fila de retry).

## Notas relacionadas

- [[00 - Visão Geral]]
- [[01 - Setup e Infraestrutura]]
- [[02 - Dicionário de Dados e Banco]]
- [[04 - Manual de Edição Manual e Manutenção]]
