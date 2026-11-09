# Roteiro dos vídeos de apresentação — Conecta Saúde

> Versão 1 — 09/11/2026. Para gravar com a **Clínica Vida (demo)** (`scripts/seed-demo-clinic.ts`): só dados fictícios,
> telefones com DDD 00, nenhum envio sai de verdade.

## Para quem e em que ordem

| # | Vídeo | Duração | Para quem | Onde usar |
|---|-------|---------|-----------|-----------|
| 0 | Vitrine — "a recepção que não deixa paciente sem resposta" | 90 s | dono/gestor que ainda não conhece | site, Instagram, primeiro contato no WhatsApp |
| 1 | Chat: WhatsApp oficial + Instagram + IA | 3 min | gestor e recepção | demonstração, onboarding |
| 2 | Lembretes e confirmação automática | 2 min | gestor | venda (é o que mais dói: falta) |
| 3 | Agenda do dia, chegada, senhas e TV | 3 min | recepção e gestor | demonstração, onboarding |
| 4 | CRM, pacientes e marcadores | 2 min 30 | gestor e marketing | demonstração |
| 5 | Disparos e régua automática | 3 min | gestor e marketing | demonstração |
| 6 | Relatórios e BI | 3 min | dono | venda para quem decide |
| 7 | Segurança e LGPD | 90 s | dono, jurídico | quando perguntarem "e os dados?" |

Gravar nesta ordem: **0 por último** (é recorte dos outros, já com as melhores cenas).

## Regras de gravação

- **Tela:** navegador em janela 1440×900 (ou 1920×1080 com zoom 125%), modo claro, barra de favoritos escondida,
  sem outras abas. Notificações do Windows desligadas (Win+N → Não perturbe).
- **Gravação:** OBS (melhor) ou Win+Alt+R (Xbox Game Bar). Áudio separado no celular se o microfone do notebook chiar.
- **Fala:** frase curta, voz de conversa, sem jargão ("IA", "API" só quando ajudar). Sempre o problema da clínica
  primeiro, depois a tela que resolve.
- **Mouse:** devagar, parar 1 segundo em cima do que está sendo falado. Nada de rolar a página enquanto fala de outra coisa.
- **Nunca** mostrar paciente real, telefone real, painel /admin, outra clínica ou o .env. Se gravar algo fora da demo
  (vídeo 1, cena da API oficial), usar só a conta de teste TIVDC.
- **Não prometer número** que não temos medido ("reduz 30% das faltas"). Usar "menos faltas", "responde em segundos".
- **Não falar preço** no vídeo (a tabela ainda não está fechada) — "fale com a gente" no final.
- Legenda: gerar automática (CapCut / YouTube) e revisar nomes: Conecta Saúde, Jev, Instagram Direct.

---

## Vídeo 0 — Vitrine (90 s)

**Objetivo:** em 90 segundos, o dono entende que é uma recepção digital completa e quer ver mais.

| Tempo | Tela | Fala |
|-------|------|------|
| 0–8 s | Chat com várias conversas chegando (vídeo 1, cena 1) | "Quantos pacientes mandaram mensagem pra sua clínica hoje… e quantos ficaram sem resposta?" |
| 8–20 s | IA sugerindo resposta e a atendente enviando | "O Conecta Saúde junta WhatsApp e Instagram num lugar só, e a IA já sugere a resposta certa — com o preço, o convênio e o horário da sua clínica." |
| 20–35 s | Lembrete D-1 e o paciente respondendo "confirmo" → status muda sozinho | "Um dia antes, o paciente recebe o lembrete. Confirmou, cancelou ou quer remarcar — o sistema entende e atualiza a agenda." |
| 35–50 s | Agenda do dia → paciente faz "Cheguei" pelo QR → TV chama o nome | "Na recepção, a fila de chegada se organiza sozinha, e a TV da sala de espera chama o paciente." |
| 50–65 s | Régua automática ligada + campanha de retorno | "Depois da consulta, ele lembra o retorno, pede avaliação e traz de volta quem sumiu — tudo dentro da LGPD." |
| 65–80 s | Relatórios: funil e Faturamento | "E você, dono, vê de onde vem cada paciente, quanto virou consulta e quanto a clínica faturou." |
| 80–90 s | Logo + WhatsApp de contato | "Conecta Saúde. Sua recepção, sem paciente esquecido. Fale com a gente." |

---

## Vídeo 1 — Chat: WhatsApp oficial + Instagram + IA (3 min)

**Preparação:** login como recepcionista da demo. Ter conversas abertas: uma nova sem resposta, uma do Instagram,
uma com áudio, uma "Aguardando você". Copiloto com crédito da OpenAI.

| Cena | Tela / ação | Fala |
|------|-------------|------|
| 1 (0:00) | Chat aberto, lista de conversas com etiquetas e o chip "Aguardando você" | "Este é o Chat. Toda mensagem do WhatsApp e do Instagram da clínica cai aqui, para toda a equipe, com o histórico do paciente." |
| 2 (0:20) | Passar o mouse no selo do WhatsApp oficial / Configurações › WhatsApp | "A clínica usa o WhatsApp oficial da Meta. Isso quer dizer: número verificado, sem risco de bloqueio por usar app pirata, e vários atendentes no mesmo número." |
| 3 (0:40) | Abrir conversa nova → pergunta de preço/convênio → botão de sugestão da IA | "Paciente perguntou se atende Unimed e quanto custa. A IA já conhece os preços, convênios e horários cadastrados e sugere a resposta. A atendente confere e envia." |
| 4 (1:05) | Resposta rápida com variável ({{nome}}) | "Mensagens que se repetem viram respostas rápidas, já com o nome do paciente." |
| 5 (1:20) | Conversa do Instagram Direct (gravar com a conta de teste @ti.vdc: o Instagram para pacientes ainda depende da revisão da Meta — se não sair até a gravação, cortar esta cena) | "Mensagem do Instagram? Mesmo lugar, mesma equipe, mesmo histórico." |
| 6 (1:35) | Áudio recebido + enviar foto/PDF (pedido de exame) | "Áudio, foto do pedido médico, PDF — tudo chega e sai pelo Chat." |
| 7 (1:50) | Copiloto da Recepção: "tem horário pra dermato quinta?" → resposta com disponibilidade | "E o Copiloto: a recepcionista pergunta em português e ele consulta a agenda, sugere horário e até prepara um cancelamento — sempre pedindo confirmação antes de fazer." |
| 8 (2:20) | Finalizar conversa com motivo (Agendou / Preço / Convênio) | "Ao terminar, a atendente marca o desfecho. É isso que alimenta o relatório de onde a clínica perde paciente." |
| 9 (2:40) | Conversa encerrada sozinha (aviso de fechamento) | "Conversa esquecida não fica aberta pra sempre: depois de 4 horas úteis sem resposta do paciente, ela encerra com uma mensagem educada — e reabre se ele voltar." |
| 10 (2:55) | Encerramento | "Nenhum paciente sem resposta. Esse é o Chat." |

---

## Vídeo 2 — Lembretes e confirmação automática (2 min)

**Preparação:** consultas na demo para amanhã com status Pendente; uma conversa de lembrete com resposta "confirmo",
outra com "preciso remarcar", outra com "número errado".

| Cena | Tela / ação | Fala |
|------|-------------|------|
| 1 (0:00) | Agenda de amanhã com status Pendente | "Falta é dinheiro perdido e horário que outro paciente queria. Por isso, um dia antes, o Conecta manda o lembrete." |
| 2 (0:15) | Mensagem do lembrete no Chat (com primeiro nome, data, médico, endereço) | "O lembrete vai pelo WhatsApp oficial, com o nome do paciente, o médico e o horário." |
| 3 (0:35) | Resposta "confirmo" → status vira Confirmado sozinho | "O paciente responde do jeito dele. 'Confirmo', 'tô indo', 'ok' — o sistema entende e confirma na agenda." |
| 4 (0:55) | Resposta "preciso remarcar" → vai para a recepção com etiqueta | "Quando ele quer remarcar ou a resposta não é clara, a conversa vai direto para a recepção, já sinalizada. A IA só age sozinha quando tem certeza." |
| 5 (1:15) | Resposta "número errado" → etiqueta 📵 | "Número errado? Fica marcado, e a clínica corrige o cadastro." |
| 6 (1:30) | Vaga liberada → oferta automática para a lista de espera (se ligada) | "Se alguém cancela, a vaga pode ser oferecida automaticamente para quem estava na lista de espera." |
| 7 (1:45) | Relatório › confirmações | "E no relatório você vê quantos confirmaram, cancelaram e não responderam." |

---

## Vídeo 3 — Agenda do dia, chegada, senhas e TV (3 min)

**Preparação (precisa de seed novo, ver fim do documento):** agenda de HOJE com 8–10 pacientes em estados variados,
ficha prévia ligada, QR de chegada impresso/na tela, TV aberta numa segunda janela ou TV de verdade.

| Cena | Tela / ação | Fala |
|------|-------------|------|
| 1 (0:00) | Agenda › Dia, com médicos em colunas e pendências | "Esta é a agenda do dia. Cada médico, cada horário, quem confirmou e o que está pendente." |
| 2 (0:20) | Agenda › Semana (carga médico × dia) | "Na semana, o gestor vê a carga de cada médico e onde sobra horário." |
| 3 (0:35) | Celular: link da ficha prévia (/p/…) → paciente preenche | "Antes de vir, o paciente recebe a ficha pelo WhatsApp e preenche no celular. Na recepção, ninguém digita tudo de novo." |
| 4 (1:00) | Celular lê o QR de chegada → "Cheguei" → senha | "Chegou na clínica? Lê o QR na recepção, toca em 'Cheguei' e recebe a senha. Só funciona dentro da clínica." |
| 5 (1:20) | Fila de chegada atualizando ao vivo na agenda | "A fila de chegada aparece na hora para a recepção, na ordem certa." |
| 6 (1:40) | Senhas › chamar → TV mostra nome/senha e fala | "A recepção chama, e a TV da sala de espera mostra a senha e chama em voz alta." |
| 7 (2:05) | Login de médico → ficha prévia do paciente de hoje | "O médico vê a ficha prévia só dos pacientes dele do dia — e cada acesso fica registrado." |
| 8 (2:25) | Médico chama na TV → status Em atendimento → Atendido | "Ele chama pelo consultório, e a agenda acompanha: em atendimento, atendido." |
| 9 (2:45) | Encerramento | "Menos papel, menos fila no balcão, sala de espera organizada." |

---

## Vídeo 4 — CRM, pacientes e marcadores (2 min 30)

| Cena | Tela / ação | Fala |
|------|-------------|------|
| 1 (0:00) | CRM em colunas (Novos → Triagem → Orçamento → Agendado) | "Toda conversa vira uma oportunidade no CRM. Dá pra ver quem está só perguntando, quem pediu orçamento e quem já agendou." |
| 2 (0:20) | Filtro por etiqueta/campanha (chips) | "Filtre por campanha, convênio, procedimento — e veja quem ficou parado no meio do caminho." |
| 3 (0:40) | Fila de orçamentos (3/7/15 dias) | "Orçamento sem resposta? O sistema lembra a equipe de retomar com 3, 7 e 15 dias." |
| 4 (1:00) | Pacientes → ficha do paciente (dados por clínica, responsável de menor) | "Cada paciente tem uma ficha com o histórico de conversas e consultas. Se for menor de idade, o lembrete vai para o responsável." |
| 5 (1:25) | Marcadores: cadastro + copiar link | "Trabalha com marcadores e parceiros que indicam pacientes? Cada um ganha um link de WhatsApp próprio." |
| 6 (1:45) | Relatórios › Marcadores | "E você vê quantos pacientes cada parceiro indicou, quantos agendaram e quantos foram atendidos." |
| 7 (2:10) | Encerramento | "Você sabe exatamente de onde vem cada paciente." |

---

## Vídeo 5 — Disparos e régua automática (3 min)

**Preparação:** campanha de demonstração concluída; régua com prévia; consentimento de marketing de alguns pacientes.
Não disparar nada de verdade.

| Cena | Tela / ação | Fala |
|------|-------------|------|
| 1 (0:00) | Disparos — lista de campanhas com resultado | "Disparos são as mensagens em massa da clínica: campanha de check-up, aviso de feriado, Outubro Rosa." |
| 2 (0:20) | Nova campanha (2 etapas): público + modelo aprovado pela Meta | "No WhatsApp oficial, toda campanha usa um modelo aprovado pela Meta. Você escolhe o público e o modelo, e o sistema preenche o nome de cada paciente." |
| 3 (0:50) | Aviso "Sem consentimento" na prévia | "Campanha de marketing só vai para quem autorizou receber. Os outros aparecem como 'sem consentimento' — é a LGPD funcionando sem a clínica precisar lembrar." |
| 4 (1:10) | Ritmo de envio e saúde do número | "O envio é espaçado e só em horário comercial, e o sistema mostra a saúde do número para a clínica não ser bloqueada." |
| 5 (1:30) | Resultado: enviadas, responderam, agendaram | "Depois, você vê quem respondeu e quantos agendaram por causa da campanha." |
| 6 (1:50) | Régua automática: pós-consulta, retorno, reativação, aniversário (interruptor + prévia) | "E tem a régua automática: agradecimento depois da consulta, lembrete de retorno, convite para quem sumiu há meses e mensagem de aniversário. Liga uma vez e funciona sozinho." |
| 7 (2:30) | Pesquisa de satisfação (NPS) no relatório | "A pesquisa de satisfação também vai sozinha — e a nota aparece no relatório." |
| 8 (2:50) | Encerramento | "Paciente que volta é o paciente mais barato que existe." |

---

## Vídeo 6 — Relatórios e BI (3 min)

**Atenção:** a demo não tem sistema de clínica conectado, então Faturamento/Financeiro/Estoque mostram "a ponte precisa
ser atualizada". Opções: (a) gravar só Atendimento e Marcadores; (b) criar modo demonstração da ponte com números
fictícios (ver fim). **Nunca gravar com dados da Santa Clara ou da Urolaser.**

| Cena | Tela / ação | Fala |
|------|-------------|------|
| 1 (0:00) | Relatórios › Atendimento: resumo do período | "O relatório responde as perguntas do dono: quantos pacientes procuraram, quantos agendaram e quanto tempo levamos para responder." |
| 2 (0:25) | Funil + motivos de perda | "Aqui está onde a clínica perde paciente: preço, convênio, horário. Não é achismo, é o que a equipe marcou em cada conversa." |
| 3 (0:50) | Origem do paciente / campanhas / anúncios | "De onde vem cada paciente — Instagram, Google, indicação — e quanto cada campanha trouxe." |
| 4 (1:10) | Equipe: tempo de resposta por atendente | "O desempenho da equipe, com tempo de resposta de cada atendente." |
| 5 (1:25) | Previsão da semana + agenda × confirmações | "E a previsão da semana: quantas consultas provavelmente vão faltar, para a recepção agir antes." |
| 6 (1:45) | Resumo da IA | "Sem tempo para ler tudo? A IA escreve o resumo do período em poucas linhas." |
| 7 (2:00) | Aba Faturamento (se houver demo) | "Com o sistema da clínica conectado, o dono vê o faturamento, comparado por dia útil — para um mês curto não parecer queda — com o que entra em cada número explicado." |
| 8 (2:30) | Valores fora do padrão / Financeiro / Estoque | "Ele avisa quando algo está fora do padrão e mostra contas a receber, a pagar e o estoque. Só a gestão vê." |
| 9 (2:50) | Encerramento | "Decisão com número, não com impressão." |

---

## Vídeo 7 — Segurança e LGPD (90 s)

| Cena | Tela / ação | Fala |
|------|-------------|------|
| 1 (0:00) | Tela de login com código de 6 dígitos | "Dado de paciente é sério. Por isso o acesso pode ter verificação em duas etapas, com código no celular." |
| 2 (0:15) | Minha conta › Segurança: sair dos outros aparelhos, últimas entradas | "Esqueceu o sistema aberto em outro computador? Um clique desconecta tudo." |
| 3 (0:30) | Funções: Recepção, Marketing, Gestão | "Cada pessoa vê só o que a função dela precisa. Recepção não vê o faturamento." |
| 4 (0:45) | Acessos (log de quem abriu cada ficha) | "Cada acesso a dado de paciente fica registrado: quem, quando e o quê." |
| 5 (1:00) | Consentimento de marketing + exclusão do titular | "Marketing só com consentimento, e se o paciente pedir para apagar os dados, a clínica tem o caminho pronto." |
| 6 (1:15) | Encerramento | "Tecnologia para a recepção, com a segurança que a área da saúde exige." |

---

## Antes de gravar — o que falta preparar

**Seed da demo (scripts/seed-demo-clinic.ts, último de 19/10).** Hoje cria clínica, equipe, procedimentos, conversas
com desfecho, algumas consultas e uma campanha concluída. Falta, para os vídeos 2–6:

1. Consultas de **hoje e amanhã** em todos os estados (pendente, confirmado, chegou, em atendimento, atendido, faltou).
2. Conversas de **lembrete** com respostas "confirmo", "preciso remarcar" e "número errado".
3. **Marcadores** (3–4 fictícios) com pacientes indicados.
4. **Ficha prévia** ligada com alguns pacientes já preenchidos; **QR de chegada** e **TV** configurados; **senhas**.
5. **Consentimento** de marketing em parte dos pacientes; **régua** com prévia; **NPS** com notas.
6. **Orçamentos** na fila de 3/7/15 dias.
7. (Opcional) **ponte demo** com faturamento/financeiro/estoque fictícios para o vídeo 6.

Quem roda o seed é você (grava no banco de produção, só na clínica demo — o script apaga e recria só ela pelo CNPJ fixo).

**Checklist do dia da gravação**
- [ ] Rodar o seed na manhã da gravação (datas são relativas a "hoje").
- [ ] Senha da demo no `.env` local (DEMO_PASSWORD) — não aparece no vídeo.
- [ ] Crédito da OpenAI ok (Copiloto e sugestões).
- [ ] Segunda tela/TV com `/tv/<token>` da demo.
- [ ] Celular com a câmera para o QR de chegada (gravar a tela do celular separado).
- [ ] Navegador limpo, zoom certo, Não perturbe ligado.
