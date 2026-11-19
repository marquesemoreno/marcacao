# Roteiro dos vídeos de apresentação — Conecta Saúde

> Versão 2 — 19/11/2026 (v1 09/11). Para gravar com a **Clínica Vida (demo)** (`scripts/seed-demo-clinic.ts`): só dados fictícios,
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

Gravar nesta ordem (decidido 19/11): **2 → 1 → 3 → 6 → 5 → 4 → 7 → 0** — começa pelo que mais vende (falta), vitrine
por último (é recorte dos outros, já com as melhores cenas).

## Voz (decidido 19/11: voz do Lucas clonada por IA)

1. **Gravar a amostra** (texto abaixo, ~2 min) uma vez só, com calma:
   - cômodo pequeno e "fofo" (quarto com cortina/guarda-roupa aberto), janela fechada, ventilador e ar desligados;
   - celular a um palmo da boca, um pouco de lado (evita o "p" estourado), gravador de voz do celular em qualidade alta;
   - voz de conversa, no mesmo ritmo que vai querer nos vídeos; pausa curta entre frases; se errar, para 2 s e repete a frase.
2. **Criar a voz:** ElevenLabs → Voices → *Instant Voice Clone* → enviar o arquivo (precisa de plano pago; confira o
   preço na hora). Modelo *Multilingual v2* para português.
3. **Gerar a narração** cena por cena com o texto da coluna "Fala"; baixar em MP3 e montar no CapCut por cima da gravação de tela.
4. Ouvir tudo antes de publicar: nomes (Conecta Saúde, Jev, Unimed) e números às vezes saem errados — corrigir escrevendo
   por extenso ("quinze minutos").

**Texto da amostra:**

> Oi, eu sou o Lucas, da TIVDC. A Conecta Saúde junta o WhatsApp e o Instagram da clínica num lugar só.
> Quando o paciente manda mensagem, a recepção vê na hora, com o histórico, o convênio e a próxima consulta.
> Um dia antes, o paciente recebe o lembrete. Se ele responde "confirmo", a agenda atualiza sozinha.
> Se pede para remarcar, a conversa vai direto para a recepção. Simples assim.
> E o dono da clínica? Ele abre o relatório e vê quantos pacientes procuraram, quantos agendaram,
> quanto tempo a equipe levou para responder e onde a clínica está perdendo paciente.
> Tudo dentro da LGPD: cada acesso fica registrado, e marketing só vai para quem autorizou.
> Segunda, terça, quarta, quinta, sexta. Oito e meia, dez horas, quinze minutos, trinta por cento.
> Dermatologia, ginecologia, ultrassom, check-up, retorno. Unimed, Bradesco Saúde, Cassi, particular.
> Será que funciona? Funciona! Quer ver? Então vem comigo que eu te mostro.
> Conecta Saúde: sua recepção, sem paciente esquecido.

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
| 8b (2:30) | Conversa perguntando "aceita SulAmérica?" → resposta da IA com os convênios cadastrados (IA › Convênios aceitos) | "A IA também responde quais convênios a clínica aceita, com a lista que a própria clínica cadastrou." |
| 8c (2:35) | Tela Esperando (paciente sem resposta volta para Não atribuídas) | "Se a atendente não responde a tempo, a conversa volta para a fila e aparece em 'Esperando' — ninguém fica esquecido." |
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
| 8 (1:55) | IA › 2º lembrete do dia (só mostrar o interruptor, não ligar) | "Quem não respondeu ao lembrete pode receber uma segunda mensagem no mesmo dia — a clínica decide." |

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
| 6b (1:55) | Disparos › Automações: "Orçamento parado" e "Aguardando retorno" (já ligadas na demo) | "E o que antes dependia de memória vira automação: orçamento parado há 3 dias gera uma tarefa, paciente que sumiu recebe uma mensagem." |
| 6c (2:05) | Tarefas (/clinic/tarefas): atrasada, de hoje, criada pela automação | "As tarefas da recepção ficam numa lista só, com prazo e responsável." |
| 7 (2:20) | Encerramento | "Você sabe exatamente de onde vem cada paciente." |

---

## Vídeo 5 — Disparos e régua automática (3 min)

**Preparação:** campanha de demonstração concluída; régua com prévia; consentimento de marketing de alguns pacientes.
Não disparar nada de verdade.

| Cena | Tela / ação | Fala |
|------|-------------|------|
| 1 (0:00) | Disparos — lista de campanhas com resultado | "Disparos são as mensagens em massa da clínica: campanha de check-up, aviso de feriado, Outubro Rosa." |
| 2 (0:20) | Nova campanha (2 etapas): público + modelo aprovado pela Meta | "No WhatsApp oficial, toda campanha usa um modelo aprovado pela Meta. Você escolhe o público e o modelo, e o sistema preenche o nome de cada paciente." |
| 3 (0:50) | Aviso "Sem consentimento" na prévia | "Campanha de marketing só vai para quem autorizou receber. Os outros aparecem como 'sem consentimento' — é a LGPD funcionando sem a clínica precisar lembrar." |
| 4 (1:10) | Ritmo de envio (sem focar no selo do número — na demo ele aparece "Conexão não verificada") | "O envio é espaçado e só em horário comercial, para a clínica não ter o número bloqueado." |
| 4b (1:20) | Nova campanha › "Testar outros modelos": escolher 2 modelos extras (checkup_novembro_curto / _pergunta) e ver as prévias | "Na dúvida sobre qual texto funciona melhor? Escolha até três modelos: cada paciente recebe um, sorteado." |
| 5 (1:30) | Resultado: enviadas, responderam, agendaram | "Depois, você vê quem respondeu e quantos agendaram por causa da campanha." |
| 5b (1:40) | Relatório › campanha "Check-up de novembro": tabela por modelo | "E o relatório mostra qual modelo teve mais respostas e mais agendamentos — com o aviso quando a amostra ainda é pequena." |
| 6 (1:50) | Régua automática (Disparos › Configurar): escolher um modelo, mudar os dias e ver a prévia "Amanhã às 8h: ~N", ligar o interruptor | "E tem a régua automática: agradecimento depois da consulta, lembrete de retorno, convite para quem sumiu há meses e mensagem de aniversário. Liga uma vez e funciona sozinho." |
| 7 (2:30) | Pesquisa de satisfação (NPS) no relatório | "A pesquisa de satisfação também vai sozinha — e a nota aparece no relatório." |
| 8 (2:50) | Encerramento | "Paciente que volta é o paciente mais barato que existe." |

---

## Vídeo 6 — Relatórios e BI (3 min)

**Atenção:** Faturamento, Financeiro e Estoque usam o modo demo da ponte (números fictícios, ver fim). A previsão da
semana só aparece com o sistema da clínica conectado, por isso ficou fora deste vídeo. **Nunca gravar com dados da Santa
Clara ou da Urolaser.**

| Cena | Tela / ação | Fala |
|------|-------------|------|
| 1 (0:00) | Relatórios › Atendimento: resumo do período | "O relatório responde as perguntas do dono: quantos pacientes procuraram, quantos agendaram e quanto tempo levamos para responder." |
| 2 (0:25) | Funil + motivos de perda | "Aqui está onde a clínica perde paciente: preço, convênio, horário. Não é achismo, é o que a equipe marcou em cada conversa." |
| 3 (0:50) | Origem do paciente / campanhas / anúncios | "De onde vem cada paciente — Instagram, Google, indicação — e quanto cada campanha trouxe." |
| 4 (1:10) | Equipe: tempo de resposta por atendente | "O desempenho da equipe, com tempo de resposta de cada atendente." |
| 5 (1:25) | Confirmações (taxa de confirmação dos lembretes) | "E quantos pacientes confirmaram pelo lembrete automático — a recepção sabe com antecedência quem precisa de ligação." |
| 6 (1:45) | Resumo da IA | "Sem tempo para ler tudo? A IA escreve o resumo do período em poucas linhas." |
| 7 (2:00) | Aba Faturamento | "Com o sistema da clínica conectado, o dono vê o faturamento, comparado por dia útil — para um mês curto não parecer queda — com o que entra em cada número explicado." |
| 8 (2:30) | Valores fora do padrão / Financeiro / Estoque | "Ele avisa quando algo está fora do padrão e mostra contas a receber, a pagar e o estoque. Só a gestão vê." |
| 8b (2:40) | Aba Ocupação: cartões dos consultórios e da sala de exames + mapa por dia/hora | "E a ocupação de cada consultório e da sala de exames: quanto do horário está marcado, quanto se perdeu com falta e em que horários sobra espaço." |
| 9 (2:55) | Encerramento | "Decisão com número, não com impressão." |

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

**Seed da demo (scripts/seed-demo-clinic.ts, atualizado 09/11).** Cria tudo que os vídeos usam: agenda de hoje em
todos os estados (atendido, faltou, em atendimento, aguardando com chegada, confirmado, sem resposta), fichas prévias
preenchidas, amanhã com lembretes (confirmou, pediu para remarcar, cancelou, sem resposta, número errado) e as conversas
correspondentes, semana seguinte, 4 marcadores com indicados/agendados/atendidos, consentimento de marketing em ~2/3 dos
pacientes, um menor com responsável, um aniversariante do dia, régua (desligada), NPS com comentários, orçamentos de 3/8/16
dias, lista de espera, senhas do dia, chamadas na TV, salas dos médicos, conversa do Instagram (só visual) e campanha concluída.
Desde 19/11 também: salas da aba Ocupação (3 consultórios de 30 min + sala de exames de 40 min, seg–sex 08–17) com agenda
cheia nas últimas 2 semanas, e a campanha "Check-up de novembro" com sorteio entre 3 modelos (respostas por modelo no Relatório).

**Faturamento, Financeiro e Estoque na demo** usam o modo demo da ponte (src/lib/bi/demo-bridge.ts): números fictícios,
sempre os mesmos para o mesmo dia. A linha "Fonte" mostra "DEMONSTRAÇÃO — números fictícios" — deixar aparecer.

**Régua na demo** (src/lib/demo-regua.ts): modelos de exemplo, prévia fictícia e interruptor funcionando. O cron das 8h
pula a clínica demo, então ligar a régua na gravação não envia nada. Depois de gravar, pode desligar ou só rodar o seed de novo.

Comando (você roda; grava no banco só a clínica demo — apaga e recria pelo CNPJ fixo 00.000.000/0001-00):

```bash
npx tsx --conditions=react-server scripts/seed-demo-clinic.ts
```

No fim ele imprime os links da TV, do totem e do QR de chegada da demo (novos a cada execução).

**Checklist do dia da gravação**
- [ ] Rodar o seed na manhã da gravação (datas são relativas a "hoje").
- [ ] Senha da demo no `.env` local (DEMO_PASSWORD) — não aparece no vídeo.
- [ ] Crédito da OpenAI ok (Copiloto e sugestões).
- [ ] Segunda tela/TV com o link de TV que o seed imprimiu.
- [ ] Celular com a câmera para o QR de chegada (gravar a tela do celular separado).
- [ ] Navegador limpo, zoom certo, Não perturbe ligado.
