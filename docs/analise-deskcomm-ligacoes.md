# Ligações no DeskcommCRM e recuperação de chamada perdida na Conecta Saúde

Feita em 18/11/2026. Só análise: nada foi implementado. Quando escolher, fazemos com TDD.
Continuação de `docs/analise-deskcomm-changelog.md`, que tinha descartado a telefonia. Aqui o foco é só um pedaço dela: **quem ligou e ninguém atendeu recebe um WhatsApp ou um SMS, e a recepção recebe a tarefa de retornar.**

## Resumo em 5 linhas

1. O DeskcommCRM tem duas telefonias: chamada pelo WhatsApp (por um **segundo aparelho não oficial**, o WaCalls) e telefone por tronco SIP com IA atendendo. A recuperação de chamada perdida deles é recente (1.109.0, 12/11) e **só vale para SIP**: vira gatilho de automação que manda WhatsApp.
2. Aqui, o jeito mais barato de começar é a **Evolution API**, que já manda o evento `CALL` com o status da chamada. Hoje só não assinamos esse evento. Vale para os números que ainda estão na Evolution.
3. **Problema grande: a API oficial NÃO entrega chamadas de número em coexistência** (documentação da Meta). A Urolaser vai migrar em coexistência. Depois disso, a chamada de WhatsApp para o número dela fica invisível para o sistema.
4. O telefone fixo depende do PABX de cada clínica. O caminho que combina com o que já temos é a **ponte no PC da clínica** ler a bilhetagem do PABX e avisar o sistema. Isso precisa ser conferido modelo a modelo.
5. A mensagem de retorno vai por WhatsApp primeiro e por SMS (Comtele) como reserva. É curta, sem nada clínico, uma por número por dia, e sempre vira tarefa "Retornar ligação" para a recepção.

## Fonte

- Repositório `melgarafael/DeskcommCRM` (licença MIT; a decisão continua sendo **não copiar código**). Li o CHANGELOG nas partes de telefonia (445 linhas citam ligação/chamada/SIP/voz) e, no código, só os arquivos centrais para entender o desenho: `lib/voip/evento-de-ligacao-perdida.ts`, `lib/automation/gatilho-ligacao-perdida.test.ts`, `lib/wacalls/motivo-da-chamada.ts` e a migration `0233_chamada_de_voz_wacalls.sql`.
- Evolution API: código do `whatsapp.baileys.service.ts` (repositório `EvolutionAPI/evolution-api`), trecho do evento `call`.
- Meta, Calling API: páginas *User-initiated calls*, *Call settings*, *Calling (overview)*, *Pricing*, *FAQ* e *Onboarding business app users (coexistence)*, em developers.facebook.com/documentation/business-messaging/whatsapp/calling.

## 1. Como funciona no DeskcommCRM

### Linha do tempo

| Versão | O que entrou |
|---|---|
| 1.19.0 (11/09) | **Chamada de voz pelo WhatsApp**, desligada por padrão. Pareia um *segundo aparelho* no mesmo número pelo WaCalls (não é caminho oficial). A tela exige marcar que aceita o **risco de o WhatsApp bloquear a conta**. Chamada recebida toca para o time todo. **Chamada perdida vira aviso na Central** com o número, o motivo em português e o botão "ligar de volta". IA se cala durante a ligação. Ligação atendida conta como contato feito. Contato que pediu "PARAR" não recebe ligação. LGPD: o telefone das chamadas sai junto na exclusão e entra na exportação. |
| 1.27.2 (15/09) | Correções: número sem o 9º dígito; ligação feita pelo CRM e não atendida virava "chamada perdida" por engano (agora é "Chamada de voz sem resposta", sem aviso). |
| 1.41.0 (20/09) | **Telefonia SIP com IA atendendo** (Asterisk + agente de voz), módulo desligado. Números em Conexões › Telefone, tela Chamadas. |
| 1.48.0 (24/09) | Botão "Chamar" no cabeçalho da conversa. |
| 1.73.0 (05/10) | Ligação de contato bloqueado: no SIP é desligada na hora e fica como "Cancelada"; no WhatsApp a perdida de bloqueado não gera aviso. |
| 1.101.0 (05/11) | Ligação SIP que cai antes de atender não fica "tocando" para sempre (cron que encerra chamadas presas). |
| 1.104.0 (07/11) | Atalho `tel:` sem o +55, para softphone de PABX em nuvem. |
| 1.109.0 (12/11) | **Gatilho de automação "Quando uma ligação recebida não for atendida"**. Pedido de cliente: "quem ligou e não foi atendido recebe uma mensagem no WhatsApp em até um minuto". **Só SIP, ainda não WhatsApp.** As travas de envio continuam valendo (bloqueado, janela do canal, limites). |

### O desenho (ideias, não código)

- **Uma tabela de chamadas** (`voice_calls`): direção (recebida/feita), telefone de quem ligou, contato (pode ser nulo: número desconhecido), status (`ringing`, `connected`, `ended`), motivo do fim (`timeout`, `user_ended`, `declined`, `busy`…), horários de início, atendimento e fim, duração. O id da chamada no provedor é único por empresa.
- **"Perdida" não é status: é dedução.** Chamada recebida que terminou sem nunca ter sido atendida. Isso evita depender do vocabulário de cada provedor.
- **O motivo cru do provedor fica guardado**, mas na tela vira frase em português ("O telefone tocou e ninguém atendeu"). Motivo desconhecido aparece como "não sabemos traduzir (x)", nunca escondido.
- **A perdida vira um evento**, e o motor de automação já existente escuta esse evento. A recuperação não é um sistema novo: é mais um gatilho, que herda as travas de envio.
- **Publicar o evento nunca derruba o encerramento da ligação.** Se falhar, registra e segue.
- **Ligação que nós fizemos e ninguém atendeu não é "perdida"** (o erro da 1.27.2).
- **Chamada presa em "tocando"** é encerrada por um cron.
- O que não serve para nós: o segundo aparelho não oficial (risco de bloqueio do número), a IA atendendo por voz, o discador de lista (cold call) e a infraestrutura de Asterisk na VPS.

## 2. De onde podemos tirar a chamada perdida

| Fonte | Como chega | Vale para | Custo | Esforço | Dependência / risco |
|---|---|---|---|---|---|
| **a) WhatsApp pela Evolution** | Evento `CALL` da Evolution. O código dela emite `sendDataWebhook(Events.CALL, call)` a cada mudança da chamada (Baileys: `offer`, `ringing`, `timeout`, `reject`, `accept`, `terminate`). Hoje assinamos só `MESSAGES_*` (`src/lib/evolution-admin.ts:103`) | Números ainda na Evolution: Santa Clara, e a Urolaser até migrar | Zero | **P–M** | Nenhuma nova. A Evolution vai sair de cada clínica quando ela migrar, e aí esta fonte acaba para aquele número. Conferir em teste se o atendimento pelo celular chega como `accept` (senão, toda chamada atendida no aparelho pareceria perdida) |
| **b) WhatsApp pela API oficial (Calling API)** | Campo `calls` do webhook. Chamada perdida = `direction: USER_INITIATED`, `status: COMPLETED` **sem** `start_time`/`duration`. A Meta encerra em 30 a 60 s sem atender | Só número **100% na API oficial**. A Meta lista "Voice and video calls: Not supported" para número em coexistência | Ligação do paciente é grátis | M | **Não serve para a Urolaser em coexistência.** Exige limite de 2.000 destinatários/dia, Calling ligado e **atender pelo navegador** (WebRTC), porque o celular deixa de tocar. Meta restringe número com baixa taxa de atendimento |
| **c) Telefone fixo pelo PABX, via ponte** | A ponte que já roda no PC da clínica (`CLIENTES/<CLINICA>/index.js`, pm2) lê a bilhetagem do PABX (saída de registros de chamada por rede, comum em PABX Intelbras e Leucotron) e manda as recebidas não atendidas para um endpoint nosso | Clínicas com PABX que registra **chamada recebida não atendida** | Zero de provedor | M (por modelo de PABX) | Depende do modelo: muitos PABX só registram chamada completada. Precisa ver o PABX de cada clínica. PC desligado à noite (Urolaser) = chamada da noite não chega |
| **d) Telefone fixo por PABX em nuvem / VoIP com webhook** | Provedor manda webhook (ex.: VTCall tem webhooks de evento de chamada; CloudTalk manda chamada perdida para CRM). Endpoint nosso com um adaptador por provedor | Clínica que já usa ou aceita trocar para PABX em nuvem | Mensalidade do provedor (da clínica) | M por provedor | Troca de operadora é decisão da clínica. O provedor vira operador de dados (contrato) |

**Ordem que faz sentido:** (a) agora, porque é barata e já mostra o volume real; (c) ou (d) quando soubermos o PABX de cada clínica; (b) só se uma clínica tiver número dedicado na API oficial sem coexistência.

**Dado que já temos:** o roteiro (Etapa 2, item 1) diz que a recusa automática de ligação pelo WhatsApp atingiria só 4 casos de paciente em 60 dias; os outros 64 eram telefones de médicos de fora (assunto do item 5, a IA de preços e regras). Ou seja, **pelo WhatsApp o volume é baixo**. O volume que importa provavelmente está no **telefone fixo**, e hoje não temos esse número. Antes de construir (c)/(d), vale perguntar às clínicas quantas ligações perdem por dia.

**Aviso sobre o que já existe:** `setEvolutionCallBlocking` (`src/lib/evolution-admin.ts:163`) recusa a chamada de WhatsApp e manda um texto fixo de até 100 letras, na hora, inclusive em horário comercial e para médico. A recuperação substitui isso com regra (horário, uma por dia, exclusões, tarefa). As duas não devem ficar ligadas juntas.

## 3. A regra de recuperação

### Quando dispara

- **Horário comercial** (`src/lib/business-hours.ts`, 08–18 h, seg–sáb, sem feriado de `src/lib/holidays.ts`): espera curta, **padrão 2 min**, para dar tempo de a própria pessoa ligar de novo ou a recepção retornar. Configurável: na hora, 2, 5 ou 10 min.
- **Fora do horário e em feriado:** manda na hora o texto "estamos fechados, responda por aqui e retornamos ao abrir". A tarefa nasce com vencimento na abertura do próximo dia útil.
- Várias tentativas do mesmo número em sequência contam como **uma** ligação perdida.

### Por qual canal

1. **WhatsApp, se o número tem WhatsApp.**
   - Pela **Evolution**: texto livre, uma mensagem, respeitando o ritmo de `src/lib/automated-pacing.ts`.
   - Pela **API oficial**:
     - Chamada de WhatsApp perdida **abre a janela de 24 h**, mesmo não atendida. A Meta diz que a janela abre "regardless of if you accept the call or not". Então dá para mandar texto livre, sem custo de modelo.
     - Chamada no **telefone fixo** não abre janela: precisa de **modelo da categoria Utilidade** (aviso de serviço: é resposta a um contato que a pessoa fez, não propaganda; `src/lib/campaign-kind.ts`).
2. **SMS (Comtele, `src/lib/comtele.ts`) como reserva:** quando o número não tem WhatsApp, quando o envio falha, ou quando é fixo/celular sem WhatsApp. Até 160 letras, **sem acento** (acento troca a codificação e o limite cai para 70).
3. **Telefone fixo de quem ligou** (não recebe WhatsApp nem SMS): só a tarefa para retornar.

**Consentimento:** é mensagem de serviço, em resposta a um contato que a própria pessoa iniciou. Não é marketing, então não exige o aceite de marketing (`src/lib/marketing-consent.ts`). Mas **quem pediu para sair do SMS** (`channelSendDecision` → `SAIU`, `src/lib/channel-consent.ts`) não recebe SMS. Base legal sugerida: procedimentos preliminares a pedido do titular (LGPD art. 7º, V). Confirmar com o advogado.

### Quando NÃO manda (só registra, e cria a tarefa se fizer sentido)

- A pessoa ligou de novo e foi atendida, ou a recepção ligou de volta e foi atendida, antes da hora de enviar.
- Já há conversa aberta com resposta nossa nos últimos 30 min. A equipe já está falando com ela: só uma nota na conversa.
- Conversa com a tag `🚫 Não é paciente` (médicos, secretárias de médicos, fornecedores) ou `📵 Número errado`.
- Número da própria equipe ou de outra clínica da casa.
- Já mandamos recuperação para esse número nas últimas 24 h.
- Número escondido, internacional ou inválido.
- Menor de idade: a mensagem vai para quem ligou, porque foi esse número que fez contato. Não redirecionar para o responsável (diferente do lembrete, `src/lib/reminder-recipient.ts`).

### Textos (nenhum nomeia doença, exame, procedimento ou especialidade; passar por `findClinicalTerm` de `src/lib/clinic-automation-templates.ts`)

Modelo Utilidade (`ligacao_perdida_aberto`), {{1}} = saudação (`{{saudacao}}`: "Oi, Maria" ou "Olá"), {{2}} = nome da clínica:
> {{1}}! Vimos sua ligação para a {{2}} e não conseguimos atender agora. Como podemos ajudar? Pode responder por aqui que já falamos com você.

Modelo Utilidade (`ligacao_perdida_fechado`):
> {{1}}! Recebemos sua ligação para a {{2}}, mas estamos fora do horário de atendimento. Deixe sua mensagem por aqui e retornamos assim que abrirmos.

Alternativa sem convite para escrever (para quem prefere só avisar):
> {{1}}! Vimos sua ligação para a {{2}}. Vamos retornar assim que possível.

SMS (sem acento, 129 letras neste exemplo):
> Clinica Urolaser: vimos sua ligacao e nao conseguimos atender. Fale conosco no WhatsApp (77) 99999-9999 ou aguarde nosso retorno.

### O que a recepção vê

- **Conversa criada ou reaberta no Chat** com a nota interna "📞 Ligação perdida às 14:32 (WhatsApp)" ou "(telefone fixo)". Se mandamos mensagem, uma segunda nota: "↩️ Enviamos aviso por WhatsApp/SMS".
- **Tarefa "Retornar ligação"** em `/clinic/tarefas`, com quem atende a conversa, vencendo hoje (ou na abertura, se fora do horário). Ela some sozinha quando a pessoa responde ou a ligação de volta é atendida.
- A conversa entra em **Esperando** (`/clinic/esperando`) como "aguardando resposta" e segue a **volta à fila** já existente.
- Número desconhecido vira contato novo com nome "Ligação de (77) 9…", igual a quem manda a primeira mensagem.

### Custo e bloqueio

- WhatsApp pela API oficial: chamada de WhatsApp perdida abre janela, então o texto é grátis. Telefone fixo → modelo Utilidade, cobrado por mensagem (valor de Utilidade da Meta no Brasil).
- SMS Comtele: custo por SMS da rota contratada.
- Volume baixo (uma por número por dia), mas o envio pela Evolution passa pelo mesmo ritmo dos automáticos.

## 4. LGPD e CFM

- **O que guardar da ligação:** telefone, horário, se foi atendida, duração, canal, e o que fizemos (mensagem, SMS, tarefa). **Nada de conteúdo.**
- **Prazo:** o mesmo da conversa. Entra na exclusão do titular (`src/lib/lgpd-server.ts`: apagar as linhas pelo telefone e pela conversa) e na exportação (`src/lib/patient-export.ts`: lista de ligações com data e status), como o DeskcommCRM fez.
- **Gravação de chamada: não gravar.** Exigiria aviso antes da ligação, base legal, guarda e controle de acesso. A conversa pode conter dado de saúde, e não há ganho para recuperar chamada perdida. Concordo com a sua tendência.
- **Provedor de telefonia** (se usarmos o caminho d): passa a ser operador de dados. Exigir contrato com finalidade, sigilo, subprocessadores, local dos dados e apagamento no fim. Não mandar ao provedor nada além do número e do horário.
- **CFM:** os textos não falam de saúde, e a mensagem não promete horário nem atendimento médico.

## 5. Tabela das melhorias

Legenda igual à da análise anterior. **Esforço:** P = até 1 dia, M = 2 a 4 dias, G = 1 semana ou mais.

| O que é (versão deles) | Já temos? | Valor para clínica | Esforço | Risco |
|---|---|---|---|---|
| **Registro de chamadas** (1.19.0): tabela com direção, status, motivo, duração | **Não.** Só a recusa automática da Evolution (`src/lib/evolution-admin.ts:163`), sem registro | Alto: é a base de tudo e mostra quantas ligações a clínica perde | P | Nenhum. Sem conteúdo da ligação |
| **Chamada perdida vira aviso para a equipe** (1.19.0) | Não | Alto: hoje a ligação de WhatsApp perdida some | P | — |
| **Gatilho "ligação não atendida" → mensagem** (1.109.0, só SIP lá) | Não. Temos as automações por tag (`src/lib/tag-automations.ts`) e a recusa com texto fixo | **Alto:** é o pedido | M | Volume baixo. Uma por número por dia |
| SMS como reserva quando não tem WhatsApp | Não (Comtele só em Disparos) | Médio–alto para telefone fixo | P | Respeitar quem saiu do SMS |
| Motivo do fim da chamada em português (1.19.0) | Não | Baixo–médio | P | — |
| Cron que encerra chamada presa em "tocando" (1.101.0) | Não | Médio (evita "perdida" falsa) | P | — |
| Ligação de contato bloqueado recusada (1.73.0) | Parcial: tags `🚫 Não é paciente` e `📵 Número errado` | Médio: filtra médicos, secretárias e fornecedores que ligam | P | — |
| Botão "Ligar" na conversa (1.48.0) | Não (só o número na ficha) | Médio: link `tel:` resolve sem telefonia | P | Nenhum, é só link |
| Atalho `tel:` sem +55 para softphone (1.104.0) | Não | Baixo–médio | P | — |
| Exportação e exclusão incluem as ligações (1.19.0) | Não (tabela não existe) | Obrigatório quando a tabela existir | P | Reduz risco |

## 6. Descartes (uma linha cada)

- **Segundo aparelho não oficial para ligar e atender pelo WhatsApp (WaCalls):** risco de bloqueio do número, que eles mesmos escrevem na tela. As duas clínicas já tiveram número bloqueado em outubro.
- **Agente de voz com IA atendendo telefone (SIP + Asterisk):** custo, infraestrutura e risco CFM de a IA falar de saúde por voz, sem a trava de texto que temos.
- **Discador de lista (Cold Call):** prospecção fria, não é uso de clínica.
- **Calling API para atender pelo navegador:** o celular da clínica deixa de tocar, e não funciona em coexistência. Talvez no futuro, com número dedicado.
- **Gravação e transcrição de chamada:** ver LGPD acima.

## 7. Top 3 recomendado, em ordem

### 1º — Registro de chamadas + recuperação para WhatsApp pela Evolution

**Agora, nos números que estão na Evolution.** É barato e dá o número real de ligações perdidas antes de investir no fixo.

- **Como:**
  - Assinar `CALL` em `src/lib/evolution-admin.ts` (lista `events`) e tratar o evento no webhook `src/app/api/webhooks/whatsapp/route.ts`.
  - Função pura em `src/lib/call-log.ts`: `applyCallEvent(estado, evento) → estado`. Ela junta os status `offer` → `accept`/`timeout`/`reject`/`terminate` numa linha por chamada; "perdida" = recebida que terminou sem `accept`. Também resolve `@lid` para o número (o código da Evolution já faz `getPNForLID`).
  - Outra função pura em `src/lib/missed-call-recovery.ts`: `recoveryDecision({ agora, chamada, chamadasRecentes, conversa, tags, horário, feriados, últimoEnvio }) → { ação: "ESPERAR" | "WHATSAPP" | "SMS" | "SÓ_TAREFA" | "PULAR", motivo, enviarEm }`.
  - Envio por um cron de 1 minuto (ou dentro do `queue-return`, que roda a cada 10). Cria a nota na conversa, a `ReceptionTask` e a mensagem.
  - Desligar `rejectCall` da clínica que ligar a recuperação.
- **Prisma:**
  - Novo `CallLog`: `clinicId`, `channel` (`WHATSAPP`/`PHONE`), `source`, `externalId`, `direction`, `phone`, `status` (`RINGING`/`ANSWERED`/`MISSED`/`REJECTED`), `endReason`, `startedAt`, `answeredAt`, `endedAt`, `durationSec`, `conversationId?`, `recovery` (`PENDENTE`/`WHATSAPP`/`SMS`/`SÓ_TAREFA`/`PULADA`), `recoveryReason`, `recoveredAt`. Único por `[clinicId, source, externalId]`.
  - Configuração: `Clinic.missedCallRecovery String?` (null = desligado; `TAREFA` ou `MENSAGEM`) e `Clinic.missedCallDelayMinutes Int?`.
  - Tabela nova, não é muito lida. Migration aditiva: aplicar antes do push, como sempre.
- **Como testar (TDD):**
  - Tabela de casos de `applyCallEvent`: `offer`→`timeout` = perdida; `offer`→`accept`→`terminate` = atendida; `reject` nosso ≠ perdida do paciente; evento repetido não duplica; `terminate` antes do `offer` (ordem trocada).
  - Tabela de casos de `recoveryDecision`: fora do horário → texto "fechado"; ligou de novo e foi atendida → pular; tag `🚫 Não é paciente` → pular; segunda ligação em 24 h → só nota; número fixo → só tarefa; conversa com resposta nossa há 10 min → só nota.
  - Texto passa por `findClinicalTerm`.
  - Isolamento: evento de uma instância nunca cria chamada em outra clínica.
  - Ponta a ponta: na Clínica Teste (se ainda tiver Evolution) ou na Santa Clara com um celular nosso, ligar e não atender. Conferir nota, tarefa e mensagem. Ligar e atender: conferir que nada sai. **Antes de tudo, confirmar se o atendimento no celular chega como `accept`.**

### 2º — Telefone fixo pela ponte (ou por PABX em nuvem)

**Depois de saber o PABX de cada clínica e quantas ligações elas perdem.** É onde provavelmente está o volume.

- **Como:**
  - Endpoint `POST /api/telefonia/<token-da-clínica>` que recebe um formato nosso, simples: telefone, horário, status, id. Assinado com segredo por clínica, como o webhook da Evolution.
  - Por trás, um adaptador por origem:
    - **ponte local:** a ponte lê a bilhetagem do PABX pela rede e só repassa as recebidas não atendidas;
    - **provedor de PABX em nuvem:** o webhook do provedor, traduzido para o nosso formato.
  - A mesma `recoveryDecision` do 1º item decide o resto. Fixo → modelo Utilidade da API oficial (fora da janela) ou SMS.
- **Prisma:** nenhum novo além do `CallLog`; `channel = PHONE`, `source = PABX_<modelo>` ou `<provedor>`.
- **Como testar:**
  - Testes do adaptador com exemplos reais da bilhetagem do PABX da clínica.
  - Chamada atendida por outro ramal não pode virar perdida (transferência).
  - PC da clínica desligado: ao voltar, a ponte manda o atrasado e a regra não envia mensagem de ligação de mais de X horas, só a tarefa.
  - Ponta a ponta: ligar para o fixo da clínica fora do horário e conferir a mensagem.

### 3º — Tela e relatório de ligações

- **Como:**
  - Na tela **Esperando**, um bloco "Ligações perdidas hoje" com hora, número/nome, o que foi feito e o botão "Ligar" (link `tel:`, com opção sem +55 para softphone).
  - No **Relatório**, um cartão de ligações (métricas abaixo).
  - Motivo do fim em português.
  - Cron que encerra chamada presa em "tocando" há mais de 5 min.
  - Ligações entram na **exportação** e na **exclusão** do titular.
- **Prisma:** nada novo.
- **Como testar:** contas do relatório com dados de exemplo; exportação inclui as ligações; exclusão apaga as linhas do telefone; `tel:` sem +55 não corta número que começa com 55 por ser DDD.

## 8. Métricas para o Relatório (`/clinic/relatorio`)

- **Ligações perdidas** no período (WhatsApp × fixo), e o horário em que mais se perde (picos por hora).
- **Recuperadas por mensagem:** a pessoa respondeu ao aviso.
- **Retornadas pela equipe:** ligação de volta atendida ou tarefa concluída.
- **Tempo até o retorno** (mediana): da ligação perdida até a primeira resposta humana ou ligação atendida.
- **Viraram agendamento:** conversa da ligação perdida chegou a "Agendado" em até 7 dias. Com o ticket médio, dá a **receita recuperada**, no mesmo estilo do cartão "O que a régua trouxe".
- **Contra-métrica** (ideia da análise anterior): pedidos de "SAIR" e respostas "não fui eu" depois do aviso.
- Sem dado (ex.: PABX não integrado), mostrar "sem dado e por quê", nunca zero.

## 9. O que preciso de você para decidir

1. **Quantas ligações cada clínica perde por dia no fixo**, e qual o PABX (marca e modelo) ou operadora de cada uma. Isso decide se o 2º item é ponte ou provedor.
2. **A Urolaser vai mesmo para coexistência?** Se sim, a chamada de WhatsApp dela fica sem aviso depois da migração (limite da Meta). Se a ligação de WhatsApp importar para ela, a alternativa é um número dedicado só na API oficial, o que muda o número que os pacientes conhecem.
3. **Texto com convite para responder ou só aviso?** Recomendo o convite: transforma a ligação em conversa no Chat.
4. **Ligar recuperação desligaria a recusa automática da Evolution** onde ela estiver ligada. Confirma?

## Próximo passo

Escolher um dos três. O 1º dá para fazer já com TDD, sem depender de ninguém, e mostra o volume real em uma ou duas semanas.
