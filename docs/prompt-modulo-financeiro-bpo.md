# Prompt — Ecossistema de BPO Financeiro para Saúde (Sinergia)

> Cole este prompt numa sessão nova (Claude Code, no repositório MARCACAO) para começar o desenho e a implementação.

---

## Contexto

Sou dono de uma empresa de TI (TIVDC) que já opera uma plataforma de atendimento e gestão para clínicas (este repositório: Next.js + Prisma + Supabase/Postgres, multi-clínica, já com Chat/WhatsApp, Agenda, CRM, Disparos, Relatório com abas de BI — Faturamento, Financeiro e Estoque — alimentadas pelas pontes Firebird instaladas nos PCs das clínicas).

Agora vou trabalhar em parceria com um **consultor financeiro**. Ele faz consultoria e **BPO Financeiro** (terceirização da rotina financeira) para **clínicas** e **profissionais de saúde autônomos** (médicos, dentistas, fisioterapeutas, psicólogos etc.). Eu entro com a tecnologia: as ferramentas que ele e a equipe dele usam para operar a carteira de clientes, e os apps que os clientes usam.

## Objetivo

Criar um **ecossistema de gestão financeira para saúde** com três públicos:

1. **Escritório de BPO (consultor + analistas)** — opera vários clientes ao mesmo tempo: lança, concilia, fecha o mês, gera relatórios e faz a consultoria.
2. **Gestor da clínica** — acompanha caixa, resultados e aprova pagamentos; envia documentos.
3. **Profissional de saúde (pessoa física ou PJ individual)** — vê quanto produziu, quanto vai receber (repasse), separa gastos pessoais x profissionais, e cuida de impostos (carnê-leão / Simples / lucro presumido).

O módulo deve nascer **dentro desta plataforma** (reaproveitando login, clínicas, pacientes, agenda, pontes e BI), mas desenhado para também atender clientes que **não usam** nosso CRM.

## A parceria: Sinergia

- A marca do consultor é **Sinergia**. O ecossistema sai com essa marca (a TIVDC fica como tecnologia por trás).
- Ele **continua com as consultorias dele**; o que é novo é a **parceria para prospectar e atender clientes juntos**. O primeiro cliente em conjunto começa agora (25/11/2026).
- O BPO é cobrado com **valor fixo mensal** por cliente.

### Ferramentas que ele já usa hoje

1. **Nibo** — sistema principal de BPO/gestão financeira (lançamentos, conciliação, contas a pagar e receber, relatórios).
2. **Planilhas próprias**, uma para cada ciclo da gestão (diagnóstico, rotina, fechamento, análise etc. — mapear quais são).
3. **Um SaaS que outro consultor está construindo**, ao qual ele tem acesso.

### Princípio: metodologia primeiro, sistema depois

A ideia **não** é substituir o Nibo no primeiro momento. É construir a **Metodologia Sinergia** em cima dessas ferramentas: o passo a passo de cada ciclo (entrada do cliente → diagnóstico → rotina → fechamento → consultoria), quem faz o quê, em qual ferramenta, com qual prazo e qual entregável.

O que a TIVDC constrói é a **camada que falta** entre as ferramentas:
- puxar os dados do Nibo (API) e das planilhas para um só lugar;
- os indicadores e relatórios específicos de saúde que o Nibo não entrega (repasse, convênio, glosa, margem por procedimento, ligação com agenda/pontes);
- o painel da carteira, as tarefas da rotina e os apps do gestor e do profissional.

Só quando a metodologia estiver rodando e repetível é que avaliamos trazer para dentro o que hoje fica no Nibo.

## Módulos (escopo completo — priorizar depois)

### Núcleo financeiro
- **Contas a pagar e a receber** — com vencimento, categoria, centro de custo, anexo do comprovante/boleto/nota, recorrência e status (previsto, aprovado, pago, conciliado).
- **Plano de contas** padrão para saúde (modelo pronto para clínica e para profissional PF), editável por cliente.
- **Centros de custo** — por unidade, especialidade, médico, sala ou procedimento.
- **Fluxo de caixa** realizado e projetado (diário, semanal, mensal).
- **DRE gerencial** mensal e acumulada, com comparação orçado x realizado.
- **Conciliação bancária** — importação de extrato OFX/CSV no MVP; Open Finance depois. Sugestão automática de casamento lançamento ↔ extrato.
- **Fechamento do mês** — checklist por cliente, travamento do período, relatório final enviado ao gestor.

### Específico de saúde
- **Faturamento de convênios** — guias enviadas, recebidas, **glosas** (valor, motivo, recurso) e prazo médio de recebimento por convênio.
- **Repasse médico / split** — regra por profissional (percentual, valor fixo por procedimento, produção), extrato de repasse e aprovação.
- **Recebíveis de cartão** — taxas e antecipações por maquininha/adquirente.
- **Precificação de procedimentos** — custo real (tempo de sala, insumo, repasse, imposto, taxa de cartão) x preço cobrado x valor pago pelo convênio.
- **Integração com a agenda e as pontes** — produção realizada vira receita prevista automaticamente.

### Fiscal e documentos
- **Emissão de NFS-e** (via integrador de notas) a partir do atendimento ou do recebimento.
- **Profissional PF** — livro-caixa, carnê-leão mensal, despesas dedutíveis, informe para o IR.
- **Caixa de entrada de documentos** — cliente fotografa nota/boleto pelo app ou manda pelo WhatsApp; a IA lê (valor, vencimento, fornecedor, CNPJ) e cria o lançamento como rascunho para o analista revisar.

### Consultoria e indicadores
- **Painel do consultor** — carteira de clientes com semáforo (atrasos, caixa negativo projetado, conciliação pendente, fechamento do mês).
- **Indicadores** — ticket médio, margem por procedimento, custo por consulta, ponto de equilíbrio, inadimplência, prazo médio de recebimento, peso da folha, faturamento por médico/convênio.
- **Orçamento anual e metas** por cliente.
- **Relatório mensal de consultoria** gerado com resumo por IA e comentários do consultor.

### Operação do BPO
- **Multiempresa** — o escritório de BPO enxerga vários clientes; o cliente vê só os seus dados.
- **Papéis** — sócio/consultor, analista, gestor do cliente, profissional, contador externo (só leitura e exportação).
- **Tarefas e prazos** por cliente (rotina diária/semanal/mensal), com responsável.
- **Fluxo de aprovação de pagamentos** — analista agenda, gestor aprova pelo app.
- **Exportação para a contabilidade** (planilha e layouts comuns de importação).
- **Cobrança do próprio BPO** — planos e mensalidade de cada cliente do escritório.

## Apps

- **App do gestor** (celular): caixa de hoje, contas a vencer, aprovar pagamentos, enviar documento, DRE do mês, conversa com o analista.
- **App do profissional** (celular): minha produção, meu repasse, minhas notas, meu carnê-leão, enviar despesa (foto), separar pessoal x profissional.
- **Web do escritório de BPO**: a operação completa, a carteira de clientes e a consultoria.

Preferência: começar como **PWA** (instalável, mesmo código Next.js) e só ir para app nativo (React Native/Expo) se a loja ou recursos nativos exigirem.

## Restrições e requisitos

- **Mesma stack e mesmo repositório** (Next.js, Prisma, Postgres/Supabase, Vercel), seguindo os padrões que já existem: isolamento por tenant, RLS, segredos cifrados, log de acesso LGPD, portão de PII antes de chamar IA, CI com tsc + vitest.
- **Novo nível de tenant**: hoje o tenant é a clínica. Precisa existir o **escritório de BPO** acima dela, e o **profissional PF** como cliente que não é clínica. Definir isso antes de qualquer tela.
- **Dinheiro sempre em centavos (inteiro)**, nunca float. Datas de competência x datas de caixa separadas.
- **Trilha de auditoria** de todo lançamento (quem criou, alterou, aprovou, conciliou).
- **Período fechado é imutável** — ajustes entram como lançamento de estorno no mês aberto.
- **Desenvolvimento test-first (TDD)** nas regras de cálculo: repasse, DRE, conciliação, impostos, precificação.
- **Sem conselho de investimento**: o sistema organiza e mostra os números; a recomendação é do consultor.

## Fases sugeridas

0. **Metodologia com o primeiro cliente** — acompanhar o atendimento real, mapear cada ciclo (o que se faz no Nibo, em cada planilha e no SaaS), documentar o passo a passo e os entregáveis, levantar a API do Nibo e definir o que automatizar primeiro.
1. **Fundação** — modelo de tenant (escritório → clientes), papéis, plano de contas padrão, contas a pagar/receber, centros de custo.
2. **Caixa e conciliação** — importação OFX/CSV, conciliação assistida, fluxo de caixa, fechamento do mês.
3. **DRE e painel do consultor** — DRE gerencial, carteira com semáforo, relatório mensal.
4. **Saúde** — repasse médico, convênios e glosas, recebíveis de cartão, ligação com agenda e pontes.
5. **Apps (PWA)** — gestor e profissional; caixa de entrada de documentos com leitura por IA.
6. **Fiscal** — NFS-e, carnê-leão e livro-caixa do profissional PF.
7. **Integrações** — Open Finance, boleto/Pix de cobrança, exportação contábil, cobrança do próprio BPO.

## O que quero de você primeiro

1. Me ajudar a montar o **roteiro do primeiro atendimento** em conjunto: o que observar, o que perguntar e o que anotar para virar metodologia.
2. Levantar o que a **API do Nibo** permite (lançamentos, contas, conciliação, categorias, centros de custo) e como autenticar por cliente.
3. Ler o código atual (modelos Prisma de Clinic, User, papéis, BI de Faturamento/Financeiro e pontes) e me dizer o que dá para reaproveitar.
4. Propor o **modelo de dados** da Fase 1 (com o novo nível de tenant e a ligação com o Nibo) e o plano de migração sem quebrar as clínicas atuais.
5. Só então começar a Fase 1, test-first.

## Já respondido

- Sistema atual: **Nibo** + planilhas por ciclo + SaaS de outro consultor.
- Cobrança do BPO: **valor fixo mensal**.
- Marca: **Sinergia** (do consultor).
- Modelo: ele mantém as consultorias dele; BPO e prospecção de novos clientes são feitos em parceria.

## Perguntas em aberto (para o consultor)

- Quantos clientes ele atende hoje e quantos espera em 12 meses? Quantas pessoas na equipe dele?
- Quais são as planilhas, uma a uma, e em que ciclo cada uma entra? Pode compartilhar os modelos?
- O que o SaaS do outro consultor faz, quem é o dono dos dados e se tem API ou exportação. Há risco de conflito ou sobreposição com o que vamos construir?
- O que ele mais sente falta no Nibo hoje?
- Qual é o plano de contas e o modelo de DRE que ele usa com os clientes?
- Quais bancos e adquirentes são mais comuns na carteira?
- Os clientes são mais clínicas (PJ) ou profissionais PF? Quais regimes tributários?
- Ele quer que o cliente lance coisas ou só envie documentos?
- Quanto é o valor fixo mensal e o que está incluído em cada plano? Como dividimos a receita dos clientes que prospectarmos juntos?
- Quem é o primeiro cliente (clínica ou profissional, porte, o que contratou)?
