# Análise do CHANGELOG do DeskcommCRM — o que vale trazer para a Conecta Saúde

Feita em 18/11/2026. Só análise: nada foi implementado. Quando escolher, fazemos com TDD.

## Fonte e licença

- Repositório: `melgarafael/DeskcommCRM`. CHANGELOG lido **inteiro** (17.365 linhas, versões 1.1.0 a 1.116.0, de set a 17/11/2026, 788 itens "Adicionado"). Também li o README. As 30 releases do GitHub repetem o CHANGELOG.
- **Licença MIT.** Copiar código seria permitido, desde que mantida a nota de copyright, mas a decisão é **não copiar**. Trazemos só as ideias e implementamos do nosso jeito, com os nossos modelos e testes.
- O que eles são: CRM de vendas genérico, instalado na VPS do próprio cliente (com WAHA, Supabase e IA própria). Atende de agência de turismo a escritório de advocacia. Muito do que lançam é prospecção B2B, telefonia, revenda (SaaS) e instalação em servidor. Para a gente, isso não serve.

## 1. Tabela das melhorias relevantes

Legenda: **Já temos?** sim / parcial / não, com o arquivo onde conferi. **Esforço:** P = até 1 dia, M = 2 a 4 dias, G = 1 semana ou mais.

### IA e segurança clínica

| O que é (versão deles) | Já temos? | Valor para clínica | Esforço | Risco |
|---|---|---|---|---|
| **Trava de "afirmação clínica"** (1.74): filtro sem IA, por frases, que barra mensagem da IA com diagnóstico, remédio, dose, promessa de resultado ou "é câncer". A IA reescreve oferecendo consulta. Se insistir, a mensagem não sai e abre caso para a equipe | **Parcial.** Só a regra 2 do prompt em `src/lib/ai-attendant.ts:20`. Não há conferência da mensagem antes de ela sair | **Alto.** O prompt sozinho não garante nada. É a proteção CFM que falta antes de ligar a IA de preços e a triagem (Etapa 2.5/2.6) | P–M | Reduz o risco CFM. Sem custo de IA (é regex) |
| Jev confere se o que a IA afirma (horário, preço, endereço) está na base de conhecimento consultada (1.76). Começa só observando | Não (`src/lib/jev.ts` classifica respostas de lembrete) | **Alto** para a IA de preços (Etapa 2.5): evita preço ou convênio inventado | M | Custo do Jev por resposta. Passar pelo `ai-gateway` |
| Jev percebe pedido de "falar com pessoa" e de "parar de receber", inclusive em áudio (1.68, 1.71). Quem diz PARAR tem o negócio fechado (1.70) | Parcial: a regra 5 do prompt manda transferir. O opt-out de marketing existe (`src/lib/marketing-consent.ts`) | Médio | P | Nenhum |
| Jev percebe irritação na hora (1.48) | Não | Médio: casa com "reclamação grave" | P | Custo de IA. Não pode virar tag clínica |
| Marcar um atendimento como exemplo para a IA (1.86) | Não | Médio: a recepção ensina o tom da clínica | M | **LGPD:** o exemplo tem de passar pelo `ai-gateway` mascarado e nunca levar dado clínico |
| A tela de IA mostra para qual país vai o texto do paciente (1.111) | Não (`src/app/(clinic)/clinic/ia`) | Médio: transparência LGPD (transferência internacional, art. 33) e argumento de venda | P | Nenhum. Ajuda a RIPD pendente |
| Limite de gasto de IA por clínica (1.4, 1.77) | Não por clínica (franquia de IA ainda é decisão em aberto) | Médio, para vender os planos | M | Controla o custo de IA |

### Lembretes, agenda e faltas

| O que é | Já temos? | Valor | Esforço | Risco |
|---|---|---|---|---|
| **Lembrete em mais de um tempo** (1.25): D-1 e de novo poucas horas antes | **Não.** `BridgeReminderLog` tem `@@unique([clinicId, bridgeNumero])`, ou seja, um lembrete por agendamento (`src/lib/bridge-reminder.ts`) | **Alto:** falta é a dor nº 1. O 2º aviso só para quem **não respondeu** ao D-1 | M | Custo por modelo de utilidade na API oficial. Reclamação se for para todos |
| Lembrete pelo modelo aprovado quando a janela de 24 h fechou (1.100) | **Sim/parcial:** caminho do modelo em `src/lib/reminder-template.ts`. Falta aprovar o `appointment_reminder` (Etapa 1.2) | Alto, mas já está no roteiro | P | — |
| Texto próprio do lembrete por tipo de atendimento, com `{{nome}} {{dia}} {{hora}} {{endereco}}` (1.38) | Parcial: há variante fixa da Urolaser em `src/lib/bridge-reminder.ts:79` | Médio: texto editável pela gestão, sem deploy | P | Nunca nomear procedimento no texto (ver seção 4) |
| Régua da falta: falta confirmada → 3 mensagens em 11 dias → se ninguém responder, vira aviso para a equipe (1.36, 1.20) | Parcial: a régua pula quem faltou. `src/lib/rebooking.ts` e `src/lib/slot-recovery.ts` cuidam da vaga, não do paciente que faltou | **Alto:** recuperar quem faltou é receita (Etapa 4) | M | Só com API oficial. Ritmo controlado (bloqueio de número) |
| Pedido de horário não confirmado libera a vaga sozinho (1.23) | Parcial: `BookingRequest` existe (`src/lib/booking-request.ts`) | Baixo: quem manda na vaga é o Firebird | P | — |
| Agenda "Quadro": uma linha por profissional, o dia na horizontal (1.108) | Parcial: Semana = carga médico × dia (`src/components/clinic/agenda/week-load.tsx`) | Baixo | M | — |
| Fechar só algumas horas de um dia (1.100) | Não, e não precisa: a grade vem do Firebird | Baixo | — | — |

### Atendimento (Chat)

| O que é | Já temos? | Valor | Esforço | Risco |
|---|---|---|---|---|
| **Conversa entregue e não respondida volta para a fila** em X minutos, no máximo 2 vezes (1.88) | **Não.** Há distribuição (`src/lib/conversation-auto-assign.ts`, `src/lib/attendant-load.ts`) e o selo "Aguardando você", mas nada devolve | **Alto:** a causa real dos 118 h de TTR foi conversa esquecida | M | Nenhum |
| **Painel do dia**: "aguardando resposta (há quanto tempo)", "em atendimento", "atendidos hoje" (1.105) | Parcial: contadores do Chat e o selo "Aguardando você" | Alto, junto com o item acima | P–M | Nenhum |
| Aviso automático fora do horário e em feriado, **uma vez por período fechado** (1.72, 1.109) | Parcial: `src/lib/after-hours-booking.ts` usa `src/lib/holidays.ts`, mas só para pedido de marcação e está desligado | Médio: o paciente do sábado à noite sabe que a mensagem chegou | P | Fora da janela de 24 h, não sai sem modelo |
| Mensagem de texto agendada na conversa (1.111) | Não | Médio: "te aviso segunda quando abrir a agenda do Dr. X" | M | Na API oficial, fora de 24 h precisa de modelo |
| Menção @ em nota interna e conversa marcada até ser aberta (1.76, 1.107) | Parcial: há nota interna (`MessageType.INTERNAL_NOTE`), sem menção | Médio: recepção ↔ gestão ↔ médico | P–M | Nenhum |
| Caixa de texto travada até clicar em "Assumir" (1.88), opcional | Não | Médio: evita duas pessoas respondendo o mesmo paciente | P | Nenhum |
| Exportar a conversa em PDF (1.81, 1.107) | Não (só envio de PDF) | Médio: anexar ao prontuário, defesa em reclamação | M | **LGPD:** só gestão, registrado em Acessos (`PatientAccessLog`) |
| Mensagem que falhou mostra o **motivo** e reenvio sem duplicar (1.88) | Parcial: botão de reenviar em `src/components/chat/message-bubble.tsx:278`, sem motivo | Médio: hoje a recepção não sabe por que falhou | P | Nenhum |
| Mensagem apagada pelo paciente: texto retido visível só para perfil autorizado, com auditoria (1.113) | Parcial: `Message.deletedAt` guarda o texto | Baixo: na saúde, mostrar o que o paciente apagou é delicado | P | **LGPD:** prefiro não mostrar |
| Busca dentro da conversa (1.56) e busca sem acento (1.100) | Não encontrei busca dentro da conversa | Médio | P | Nenhum |
| Contato interno (equipe, família, fornecedor) não vira lead e a IA não responde (1.88) | **Sim:** "🚫 Não é paciente" (b3c4110) | — | — | — |
| Juntar contatos duplicados (1.15, 1.104, 1.107) | Não encontrei mesclagem | Médio: paciente com dois números (comum com responsável de menor) | M | Juntar perfis de clínicas diferentes é proibido (isolamento) |
| Conversas da queda do número voltam sozinhas (1.97) | Parcial: recuperação manual por `scripts/recover-evolution-messages.ts` | Baixo: a Evolution vai sair com a API oficial | — | — |
| Notificação com a aba fechada (Web Push) e app instalável no celular (PWA) (1.8, 1.57, 1.87) | Não: só a Notification API com a aba aberta (`src/lib/browser-notifications.ts`). Sem `manifest` em `public/` | Médio: a recepção perde mensagem com a aba fechada | M | Nunca pôr texto do paciente na notificação (aparece na tela de bloqueio) |

### Tarefas, automações e relatórios

| O que é | Já temos? | Valor | Esforço | Risco |
|---|---|---|---|---|
| **Modelos prontos de automação para clínica** (1.36): consulta parada, exame pedido, cirurgia em decisão, falta. Nascem como rascunho, com textos que não nomeiam doença | Parcial: a régua (`src/lib/regua-return.ts`), as automações por tag (`src/lib/tag-automations.ts`) e a fila de orçamentos (`src/lib/budget-followup.ts`) existem, mas começam vazias | **Alto:** a clínica não monta fluxo sozinha. Encurta a implantação | M | Só API oficial. Textos sem dado de saúde |
| Regra "o que fazer se o paciente já tem horário marcado": adiar, enviar ou não enviar (1.98) | **Sim:** `requireNoFuture` em `src/lib/automation-rules.ts:11` | — | — | — |
| Variações de texto alternadas no mesmo passo (1.109) | Sim em Disparos (`src/lib/broadcast-variants.ts`). Falta nas automações por tag | Baixo–médio: reduz bloqueio | P | Ajuda contra bloqueio |
| Texto de reserva na variável: `{{primeiro_nome\|"paciente"}}` (1.94) | Não (`src/lib/canned-variables.ts`) | Médio: evita "Olá ," | P | Nenhum |
| Tarefa que se repete (dia da semana e hora) (1.114) e lembrete antes de vencer (1.86) | Não: `ReceptionTask` só tem `dueAt` | Médio: "conferir guias toda segunda" | P–M | Nenhum |
| Planos de tarefa aplicados por regra (1.77) | Não | Médio: checklist pré-cirúrgico (exames, termo, guia) | M | Não guardar resultado de exame na tarefa |
| Contador "minhas tarefas abertas" no menu (1.101) | Não verifiquei na tela | Baixo | P | — |
| Aviso à equipe pelo WhatsApp quando a IA transfere ou trava (1.38) | Não: há alerta por e-mail de saúde do sistema (`src/lib/health-alerts.ts`), não de atendimento | Médio | P–M | Nunca levar o texto do paciente para o grupo |
| Aviso quando a Meta aprova, rejeita ou pausa um modelo (1.108) | Parcial: o webhook grava o status (`src/app/api/webhooks/whatsapp-cloud/route.ts:136`), sem aviso | Médio na Etapa 1 | P | — |
| Conferir os limites da Meta no modelo antes de enviar (1.100) | Parcial (`src/lib/whatsapp-templates.ts`) | Baixo | P | — |
| Índice de Atrito: abandono, repergunta, "espera calada" (1.2) | Não com esse nome. FRT/TTR existem (`src/lib/response-timings.ts`) | Médio: mede as perdas silenciosas | M | Nenhum |
| Meta do mês e "quanto falta" (1.89) | Não | Baixo–médio no BI | P | — |
| Pesquisa de satisfação ao encerrar o atendimento do Chat (1.112) | Parcial: NPS pela régua após a consulta (`src/lib/nps.ts`) | Baixo: já temos NPS da consulta. Duas pesquisas cansam | P | — |

### LGPD e segurança

| O que é | Já temos? | Valor | Esforço | Risco |
|---|---|---|---|---|
| **Atestado de Anonimização** em PDF (1.90): data, quem executou, IP, código de autenticidade (HMAC), **sem** dado do titular | Parcial: `DataDeletionRecord` registra, sem documento | Médio–alto para vender e para o advogado | P–M | Reduz risco |
| **Arquivo dos dados do titular** (acesso/portabilidade, art. 18) (1.78) | Não encontrei | Médio–alto: é direito do paciente | M | Exportar só para o titular verificado. Registrar em Acessos |
| Interruptor da limpeza de mídia antiga + aviso "mídia apagada" na conversa (1.53, 1.74) | Parcial: `src/app/api/cron/data-retention/route.ts` limpa logs e fichas, **não** mídia das conversas | Médio: retenção mínima (LGPD) × prontuário (CFM, 20 anos) | M | **Decisão jurídica antes:** conversa pode ser parte do prontuário |
| "Confiar neste dispositivo" no 2FA (1.88) e 2FA exigido por papel com carência (1.70) | Parcial: 2FA com `TWO_FACTOR_ENFORCE` global (`src/lib/auth-security.ts:49`) | Médio: a recepção usa o mesmo PC o dia todo | P | Cookie seguro, prazo curto |

## 2. Descartes (uma linha cada)

- **Prospecção B2B** (Google Maps, Scavio, planilha de empresas, diagnóstico de site, cold call): clínica não prospecta empresa, e a abordagem fria por WhatsApp bloqueia o número.
- **Empresas e pessoas, CNPJ, honorários, comanda, fidelidade, catálogo de produtos, link de pagamento, proposta comercial em PDF**: venda B2B ou varejo. Para nós, o financeiro vem do Firebird.
- **Telefonia SIP, agente de voz, voz ElevenLabs, chamada de voz pelo WhatsApp**: custo alto, e a ligação para clínica é rara (só 4 recusas em 60 dias, roteiro 2.1).
- **IA responde por áudio**: o paciente pode ouvir em público. Texto é mais seguro.
- **IA lê documentos anexados ao negócio** (1.116): para nós, documento é pedido de exame ou carteirinha (dado sensível). Já temos "Analisar Documento" sob demanda, que é melhor.
- **Roteador de vários agentes por número, skills, servidores MCP por agente, catálogo de modelos (GPT, Gemini, DeepSeek)**: complexidade de plataforma genérica. Temos um atendente, o Copiloto e o Jev.
- **Instalação em VPS, atualização pela tela, ARM64, Cloudflare Tunnel, Caddy, Coolify**: rodamos na Vercel.
- **Revenda SaaS (Stripe, Asaas, planos em dólar), agências administrando clientes, cadastro com aprovação**: temos o /admin próprio e o modelo de venda é outro.
- **Tema da plataforma, CSS personalizado, 10 templates de visual**: já temos design próprio (vidro). Deixar a clínica mexer em CSS quebra o produto.
- **Telegram, grupos de clientes, Status do WhatsApp**: fora do uso de clínica.
- **Lead de formulário da Meta e pixel por etapa do funil com valor da venda**: arriscado. Etapa do funil de clínica revela procedimento. Já decidido: CAPI só Lead + fbc, nunca dado de saúde.
- **Google Meet / Jitsi direto da conversa**: teleconsulta tem regra própria (CFM 2.314/2022, prontuário e assinatura). Fica para o ERP.
- **Sincronizar a agenda do celular e mostrar o nome salvo**: leva a agenda pessoal de quem atende para o sistema.
- **Arquivo de conversa, reações, responder citando, editar ou apagar mensagem enviada, encaminhar, cores nas etiquetas, lista por etiqueta**: já temos (paridade WhatsApp Web, set/2026).
- **Distribuição por rodízio e menor carga**: já temos (`src/lib/attendant-load.ts`).
- **Aniversário N dias antes**: já temos o passo ANIVERSARIO da régua.
- **Ouvidoria**: clínica pequena resolve no Chat. Faz sentido só para hospital ou operadora.
- **Português de Portugal, espanhol, turco, Angola, Equador**: mercado só Brasil por enquanto.

## 3. Top 5 recomendado, em ordem

### 1º — Trava de afirmação clínica na saída da IA
**Etapa 2, antes dos itens 2.5 (IA de preços) e 2.6 (triagem).** Ligar mais IA sem essa trava é o maior risco CFM do roteiro.

- **Como:** novo `src/lib/clinical-claim-guard.ts` com uma função pura `checkClinicalClaim(texto) → { blocked, reason }`. São regras por frase (sem chamar IA): diagnóstico ("você tem", "isso é", "parece ser" + termo clínico), remédio e dose ("tome", "mg", "comprimido", "pomada"), promessa de resultado ("garantimos", "100%", "cura") e malignidade ("é câncer", "é benigno").
- **Onde liga:** em `src/lib/ai-attendant.ts`, antes de enviar. Se barrar, pede 1 reescrita com a instrução "ofereça consulta". Se barrar de novo, não envia: manda `AI_HANDOFF_MESSAGE`, transfere para humano e grava em `AiActionLog`. Vale também para a marcação fora do horário (`src/lib/after-hours-booking.ts`), o `booking-assist` e a sugestão do Copiloto (aqui só um aviso amarelo, porque quem envia é a pessoa).
- **Prisma:** nenhum modelo novo. O motivo vai em `AiActionLog`. Ligada sempre: é produto de clínica, sem interruptor.
- **Como testar (TDD):** `clinical-claim-guard.test.ts` com dois grupos. Frases que **devem** barrar: "Pelo que descreveu, você tem cálculo renal"; "Pode tomar dipirona 1g"; "A cirurgia resolve 100%"; "Essa pinta não é câncer". Frases que **não** podem barrar: "O médico vai avaliar na consulta"; "O exame de PSA custa R$ X"; "Traga seus exames"; "Atendemos Unimed". Depois, um teste de integração do `ai-attendant` com o modelo simulado devolvendo frase proibida 2 vezes, que tem de terminar em transferência sem envio. Conferir também em `/clinic/ia`, no registro de ações.

### 2º — Segundo lembrete só para quem não respondeu ao D-1
**Etapa 1.4 (ligar lembretes pela API oficial).** Ataca faltas com custo controlado.

- **Como:** no cron `src/app/api/cron/appointment-reminders`, uma segunda passada no dia da consulta, X horas antes (padrão 3 h, mínimo 07h). Só vai para quem tem `BridgeReminderLog.response` vazio. Pela API oficial, usa o mesmo modelo `appointment_reminder` (fora da janela de 24 h). Pela Evolution, só respeitando o ritmo de `src/lib/automated-pacing.ts`.
- **Prisma:** `BridgeReminderLog` ganha `kind String @default("D1")` (valores `D1` e `SAME_DAY`). A unicidade passa a ser `@@unique([clinicId, bridgeNumero, kind])`. Configuração por clínica: `Clinic.secondReminderHours Int?` (null = desligado). É uma migration simples, mas a tabela é muito lida: aplicar logo após o merge.
- **Texto:** curto e sem procedimento ("Oi, {{nome}}! Lembrando do seu horário hoje às {{hora}} na {{clínica}}. Responda 1 para confirmar ou 2 se não puder vir"). A resposta cai no classificador do Jev que já existe.
- **Como testar:** testes de `bridge-reminder` (não manda 2º para quem respondeu, para quem cancelou, quando o horário já passou, nem antes das 07h). Teste de unicidade (rodar o cron 2 vezes = 1 envio). Teste do menor de idade: o 2º aviso também vai para `guardianPhone` (`src/lib/reminder-recipient.ts`). Em produção, ligar primeiro na clínica de teste com um agendamento falso da ponte demo.

### 3º — Conversa não respondida volta para a fila + painel "quem está esperando"
**Etapa 2 (tira horas da recepção e evita o paciente esquecido).** Ataca direto a causa dos 118 h de TTR.

- **Como:** função pura em `src/lib/team-queue.ts`: `shouldReturnToQueue(conversa, agora, config)`. Devolve quando a conversa foi atribuída há mais de N minutos, em horário comercial (`src/lib/business-hours.ts`), e a última mensagem é do paciente. No máximo 2 devoluções, e quem não respondeu fica fora dessa conversa por 24 h. Roda dentro do cron que já existe (`conversation-auto-close`, que é de hora em hora) ou em um novo de 10 minutos. Painel: um bloco no topo do Chat (ou em `/clinic/inbox`) com três colunas: "Aguardando resposta (há X min)", "Em atendimento" e "Finalizados hoje", com filtro por número.
- **Prisma:** `Conversation` ganha `assignedAt DateTime?` e `queueReturnCount Int @default(0)`. Configuração em `Clinic.unansweredReturnMinutes Int?` (null = desligado).
- **Como testar:** tabela de casos para `shouldReturnToQueue`: fora do horário não devolve; última mensagem nossa não devolve; 3ª devolução não acontece; nota interna não conta como resposta. Teste de `src/lib/conversation-auto-assign.ts` para garantir que quem foi pulado não recebe de volta. Na tela, com a clínica demo: atribuir, esperar o prazo e ver a conversa ir para outra pessoa.

### 4º — Modelos prontos de automação para clínica
**Etapa 2 / Etapa 4 (receita sem ERP).** A régua e as automações por tag existem, mas começam vazias, e nenhuma clínica real montou fluxo.

- **Como:** catálogo em `src/lib/clinic-automation-templates.ts`, com quatro modelos: (a) "Conversa parou antes de marcar": 1 dia de silêncio, depois 3 mensagens em 10 dias; (b) "Exame pedido e não marcado": quando entra na tag ou etapa; (c) "Cirurgia em decisão": 4 mensagens em ~3 meses, sem pressão, ligada à fila de orçamentos; (d) "Faltou": 2 h depois da falta, depois 3 mensagens em 11 dias e, sem resposta, uma `ReceptionTask` para a recepção ligar. Regras de todos: qualquer resposta encerra e devolve para a recepção; **nenhum texto nomeia doença, exame, procedimento ou especialidade**. Botão "Começar de um modelo" em Automações: cria em **rascunho e desligado** e abre para a gestão revisar.
- **Prisma:** reaproveita `TagAutomation` e `TagAutomationEnrollment` (passos, parar na resposta e Tarefas já existem desde 11/11). Talvez `TagAutomation.templateKey String?` para saber de qual modelo veio.
- **Como testar:** um teste por modelo que garante `active=false` ao instalar; uma "lista de palavras proibidas" passada nos textos (nenhum termo clínico, como câncer, próstata, vasectomia, cirurgia de X); encerramento ao receber resposta (`src/lib/tag-automations-run.ts`); e, para (d), a tarefa criada no fim. E2E na clínica de teste pela API oficial.

### 5º — Atestado de anonimização + arquivo dos dados do titular
**Etapa 6 (fundação para vender) + revisão do advogado.** Pouco esforço, e transforma a LGPD em argumento de venda.

- **Como:** ao executar a exclusão em `/admin/lgpd` (`src/lib/lgpd-server.ts`), gerar um PDF com: clínica (razão social e CNPJ), data e hora no fuso, quem executou, IP, protocolo e código de autenticidade (HMAC com segredo do servidor). **Nenhum** dado do titular, nem mascarado. Guardar no Storage privado. Para acesso e portabilidade: um botão na ficha do paciente (só gestão) que gera um JSON + PDF com o cadastro, o perfil por clínica, os consentimentos e as mensagens, **sem** notas internas. Registrar em `PatientAccessLog` e entregar por link com prazo.
- **Prisma:** `DataDeletionRecord` ganha `certificatePath String?`, `certificateCode String?` e `performedFromIp String?`. Novo `DataSubjectRequest` (tipo ACESSO/EXCLUSAO, protocolo, status, prazo de 15 dias, arquivo).
- **Como testar:** o código HMAC muda se qualquer campo mudar; o PDF não contém nome, telefone nem CPF (teste procurando os valores do titular no texto gerado); a exportação exclui `INTERNAL_NOTE`; o pedido de outra clínica é recusado (isolamento). Revisão do texto pelo advogado antes de ligar.

## 4. Ideias de UX e de produto para copiar no conceito

1. **"A tela de bloqueio é pública."** Eles escrevem que mensagem de saúde é lida na tela de bloqueio, às vezes por outra pessoa. Vira regra nossa para lembretes, réguas, notificações e avisos à equipe: nunca nomear doença, exame, procedimento ou especialidade. Vale até criar um teste de CI que passa os textos fixos por uma lista de termos proibidos.
2. **Tudo novo nasce desligado e em rascunho.** Instalar um modelo nunca manda mensagem. A tela diz os passos que faltam ("publicar" e "ligar"). Já fazemos isso em parte. Vale padronizar e mostrar em `/clinic/ia` e Automações.
3. **"Começar de um modelo" em vez de tela vazia.** Toda tela de construção (Automações, Respostas rápidas, Ficha prévia) abre com 3 ou 4 modelos de clínica prontos.
4. **Recursos novos em modo observação.** O Jev deles começa só anotando o que faria, comparando com a IA atual, sem mudar nada para o paciente. Ótimo para ligar com segurança a IA de preços e a triagem: uma semana observando, medindo e só depois agindo.
5. **Toda automação diz por que agiu ou por que não agiu** (aba Atividade, "rastro da decisão"). Para nós: na conversa, um selo "a régua pulou: tem consulta marcada" e "a IA transferiu: pediu humano".
6. **Contra-métrica junto da métrica.** Cada número de sucesso vem com o custo ao lado (horas poupadas × opt-outs; respostas da IA × transferências). Quando a leitura falha, mostram "sem dado e por quê", nunca zero.
7. **Linguagem do usuário, não do sistema.** Eles tiraram "Pipeline" e "Kanban" da tela. Vale revisar nossos termos técnicos que sobraram (ex.: "funil", "etapa", "TTR") para a língua da recepção.
8. **O botão diz o que vai acontecer antes do clique** (1.85): "Finalizar e enviar despedida" em vez de "Finalizar".
9. **Ajuda que diz o que o seu papel pode e não pode fazer** (1.108). Combina com gestão, recepção e médico.
10. **Avisos que pedem gente vão para onde a pessoa está** (WhatsApp ou push), não para uma tela que ninguém abre. Para nós, só o aviso, sem conteúdo do paciente.
11. **CHANGELOG escrito para o cliente**, em linguagem simples, com "o que NÃO muda" e "nenhuma ação é necessária". Vale um "Novidades" no painel da clínica, porque hoje a gestão não sabe o que foi lançado.

## Próximo passo

Escolher um ou mais itens do Top 5. Cada um vira uma tarefa com TDD (testes primeiro), na ordem do roteiro.
