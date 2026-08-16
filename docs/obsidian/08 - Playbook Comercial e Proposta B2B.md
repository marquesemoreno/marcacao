#comercial #vendas #b2b #playbook

> [!info] Sobre esta nota
> Parte de [[00 - Visão Geral]]. Complementa [[07 - Guia de Encaminhamento e Captação B2B]] — aquela nota documenta o formulário `/seja-parceiro` e o painel `/admin/leads` (o *ferramental* de captação); esta nota é o *roteiro comercial* usado pela equipe para conduzir a conversa até a assinatura, incluindo a página `/proposta-comercial` (proposta em formato web/impressão).

## O que é

O playbook comercial da Conecta Saúde para fechar parcerias com clínicas e laboratórios de Vitória da Conquista: scripts de abordagem (para contatos já conhecidos da equipe e para contatos frios), matriz de resposta às objeções mais comuns, e um modelo de termo de adesão pronto para assinatura simples. O material foi escrito para uso direto por quem vende — copiar, colar, adaptar o nome e enviar.

## Proposta Comercial (`/proposta-comercial`)

Página pública em `src/app/(public)/proposta-comercial/page.tsx`, pensada para ser aberta no notebook/celular durante a visita **ou** impressa/salva em PDF (`window.print()`, mesmo padrão do voucher — ver [[07 - Guia de Encaminhamento e Captação B2B#Impressão ("Imprimir / Salvar PDF")]]) e deixada com o responsável da clínica. Seções, na ordem em que aparecem:

1. **Cabeçalho executivo** — logo, data do dia, título do programa e assinatura "Uma solução desenvolvida pela TIVDC".
2. **Proposta de valor (Risco Zero)** — sem taxa de adesão, sem mensalidade, comissão só sobre agendamento realizado, recebimento do valor particular direto no balcão da clínica.
3. **Como funciona o fluxo** — 4 etapas: solicitação do paciente → notificação e confirmação da clínica → atendimento com guia digital/QR Code → acerto mensal transparente.
4. **Tabela de comissionamento sugerido** — Consulta Especializada, Ultrassom, ECG, Doppler e Colonoscopia, cada um com preço de balcão, preço Conecta Saúde, taxa de tecnologia (%) e repasse líquido calculado. São valores de referência para abrir a negociação, não uma tabela fechada — cada clínica pode negociar taxa e preço promocional dentro da faixa de 10-15% já praticada (mesmos números usados no seed de desenvolvimento, `commissionRate` em `prisma/seed.ts`).
5. **Termo de compromisso e garantias** — sem fidelidade mínima, liberdade para abrir/pausar horários quando quiser, LGPD, suporte direto.

A barra de ação no topo (`ProposalActionBar`, `src/components/public/proposal-action-bar.tsx`) some na impressão (`print:hidden`) e tem três botões: **Imprimir/Salvar PDF**, **Compartilhar Proposta** (Web Share API nos navegadores que suportam; nos demais, copia o link para a área de transferência) e **Falar com Consultor no WhatsApp** (`buildWhatsAppLink`, mesmo helper usado em `/admin/leads`).

> [!warning] Número de WhatsApp do consultor é placeholder
> `SALES_WHATSAPP` em `proposal-action-bar.tsx` está com um número fictício (`77999990000`). Trocar pelo número real do time comercial antes de divulgar a proposta para fora do ambiente de desenvolvimento.

### Envio rápido a partir de um lead

Em `/admin/leads`, cada card de lead tem um botão **"Enviar Proposta"** que monta um link `wa.me` (`buildWhatsAppLink`) já com o número do lead e uma mensagem contendo o link de `/proposta-comercial` (via `getBaseUrl()`, mesma lógica de link absoluto usada nas notificações de agendamento — ver [[03 - APIs e Webhooks n8n]]). Há também um botão no cabeçalho da página ("Ver Proposta Comercial (PDF)") para abrir a proposta em uma aba nova antes de decidir enviar.

## Script de Abordagem — Clínicas Já Conhecidas

Para contatos que a equipe já tem relacionamento (ex.: Santa Clara, Imad, Sonnar, Clinique Medical e outras clínicas da região já mapeadas). O tom é direto, sem enrolação de abertura institucional — a familiaridade já existe.

### WhatsApp (mensagem inicial)

> Oi, [nome]! Tudo bem? Aqui é [seu nome], da Conecta Saúde. Lembra que a gente comentou sobre preencher os horários vagos da agenda com pacientes particulares? Fechamos o modelo: **sem mensalidade, sem taxa de adesão**, vocês só pagam comissão em cima do que for realmente atendido. Separei uma proposta rapidinha (2 páginas) com a tabela de valores pra [nome da clínica] — posso te mandar agora?

### Ligação (roteiro)

1. **Abertura** — "Oi [nome], aqui é [seu nome] da Conecta Saúde, tudo bem? Rapidinho, não vou tomar seu tempo."
2. **Gancho** — "Vim falar sobre um jeito de ocupar os horários que sobram na agenda de vocês com pacientes particulares, sem custo nenhum pra começar."
3. **Proposta de valor em uma frase** — "Funciona assim: a gente traz o paciente, vocês confirmam pelo painel ou WhatsApp, atendem, e só depois disso é cobrada uma comissão — se não atender, não paga nada."
4. **Pergunta de qualificação** — "Vocês têm horário ocioso hoje em [especialidade/exame que a clínica oferece]?" (deixa a resposta guiar a continuação)
5. **Fechamento da ligação** — "Vou te mandar a proposta completa por WhatsApp agora com a tabela de comissão. Posso passar aí essa semana pra gente assinar o termo, ou prefere que eu mande por e-mail?"

## Script de Abordagem — Clínicas Frias (novos contatos)

Para clínicas sem relacionamento prévio com a equipe. Aqui a abertura precisa estabelecer credibilidade antes do gancho comercial.

### WhatsApp (mensagem inicial)

> Olá! Meu nome é [seu nome], sou consultor(a) comercial da **Conecta Saúde**, plataforma de agendamento de consultas e exames particulares aqui de Vitória da Conquista (hoje já com [X] clínicas parceiras na cidade, como [citar 1-2 exemplos conhecidos da região, se aplicável]). Gostaria de apresentar uma proposta de parceria pra [nome da clínica] — sem taxa de adesão, sem mensalidade, comissão só sobre agendamento realmente atendido. Posso te enviar os detalhes por aqui?

### Ligação (roteiro)

1. **Abertura com credibilidade** — "Bom dia/tarde, meu nome é [seu nome], sou consultor(a) da Conecta Saúde. Somos uma plataforma de agendamento de consultas e exames particulares aqui de Vitória da Conquista, e hoje trabalhamos com clínicas como [exemplos]. Tenho 2 minutos pra te apresentar uma oportunidade?"
2. **Contexto do mercado** — "A gente percebeu que muita gente sem plano de saúde tem dificuldade de achar preço justo e horário rápido pra consulta ou exame particular. A Conecta Saúde conecta esse paciente direto à agenda de clínicas como a sua."
3. **Proposta de valor** — "O modelo é 100% no sucesso: zero custo pra começar, zero mensalidade. Vocês só pagam uma comissão sobre o que for efetivamente atendido — e o paciente paga direto no balcão de vocês, no dia."
4. **Pergunta de qualificação** — "Hoje vocês têm horário ocioso na agenda em algum período da semana?"
5. **Fechamento da ligação** — "Vou te mandar uma proposta completa em PDF com a tabela de comissionamento por especialidade. Se fizer sentido, a gente agenda 15 minutos pra fechar o cadastro."

## Matriz de Resposta às Objeções

| # | Objeção | Como responder |
|---|---|---|
| 1 | **"Já atendemos muitos convênios, não precisamos de mais pacientes."** | "Perfeito, e é exatamente por isso que faz sentido: a Conecta Saúde não compete com convênio, ela ocupa os horários que sobram fora da agenda de convênio — o paciente particular que hoje não acha vaga em lugar nenhum. É receita extra em cima de uma estrutura que já existe, sem tirar espaço de quem já é atendido." |
| 2 | **"Vai dar trabalho para a secretária?"** | "O fluxo foi pensado pra não mudar a rotina: o pedido chega pelo painel (ou WhatsApp, se preferir), a secretária confirma com um clique — igual confirmar qualquer agendamento por telefone, só que já vem com nome, telefone e horário preenchidos. Não precisa aprender sistema novo nem trocar como a agenda funciona hoje." |
| 3 | **"Como é feito o acerto da comissão?"** | "Simples e transparente: o paciente paga o valor cheio direto no balcão da clínica, no dia do atendimento — vocês não esperam repasse de ninguém. Uma vez por mês a gente fecha um relatório com todos os agendamentos realizados no período e emite a cobrança da comissão sobre esse total, com todos os detalhes discriminados por paciente e procedimento." |
| 4 | **"Por que eu daria desconto se já tenho pacientes particulares pagando o preço cheio?"** | "O preço com desconto vale só para quem chega pela plataforma — pacientes que hoje não estão indo até a sua clínica de jeito nenhum. Não é desconto pra quem já paga cheio, é preço de entrada pra atrair quem ainda não conhece vocês. Na prática, é ocupar um horário que hoje fica vazio." |
| 5 | **"E se o paciente marcar e não aparecer?"** | "Esse é o motivo do modelo ser 100% no sucesso: se o paciente não comparece (falta/no-show), a clínica registra isso no painel com um clique e **não há comissão nenhuma** sobre esse agendamento. O risco de não comparecimento fica com a plataforma, não com a clínica." |

## Modelo de Termo de Adesão de Parceria

Modelo simples, pensado para assinatura rápida (presencial ou por e-mail) no fechamento da parceria — não substitui um contrato jurídico revisado por advogado para clínicas de maior porte, mas cobre o essencial para o modelo de comissão descrito na proposta.

```
TERMO DE ADESÃO DE PARCERIA — CONECTA SAÚDE

Pelo presente termo, de um lado

CONECTA SAÚDE (plataforma de agendamento operada por TIVDC),
doravante "CONECTA SAÚDE",

e de outro lado

Clínica/Laboratório: _______________________________________________
CNPJ: ______________________  Nome fantasia: _______________________
Endereço: __________________________________________________________
Responsável legal: _________________________________________________
Telefone/WhatsApp: _________________  E-mail: ______________________

doravante "CLÍNICA PARCEIRA", resolvem firmar o presente Termo de
Adesão de Parceria, nas condições abaixo:

1. OBJETO
   A CONECTA SAÚDE divulgará os procedimentos e horários disponíveis
   da CLÍNICA PARCEIRA em sua plataforma de agendamento, conectando
   pacientes particulares interessados aos serviços oferecidos.

2. CONDIÇÕES COMERCIAIS
   2.1. Não há taxa de adesão nem mensalidade fixa.
   2.2. A remuneração da CONECTA SAÚDE ("taxa de tecnologia") incide
        exclusivamente sobre agendamentos efetivamente REALIZADOS
        (status "Concluído"), conforme percentual acordado por
        procedimento na tabela em anexo.
   2.3. Agendamentos cancelados ou com falta do paciente (no-show)
        não geram cobrança de taxa de tecnologia.
   2.4. O pagamento do procedimento é feito pelo paciente diretamente
        à CLÍNICA PARCEIRA, no dia do atendimento.
   2.5. O fechamento e cobrança da taxa de tecnologia ocorrem
        mensalmente, com relatório detalhado por agendamento.

3. TABELA DE PROCEDIMENTOS E COMISSIONAMENTO
   [Anexar tabela específica negociada com a clínica —
   ver tabela de referência em /proposta-comercial]

4. LIBERDADE OPERACIONAL
   4.1. A CLÍNICA PARCEIRA pode abrir, pausar ou remover horários e
        procedimentos da plataforma a qualquer momento, sem aviso
        prévio obrigatório.
   4.2. Não há fidelidade mínima: qualquer uma das partes pode
        encerrar esta parceria a qualquer momento, mediante aviso
        pelo canal de contato informado, sem multa.

5. DADOS E PRIVACIDADE
   5.1. Os dados de pacientes compartilhados pela CONECTA SAÚDE com
        a CLÍNICA PARCEIRA destinam-se exclusivamente à realização
        do atendimento agendado, conforme a Lei Geral de Proteção
        de Dados (Lei nº 13.709/2018).

6. VIGÊNCIA
   Este termo vigora a partir da data de assinatura abaixo, por
   prazo indeterminado, até que uma das partes solicite o
   encerramento nos termos da cláusula 4.2.

Local e data: ______________________________________________________

_____________________________________     _________________________
Responsável — CLÍNICA PARCEIRA               Responsável — CONECTA SAÚDE
```

> [!note] Uso sugerido
> Preencher os campos e a tabela do item 3 durante a própria visita/ligação de fechamento, usando os valores negociados a partir da tabela de referência da proposta comercial. Duas assinaturas (física, foto do papel assinado, ou aceite por e-mail) já são suficientes para iniciar o cadastro da clínica no sistema — o cadastro em si continua manual via Prisma Studio, mesma lacuna documentada em [[00 - Visão Geral]] ("ainda não existe o cadastro de novos procedimentos no catálogo global pela UI").

## Notas relacionadas

- [[00 - Visão Geral]]
- [[03 - APIs e Webhooks n8n]] — `buildWhatsAppLink`, `getBaseUrl` e o padrão de link absoluto usado também na proposta comercial
- [[07 - Guia de Encaminhamento e Captação B2B]] — formulário `/seja-parceiro`, painel `/admin/leads` e o padrão de impressão (`window.print()` + classes `print:`) reaproveitado em `/proposta-comercial`
