# DeskVoice: o que aproveitar para a Conecta Saúde

Data: 18/11/2026. Só análise: nada foi implementado. Segue as mesmas regras da [análise do DeskcommCRM](analise-deskcomm-changelog.md) e da [análise de ligações](analise-deskcomm-ligacoes.md): trazer **ideias**, não código; nada clínico vai para Meta ou Google; LGPD e CFM em toda sugestão.

## Resumo em 5 linhas

1. O DeskVoice é uma **central telefônica com IA**: atende a ligação, conversa por voz e abre tarefas depois. É do mesmo autor do DeskcommCRM, mas é um sistema separado (decisão "0001: fronteira").
2. Para nós, **atender paciente por voz com IA não vale agora**: custa por minuto, aumenta o risco CFM (a IA pode falar de sintoma, e a fala não passa por trava) e o risco LGPD (gravação, transcrição, áudio indo para fora do país).
3. O que vale trazer são as **regras de segurança do retorno de ligação que caiu**. Elas encaixam direto na nossa recuperação de chamada perdida, ainda não implementada.
4. As três ideias mais fortes: **tetos por clínica** (por hora e por dia), **não usar o nome do paciente quando o número pode ser forjado** e **tarefa automática quando a ligação termina sem próximo passo**.
5. A ligação pelo WhatsApp deles usa um cliente **não oficial** (WaCalls), com risco de bloqueio. Pela Evolution já temos o evento de chamada, sem mais um aparelho conectado.

## Fonte

- Repositório público `DeskLabs-OpenSource/DeskVoice`, licença MIT, criado em 11/11/2026.
- Lidos: README, ROADMAP, CHANGELOG, guia para clínicas, guia de conformidade no Brasil, guia de custos, guia da ligação pelo WhatsApp, guia "na mesma VPS do CRM", decisões 0001 (fronteira com o Deskcomm) e 0018 (caixa postal), e a especificação "follow-up da ligação que caiu" (16/11/2026).
- Nenhum trecho de código foi copiado.

## 1. Como funciona

```
operadora (tronco SIP) ──▶ Asterisk ──▶ serviço de voz (IA fala e ouve)
                                              │
                                              ▼
                                           banco ──▶ rotinas depois da ligação ──▶ painel
                                                     (tarefa, WhatsApp, aviso)
```

- **Quem atende é a IA**, com dois motores: Gemini Live ou OpenAI Realtime. A recepção só entra quando a IA transfere.
- **Instruções e ferramentas por agente:** transferir, deixar recado, abrir tarefa, mandar WhatsApp por conector e consultar a agenda por webhook. As ferramentas de agenda ainda vêm marcadas como indisponíveis.
- **Gravação desligada de fábrica.** A transcrição é guardada. A caixa postal só existe com a gravação ligada.
- **Ligação de saída desligada por regra.** Motivo: o risco de a Anatel bloquear linhas com padrão de chamadas curtas em massa. "Disparo em massa" está fora do produto, por regra escrita.
- **Direitos do titular por telefone:** exportar e apagar tudo de um número, com prazo de guarda configurável.
- **Custo** (estimativa deles, preços de 12/11/2026): 300 ligações de 3 min por mês dão cerca de US$ 21 no Gemini ou US$ 95 na OpenAI, mais VPS (até R$ 173) e telefonia (não conferida).

### Quando a ligação cai (a parte que nos interessa)

A especificação de 16/11 define o que fazer quando a ligação termina sem que alguém tenha ficado com o próximo passo:

| Modo | O que faz |
|---|---|
| Não fazer nada | Padrão |
| Abrir pendência | Tarefa "Retornar para +55…" com dono, prazo, lembrete e link da ligação |
| WhatsApp | Manda um texto para quem ligou |
| Ligar de volta | Previsto, preso à mesma trava das ligações de saída |

Travas do envio:

- no máximo **1 mensagem por número a cada 24 h**;
- no máximo **3 por hora e 20 por dia por organização** (protege o número contra rajada e abuso);
- **texto fixo, sem variáveis, até 300 caracteres**. O motivo: o número de quem ligou pode ser **forjado** na telefonia comum. Se o texto trouxesse o nome do cliente, um estranho que forjasse o número receberia esse nome;
- uma chave "confiar no número de quem liga" (`trust_caller_id`): desligada, nada automático vai para o número;
- respeita a lista de "não contatar";
- não conta como queda quando alguém já ficou com o próximo passo (transferência, recado, pendência ou WhatsApp já enviado).

E, desde antes, quatro situações abrem a tarefa sozinhas, no máximo uma por ligação:

- o motor de voz caiu;
- a transferência falhou e ninguém foi avisado;
- a pessoa desligou esperando uma aprovação;
- o WhatsApp não saiu.

### Guia para clínicas

Instruções prontas para o agente de voz, com frases-limite: não fala de sintoma, exame, remédio, convênio, valor, dado de outra pessoa nem encaixe. Em urgência, só transfere e indica o SAMU 192. **Essas travas ficam só no texto de instruções.** O próprio guia admite que a IA pode furar. Nós temos a trava no código (`src/lib/clinical-claim-guard.ts`), que barra a resposta antes de sair.

## 2. Já temos?

| Ideia do DeskVoice | Na Conecta Saúde | O que fazer |
|---|---|---|
| IA atende a ligação por voz | Não. IA só no texto (Chat, Jev, marcação fora do horário) | Descartar por agora (seção 4) |
| Evento de ligação recebida | Ainda não. Evolution emite `CALL`, não assinamos (`src/lib/evolution-admin.ts`) | Já é o 1º do Top 3 da análise de ligações |
| 1 por número a cada 24 h | Previsto na nossa regra | Manter |
| **Teto por clínica: 3/hora, 20/dia** | Não previsto | **Trazer** (Top 3, 1º) |
| **Sem nome quando o número pode ser forjado** | Nosso texto usa `{{saudacao}}` ("Oi, Maria") | **Trazer** (Top 3, 2º) |
| Chave "confiar no número" | Não | Entra junto com o 2º |
| Lista de não contatar | Temos `channel-consent.ts` (SAIU) e as tags 🚫/📵 | Já previsto |
| **Tarefa quando ninguém ficou com o próximo passo** | Temos Tarefas (`/clinic/tarefas`), mas não ligadas a ligação | **Trazer** (Top 3, 3º) |
| Não dispara se já houve próximo passo | Previsto ("já atendida", "conversa aberta nos últimos 30 min") | Manter |
| Frases-limite clínicas | Temos trava no código (melhor) | Nada |
| Prazo de guarda + exportar/apagar | Temos (`/admin/lgpd`, atestado, exportação do titular) | Incluir ligações quando existirem |
| Caixa postal / gravação | Não | Descartar (LGPD) |
| Custo medido por chamada | Não se aplica | — |
| Ligação de saída bloqueada por regra | Não fazemos ligação de saída | Manter assim |
| Ligação pelo WhatsApp via WaCalls | Não | Descartar (cliente não oficial) |
| Rodar ao lado de um CRM e conversar por webhook | Não | Opção futura (seção 5) |

## 3. Por que o número forjado importa para nós

- **Ligação pelo WhatsApp (Evolution):** o número vem do próprio WhatsApp, então é confiável. Exceção: o número escondido (`@lid`), que já ficou de fora na nossa regra.
- **Telefone fixo (ponte com o PABX ou PABX em nuvem):** o número vem da operadora e **pode ser forjado**. Se o texto disser "Oi, Maria! Vimos sua ligação para a Urolaser", quem forjou descobre que Maria é paciente de uma clínica de urologia. Isso já é dado de saúde (LGPD art. 11).
- Regra que proponho: **nome só quando a fonte é o WhatsApp**. Pela telefonia comum, texto fixo: "Olá! Vimos uma ligação deste número para a {{clinica}}…". E vale pensar no próprio nome da clínica: em clínica de uma especialidade só, o nome já diz algo. Pergunta ao advogado.

## 4. Descartes (uma linha cada)

- **IA atendendo por voz:** custo por minuto, voz não passa pela trava clínica, e um erro falado não tem como ser barrado antes de chegar ao paciente.
- **Gravação e caixa postal:** áudio de paciente é dado sensível. Guardar, dar acesso e apagar no prazo custa caro, e a transcrição iria para fora do país.
- **WaCalls / ligação pelo WhatsApp não oficial:** mais um aparelho no número, risco de bloqueio. Os dois números já foram bloqueados em outubro.
- **Ligar de volta automático:** ligação de saída automática atrai o bloqueio da Anatel e não resolve melhor que a mensagem.
- **Instalar Asterisk:** é infraestrutura própria de telefonia. Só faz sentido se uma clínica trocar de PABX.

## 5. Uma porta aberta: o DeskVoice como fonte de chamada perdida

Se uma clínica um dia usar o DeskVoice, ou qualquer PABX em nuvem, como central, ele pode **mandar um evento por webhook** a cada ligação: perdida, caiu ou terminou sem próximo passo. Nós recebemos o evento e aplicamos a nossa regra. Seria a "fonte d" da análise de ligações. Para isso basta o recebedor de eventos de ligação já nascer genérico: um formato nosso, com o canal informando se o número é confiável.

## 6. Top 3 recomendado (entra na recuperação de chamada perdida, com TDD)

### 1º — Tetos por clínica na recuperação

- Função pura do tipo `recoveryDecision(...)` ganha dois limites por clínica: **envios na última hora** e **envios no dia**. Sugestão de partida: 3/hora e 20/dia, ajustáveis.
- Passou do teto, a mensagem **não sai**. Nasce só a tarefa de retornar, com o motivo "teto da clínica".
- Por quê: protege a saúde do número (`src/lib/number-health.ts`) contra rajada (PABX com defeito, alguém forjando vários números, dia de muita ligação).
- Testes:
  - 4ª ligação perdida na mesma hora vira só tarefa;
  - a 21ª do dia vira só tarefa;
  - a virada do dia é medida no fuso do Brasil.

### 2º — Nome só com número confiável

- O evento de ligação carrega `trustedNumber` (WhatsApp pela Evolution = sim; telefonia comum = não, salvo a clínica ligar a chave "confiar no número", desligada de fábrica).
- Número não confiável: texto fixo, **sem nome e sem nada da ficha**.
- Testes:
  - fonte WhatsApp com contato conhecido → "Oi, Maria";
  - fonte telefone fixo com o mesmo contato → "Olá" e nenhum campo do contato no texto;
  - nenhum texto passa com termo clínico (`findClinicalTerm`).

### 3º — Tarefa automática quando ninguém ficou com o próximo passo

- Quando a mensagem não sai (teto, SMS falhou, número fixo sem WhatsApp, número escondido) **e** ninguém retornou nem conversou com a pessoa, nasce **uma** tarefa em `/clinic/tarefas`: "Retornar ligação de …", vencendo em 30 min no horário comercial ou na abertura do próximo dia útil.
- No máximo uma por ligação. Várias tentativas seguidas do mesmo número contam como uma.
- Não nasce se a pessoa ligou de novo e foi atendida, se já há conversa respondida nos últimos 30 min, ou com a tag 🚫/📵.
- Testes: cada caso acima, mais "não duplica quando o evento chega duas vezes".

## 7. LGPD e CFM

- **Nada clínico no texto.** Vale para WhatsApp e SMS e é conferido no código.
- **Número forjado = possível vazamento.** Daí o 2º item. Sem nome nem dado da ficha quando a fonte não é confiável.
- **Sem gravação e sem transcrição de voz.** Guardamos só o evento: número, hora, duração, se foi atendida e o que fizemos. Prazo de guarda igual ao das conversas, e entra na exportação e no apagamento do titular.
- **Nada vai para Meta ou Google** além do texto de serviço, já sem dado clínico.
- **Base legal** sugerida: procedimentos preliminares a pedido do titular (art. 7º, V). A pessoa ligou primeiro. Confirmar com o advogado, junto com a dúvida do nome da clínica.

## 8. Perguntas para você

1. Os tetos de partida (3/hora e 20/dia por clínica) parecem certos para o volume de ligações da Urolaser e da Santa Clara?
2. No telefone fixo, prefere texto fixo sem nome (mais seguro) ou aceita usar o nome quando o número já está na ficha?
3. Vale o mesmo cuidado com o **nome da clínica** no texto, já que ele pode indicar a especialidade?
4. Continuam abertas as 4 perguntas da [análise de ligações](analise-deskcomm-ligacoes.md#9-o-que-preciso-de-você-para-decidir): PABX e volume, coexistência da Urolaser, convidar ou só avisar, desligar o `rejectCall`.

## Próximo passo

Quando você escolher, os três itens acima entram como regras da recuperação de chamada perdida (1º do Top 3 da análise de ligações), feitos com TDD.

## Decisões do usuário (18/11/2026)

- PABX: Santa Clara usa Leucotron; Urolaser usa um Intelbras simples. Impacto em [estudo-central-telefonica.md](estudo-central-telefonica.md).
- Coexistência da Urolaser: o usuário vai verificar.
- O texto **convida a responder**.
- Pode desligar a recusa de ligações do WhatsApp (`rejectCall`) por enquanto.
- Tetos: **3 por hora e 20 por dia** por clínica.
- No telefone fixo, o texto vai **sem nome**.
- O nome da clínica pode aparecer no texto por enquanto.
- Antes de implementar: estudo da central telefônica própria e do custo.
