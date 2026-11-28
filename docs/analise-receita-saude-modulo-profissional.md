# Receita Saúde e o módulo para profissionais autônomos (28/11/2026)

Para quem: **fisioterapeutas, psicólogos, fonoaudiólogos, terapeutas ocupacionais, nutricionistas** (e médicos e dentistas) que atendem como **pessoa física**.
Objetivo: entender o Receita Saúde a fundo e propor o módulo "Conecta Profissional", ligado ao financeiro e ao BPO da Sinergia.

**Fonte principal:** manual oficial *Receita Saúde: Orientações para emissão do recibo*, **versão 2.1, outubro de 2025** (Receita Federal), lido na íntegra. Pontos que vêm de outras fontes estão indicados. Nada foi implementado.

---

## 1. Resumo

1. **Obrigatório desde 01/01/2025** (IN RFB nº 2.240, de 11/12/2024) para **6 profissões** que atendem como **pessoa física**: dentistas, fisioterapeutas, fonoaudiólogos, médicos, psicólogos e terapeutas ocupacionais.
2. **Nutricionista não está na lista.** Não usa o Receita Saúde. (Fontes secundárias associam a lista às despesas que o paciente pode deduzir no IR; o manual não explica o motivo.)
3. **Quem atende como PJ (CNPJ) não usa** o Receita Saúde: emite NFS-e (fontes secundárias; o manual fala só em pessoa física).
4. **Não existe API oficial.** Existe uma **importação em lote por arquivo CSV** no Carnê-Leão Web (até 1.000 recibos por arquivo), com layout publicado no manual. **É por aí que um software se integra.**
5. Cada recibo emitido já entra como **receita no Carnê-Leão** e na **declaração pré-preenchida do paciente**. As **despesas** do profissional (livro-caixa) continuam manuais.
6. **Oportunidade:** o profissional tem três tarefas chatas todo mês: recibo por pagamento, livro-caixa e DARF do Carnê-Leão. Quase ninguém resolve as três juntas, nem pelo WhatsApp.

## 2. Regras do Receita Saúde (manual oficial v2.1)

| Tema | Regra |
|---|---|
| Base legal | IN RFB nº 2.240/2024; prazo retroativo no ADE Cofis nº 11/2025 |
| Quem emite | as 6 profissões acima, como **pessoa física**, com **registro ativo no conselho** (o conselho envia os dados à Receita, no máximo uma vez por mês; registro recente pode demorar a aparecer) |
| Quando | **na data do pagamento**, não na do atendimento |
| Parcelado | **um recibo por parcela paga** |
| Nota fiscal | a NFS-e **não substitui** o recibo para o profissional PF. A nota comprova o serviço; o recibo comprova o pagamento. Exemplo do manual: tratamento de R$ 1.000 em 4×: uma nota de R$ 1.000 no fim e **4 recibos de R$ 250**, um a cada pagamento |
| Retroativo | permitido até o **último dia de fevereiro do ano seguinte** ao pagamento (pagamentos de 2025: até 28/02/2026), desde que não haja fiscalização iniciada; exige ajustar o Carnê-Leão |
| Cancelamento | em até **10 dias** da emissão, se emitido com erro (art. 7º); no lote, há "Desfazer escrituração" |
| Multa | **R$ 100 por mês-calendário ou fração** por não emitir ou emitir com erro (art. 4º) |
| Onde | app Receita Federal (celular/tablet) ou **Carnê-Leão Web** no e-CAC ("+ Receita Saúde" em Rendimentos) |
| Acesso | conta **gov.br** (fontes secundárias: nível prata ou ouro) |
| Representante | o profissional dá **procuração eletrônica no e-CAC** a outra pessoa (ex.: secretária), que emite em nome dele. Pode haver vários representantes; o sistema registra quem emitiu |
| Pagador × paciente | o recibo tem **CPF do pagador** e **CPF do beneficiário**, que podem ser diferentes (ex.: mãe paga pelo filho) |
| Paciente sem CPF | não é possível emitir (fonte secundária) |
| Paciente | vê o recibo no app, no perfil Paciente; o recibo vai para a **pré-preenchida** dele. Sem recibo, o paciente ainda pode deduzir, mas aumenta a chance de cair na malha |
| Validação | serviço "Validação Receita Saúde" no app (nº do recibo, valor, CPF do profissional e do beneficiário) |
| Planos de saúde | vários passaram a exigir o recibo do Receita Saúde para **reembolso** (fonte secundária) |

## 3. Como um software pode se integrar

| Caminho | Como funciona | Avaliação |
|---|---|---|
| **A. Arquivo CSV em lote** (oficial) | O Conecta gera o CSV; o profissional **ou o representante dele** entra no Carnê-Leão Web › Escrituração › Importar Escrituração › Analisar › Importar; baixa a relação dos recibos com os números | ✅ **Recomendado.** Oficial, sem senha de ninguém. Um clique por semana ou mês, e não um recibo por paciente |
| **B. Representante humano** | A secretária ou o **analista da Sinergia** recebe procuração e faz a importação do caminho A pelo profissional | ✅ Combina com o BPO: a Sinergia opera, o profissional não precisa entrar no e-CAC |
| C. API de terceiros (ex.: Rebots) | O fornecedor diz emitir "junto à Receita" e devolver o PDF por callback | ⚠️ Não verificado; não diz como se autentica na Receita. **Não usar** até entender o mecanismo (risco de credencial e LGPD) |
| D. Automatizar o login gov.br do profissional | robô entra com a senha dele | ❌ **Não fazer.** Senha de terceiro, quebra os termos do gov.br e é um risco grave |

### 3.1 Layout oficial do arquivo (manual v2.1, pergunta 24)

CSV **separado por ponto e vírgula**, **até 1.000 linhas**, **todos os pagamentos do mesmo ano**. Campos, nesta ordem:

| # | Campo | Conteúdo |
|---|---|---|
| 1 | Data do pagamento | `DD/MM/AAAA` (data do pagamento efetivo) |
| 2 | Código do rendimento | fixo `R01.001.001` (trabalho não assalariado) |
| 3 | Código da ocupação | `225` médico · `226` odontólogo · `230` fonoaudiólogo · `231` fisioterapeuta · `232` terapeuta ocupacional · `255` psicólogo |
| 4 | Valor do pagamento | > 0, sem separador de milhar, máx. 99999999999,99 |
| 5 | Valor da dedução | **vazio** |
| 6 | Descrição | até 255 caracteres (pode incluir a data do atendimento) |
| 7 | Recebido de | fixo `PF` |
| 8 | CPF do pagador | 11 dígitos |
| 9 | CPF do beneficiário | 11 dígitos |
| 10 | Ind. CPF não informado | **vazio** |
| 11 | CNPJ | **vazio** |
| 12 | Indicador de IRRF | **vazio** |
| 13 | Valor IRRF | **vazio** |
| 14 | Indicador de recibo | fixo `S` |
| 15 | CPF do profissional | 11 dígitos (o mesmo do login no Carnê-Leão) |
| 16 | Registro profissional | até 15 caracteres; pode ficar vazio se houver só um registro ativo |

Pré-requisito: o profissional precisa ter o Carnê-Leão Web configurado (pergunta 11 do manual). O manual mostra uma linha de exemplo como imagem, que não pôde ser lida. ⚠️ Confirmar o separador decimal (vírgula ou ponto) com um arquivo de teste antes de liberar.

## 4. O que esses profissionais precisam (hipóteses a validar com o consultor e com profissionais)

As hipóteses abaixo vêm da experiência de mercado e dos sites lidos. Devem ser confirmadas em entrevistas.

| Necessidade | Quem mais sente | Observação |
|---|---|---|
| Recibo por pagamento sem retrabalho | psico, fisio, fono, TO | obrigatório, multa de R$ 100/mês |
| **Pacotes de sessões** (paga 10, usa 10) e saldo de sessões | fisio, psico, nutri | o recibo sai **no pagamento** do pacote, não a cada sessão |
| **Mensalidade recorrente** | psicólogo | cobrança mensal, Pix recorrente |
| **Falta e desmarcação** com cobrança conforme contrato | psicólogo | gera pagamento e, portanto, recibo |
| Reembolso de plano de saúde | psico, fisio, nutri | paciente precisa do recibo e de um relatório; o Conecta pode mandar tudo pelo WhatsApp |
| Convênio (guias TISS) | fisio, psico | entra no módulo de convênios do plano mestre |
| **Livro-caixa** (despesas dedutíveis: aluguel da sala, conselho, material, etc.) | todos PF | hoje é manual no Carnê-Leão; regras de dedução são do contador |
| **DARF mensal do Carnê-Leão** | todos PF | o Carnê-Leão Web calcula; o Conecta lembra e prepara os números |
| Separar dinheiro pessoal e profissional | todos PF | conta única é comum |
| **PF ou PJ?** Quando vale abrir CNPJ | todos | papel do consultor e do contador; o Conecta mostra os números |
| Nutricionista (fora do Receita Saúde) | nutri | recibo próprio (PDF) + livro-caixa; PJ emite NFS-e |
| Trabalha também em clínica (RPA/PJ) | todos | receita de PJ não vai no recibo; entra separada |

## 5. Proposta: módulo "Conecta Profissional"

Reaproveita o plano mestre: o profissional é uma **entidade financeira `PROFISSIONAL_PF`** (já prevista), por **regime de caixa** (como o Carnê-Leão), e pode ser atendido pelo **BPO da Sinergia**.

### 5.1 MVP

1. **Cadastro do profissional:** profissão (código da ocupação), registro no conselho, CPF, se está no Receita Saúde (nutricionista não), se tem representante (procuração para a Sinergia ou a secretária).
2. **Paciente com pagador:** CPF do paciente e do pagador (responsável). Aviso quando falta CPF, porque sem ele não há recibo.
3. **Registro do pagamento** (Pix, cartão, dinheiro, pacote, parcela). Cada pagamento cria um **recibo pendente** com data, valor, pagador, beneficiário e descrição ("Sessão de fisioterapia – 12/11").
4. **Lote de recibos:** botão "Gerar arquivo do Receita Saúde" (semanal ou mensal) com validação antes de baixar:
   - CPF válido;
   - todos os pagamentos no mesmo ano;
   - até 1.000 linhas por arquivo;
   - mesmo ano do pagamento;
   - código da ocupação correto.

   Mais um passo a passo de 6 telas para importar no Carnê-Leão.
5. **Conferência:** o profissional ou o analista sobe a "relação de recibos gerados" que o Carnê-Leão devolve; o Conecta casa cada número de recibo com o pagamento e marca como **emitido**.
6. **Envio ao paciente pelo WhatsApp**: "seu recibo nº X foi emitido e já está no app da Receita e na sua declaração pré-preenchida".
7. **Alertas:**
   - pagamento sem recibo há mais de N dias (multa de R$ 100/mês);
   - recibo com erro dentro do prazo de 10 dias;
   - prazo retroativo de fevereiro;
   - lembrete do DARF do Carnê-Leão (⚠️ vencimento a confirmar com o contador).
8. **Livro-caixa:** despesas por foto pelo WhatsApp (IA lê o comprovante) e categoria indicada pelo contador. Resumo mensal "o que lançar no Carnê-Leão", sem cálculo de imposto próprio no MVP.
9. **Nutricionista e outras profissões fora da lista:** recibo em PDF do Conecta, com os mesmos dados, mais livro-caixa.

### 5.2 Depois do MVP

- Pacotes e saldo de sessões, mensalidade recorrente, cobrança de falta conforme contrato.
- Cobrança por Pix ou link (via parceiro, como no plano mestre).
- Kit de reembolso: recibo + relatório de sessões para o plano, enviado ao paciente.
- Painel PF × PJ: quanto pagaria em cada modelo, para a conversa com o consultor e o contador.
- Agenda própria para quem não tem sistema (hoje a agenda do Conecta é por clínica: o profissional pode ser uma "clínica de uma pessoa só").
- Estimativa do DARF com a tabela oficial do ano (configurável, revisada pelo contador).

### 5.3 Onde está o diferencial

| Concorrência | O que faz | O que o Conecta Profissional faz a mais |
|---|---|---|
| App da Receita | emissão manual, recibo a recibo | lote automático, conferência, aviso ao paciente |
| Contabilidades online (Agilize, Contabilizei) | orientação e contabilidade | operação diária (agenda, cobrança, WhatsApp) |
| Software de agenda/consultório | agenda e financeiro básico | recibo em lote + livro-caixa + BPO da Sinergia |
| — | — | **tudo pelo WhatsApp**: paciente paga, recebe o recibo; profissional manda a despesa por foto |

## 6. Riscos e cuidados

- **Sem API oficial:** o layout do CSV pode mudar. Monitorar o manual (versão atual 2.1, out/2025) e manter o gerador com teste automatizado.
- **Nunca guardar senha gov.br** de ninguém. A emissão é sempre feita pelo profissional ou por um representante humano com procuração.
- **LGPD:** CPF do paciente e do pagador + vínculo com atendimento de saúde = dado sensível. Usar o mesmo portão de PII da IA e o registro de acesso que já existem.
- **Não é consultoria tributária:** o Conecta organiza e lembra; regime (PF/PJ), dedução e imposto são do contador e do consultor.
- **Responsabilidade do recibo é do profissional:** o Conecta prepara; a emissão oficial acontece no Carnê-Leão.

## 7. Perguntas para o consultor (e para um contador)

1. Quantos profissionais PF a Sinergia atende ou quer atender? De quais profissões?
2. A Sinergia aceitaria ser **representante (procuração)** dos profissionais para importar os lotes?
3. Que despesas de livro-caixa o contador costuma aceitar para cada profissão?
4. Qual a regra de vencimento e cálculo do DARF que vamos lembrar (para confirmar no texto)?
5. Pacotes: o profissional emite um recibo do pacote inteiro ou por parcela paga? (O manual diz: na data de cada pagamento.)
6. Preço: o módulo profissional entra como plano próprio (mais barato) ou junto com o BPO?

## Fontes

- Receita Federal, manual *Receita Saúde v2.1* (out/2025): https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/orientacao-tributaria/receita-saude-2.1.pdf
- Receita Federal, perguntas e respostas Receita Saúde: https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/auditoria-fiscal/conformidade/perguntas-e-respostas-receita-saude
- Manual v1.0 (dez/2024), publicado pelo CFM: https://portal.cfm.org.br/wp-content/uploads/2025/01/Manual_receita_saude.pdf
- Agência Gov (dez/2024): https://agenciagov.ebc.com.br/noticias/202412/emissao-de-recibo-digital-por-profissionais-da-saude-passa-a-ser-obrigatorio-a-partir-de-1o-de-janeiro
- CFO, dúvidas frequentes: https://website.cfo.org.br/receita-saude-respostas-as-duvidas-mais-frequentes/
- Emissão em lote (nov/2025): https://bluemaster.com.br/boletim/disponibilizada-nova-funcionalidade-para-emissao-em-lote-de-recibos-do-receita-saude-1096
- Agilize, recibo de psicólogo: https://agilize.com.br/artigos/recibo-psicologo-receita-saude
- Clinvo, recibo de fisioterapia: https://clinvo.com.br/blog/recibo-fisioterapia-receita-saude-como-emitir/
- PASA, reembolso exige recibo: https://www.saudepasa.com.br/noticias/servicos/nova-regra-para-reembolso-recibo-digital-da-rfb-sera-obrigatorio-a-partir-de-fevereiro/
- Rebots, "API Receita Saúde" (afirmação do fornecedor, não verificada): https://rebots.com.br/api-receita-saude
