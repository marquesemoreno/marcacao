# Como as atendentes da Urolaser respondem — análise para a IA

> 25/11/2026 · Só análise. **Nada foi mudado na IA.** As frases propostas no fim precisam do OK da clínica.

## O que foi analisado

- **1.051 mensagens** escritas pelas atendentes no Chat da plataforma, em **229 conversas**, de **02/09 a 04/11/2026** (Bruna 889, Rebeca 161).
- Cada resposta foi lida junto com a mensagem do paciente que veio antes.
- Nomes, telefones, CPF e e-mails foram mascarados antes da leitura. Nenhum dado de paciente está neste documento.

**Limites da amostra**
- Só entra o que foi digitado no Chat da plataforma. O que a recepção responde direto pelo celular (API oficial em coexistência) não aparece, e por isso a amostra para em 04/11.
- Uma boa parte das conversas é com **parceiros**: outras clínicas que encaminham pacientes, médicos e a própria equipe. Nelas o tom é outro ("amiga", "meninas", "Lid"), e esse tom **não deve** ir para a IA.
- Ainda não há respostas ao Novembro Azul: a campanha começou em 25/11.

## O jeito de falar da recepção

| Traço | Como aparece | Para a IA |
|---|---|---|
| **Curto e direto** | Respostas de uma linha, muitas vezes quebradas em 2 ou 3 mensagens | Frases curtas, uma ideia por mensagem |
| **Saudação fixa** | "Olá, boa tarde! Tudo bem?" (84×) · "Olá, bom dia! Tudo bem?" (39×) · "Em que podemos ajudar?" (18×) | Usar a mesma saudação, conforme o horário |
| **Falam no plural** | "podemos", "temos", "ficamos à disposição" | Sempre "nós" (a clínica), nunca "eu" |
| **Respeitoso com o paciente** | "o senhor", "a senhora", "por gentileza" | Manter |
| **Íntimo só com parceiros** | "amiga", "meu bem" aparecem com clínicas parceiras e, raramente, devolvendo o carinho de um paciente | A IA **não** usa |
| **Quase sem emoji** | Só o 📌 dos textos prontos (endereço e regra de retorno) | A IA **não** usa emoji |
| **Não comentam o que o paciente manda** | Emoji, figurinha ou "rs" não ganham comentário: a atendente segue com a pergunta seguinte | É exatamente o que faltou na Lara ("Que bom ver seu sorriso!") |
| **Pergunta para fechar** | "Gostaria de agendar?" (17×) · "Podemos agendar?" · "Gostaria de remarcar?" | A pergunta da Lara deve soar assim |
| **Encerramento** | "Por nada!" · "Ficamos à disposição" (15×) · "Disponha!" · "Certinho" (22×) | Usar essas palavras |

## Situações e o que a recepção responde

| Situação | Resposta típica (texto limpo) |
|---|---|
| Paciente só cumprimenta | "Olá, bom dia! Tudo bem? Em que podemos ajudar?" |
| Valor da consulta | "A consulta fica R$ 250,00." Quando perguntam: "Caso seja necessário o toque, já está incluso. Os demais exames são cobrados à parte." |
| Convênio / plano | "Não atendemos convênio! Podemos dar um desconto de taxa apresentando a carteirinha física ou digital do plano." |
| Formas de pagamento | "Formas de pagamento: Dinheiro, Pix, Cartão de Crédito e Débito." |
| Que dia o médico atende | "Temos agenda para sexta pela manhã." Ou: "Dr. X atende terça, quarta e sexta pela manhã." |
| Horário | "O atendimento é por ordem de chegada! A clínica abre às 07:00 e o atendimento começa às 08:00." Ficha até 10:30–11:00. |
| Para agendar | "Poderia me informar o nome completo e o CPF, por gentileza?" · "Poderia encaminhar a foto do pedido?" |
| Exame de cistoscopia / urodinâmica | Triagem fixa: "Paciente usa sonda? É cadeirante ou acamado? Qual a idade do paciente?" (16×) |
| Biópsia | Texto fixo pedindo que o paciente confira o preparo e suspenda os medicamentos citados |
| Agendamento feito | Modelo fixo: "Agendada CONSULTA com Dr(a) … para o dia … às 08:00, por ordem de chegada! Valor R$ … 📌 As consultas têm prazo de no máximo 30 dias para retorno…" + endereço 📌 |
| Sem vaga | "Infelizmente para essa semana não temos. Temos para o dia …" (sempre oferecem outra data) |
| Não faz o exame | "Infelizmente não realizamos." |
| Cirurgia / orçamento | Encaminham para o contato da cirurgia (outro número) |
| Quer cancelar | "Gostaria de remarcar para outra data?" (sempre tentam remarcar antes) |
| Retorno vencido | "O retorno tem prazo de 30 dias. … nesse caso é uma nova consulta." |
| Paciente agradece | "Por nada! Ficamos à disposição." |
| Paciente diz que agora não quer | "Certinho, ficamos à disposição." |

## Inconsistências que a clínica deve conhecer

Se a IA aprender com as conversas sem filtro, estas inconsistências entram junto.

1. **Desconto de convênio com valores diferentes.** Em uma conversa a consulta aparece como "R$ 300,00 fica por R$ 250,00"; em outras, "R$ 250,00 fica por R$ 200,00". Também aparece "R$ 200,00 (APRESENTAR GUIA)" e R$ 120,00 com guia.
2. **Parcelamento.** Algumas respostas dizem "não dividimos esse valor"; outra diz "o valor total dividimos em 2x".
3. **Modelo de agendamento enviado sem preencher.** Por exemplo: "Agendada _____ com Dr(a) _____" e "Dr(a) 04.11".
4. **Dois "boas-vindas" diferentes.** "Olá, bom dia! Como podemos lhe ajudar?" e um texto automático: "Olá, [nome]! 👋 Obrigado por entrar em contato com a Urolaser…".
5. **Erros de digitação frequentes** ("Tud bem", "pel amnhã", "isposição"). A IA não deve copiar.

👉 **Valores e regras (preço, desconto de convênio, parcelamento) não devem vir das conversas.** A IA só deve informar o que estiver cadastrado na plataforma e conferido pela clínica.

## Proposta para a Lara da campanha (não aplicada)

Hoje as frases fixas são estas. Ao lado, uma sugestão no jeito da recepção:

| Momento | Frase atual | Sugestão no tom da recepção |
|---|---|---|
| Pergunta (resposta não clara, ex.: um emoji) | "Você deseja agendar uma consulta ou um exame?" | "Olá, tudo bem? Gostaria de agendar uma consulta ou um exame?" |
| Quer agendar / tem dúvida | "Perfeito! Aguarde só um instante, que nossa equipe já vai falar com você por aqui. 💙" | "Certinho! Só um instante, que já vamos te atender por aqui." |
| Não quer | "Tudo bem! Obrigada pela atenção. Quando precisar, estamos por aqui. 💙" | "Certinho! Ficamos à disposição." |

Por que mudar:
- a recepção quase nunca usa emoji;
- "Gostaria de agendar?" é a pergunta que elas mais fazem;
- "Certinho" e "Ficamos à disposição" são as palavras que o paciente já está acostumado a ouvir da Urolaser.

## Próximos passos (quando a clínica aprovar)

1. A clínica escolhe entre as frases atuais e as sugeridas, ou ajusta o texto.
2. A clínica define o valor oficial do desconto de convênio e a regra de parcelamento, para a recepção e para a IA falarem o mesmo.
3. Se a ideia for levar esse tom ao **atendente de IA completo** (não só à Lara), o caminho é usar as respostas da tabela "Situações" como frases-modelo, com os valores vindos do cadastro, e não deixar a IA imitar as conversas livremente.
