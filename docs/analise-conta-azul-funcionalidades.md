# Funcionalidades do Conta Azul → o que trazer para o Conecta (28/11/2026)

Complementa `docs/analise-nibo-funcionalidades.md`. Objetivo: ter na mesa, para decidir com o consultor, **tudo o que os dois sistemas fazem** e o que faz sentido para clínicas e para o BPO da Sinergia.

Fonte: 16 páginas públicas do contaazul.com (sem acesso ao produto logado, à central de ajuda nem à documentação da API). O que não foi confirmado está marcado com ⚠️. O site tem números que se contradizem (bancos, tarifas, preços); eles estão marcados como **conflito**.

---

## 1. Resumo

- O Conta Azul é um **ERP de pequena empresa**: financeiro + vendas + nota fiscal + estoque + compras, com **conta PJ própria** (boleto, Pix, cartão por link) e **IA incluída**.
- **Modelo de preço diferente do Nibo**: não vende módulo. "Todos os planos têm o sistema completo"; o preço muda pela **faixa de faturamento** e pelo **número de usuários**.
- É mais forte que o Nibo em **DRE (competência e caixa)**, **cobrança integrada**, **nota fiscal** (NF-e, NFS-e, NFC-e) e **IA que aprende regras**.
- Muita coisa é de **comércio** (estoque com variação, PDV, ICMS, e-commerce) e **não interessa a clínicas**.
- Também não encontrei nada específico de saúde (repasse, convênio, glosa, agenda). Há um "segmento Saúde" no menu ⚠️ (página não lida) e uma integração com SOC (saúde ocupacional).

## 2. Preços de referência

| Plano | Faturamento anual | Usuários | Anual (por mês) | Trimestral (por mês) |
|---|---|---|---|---|
| Essencial (MEI) | até R$ 81 mil | 1 | R$ 179,90 | R$ 269,90 |
| Controle (ME) | R$ 81–360 mil | 2 | R$ 349,90 | R$ 499,90 |
| Avançado (EPP) | R$ 360 mil–1,5 mi | 5 | R$ 439,90 | R$ 579,90 |
| Performance | acima de R$ 1,5 mi | 15 | R$ 799,90 | R$ 929,90 |

Para contador/BPO (programa **Conta Azul Mais**, gratuito para o escritório): licença **Pro** (dono e escritório operam) a partir de R$ 199,90/mês e **Pro BPO** (só o escritório opera; o dono aprova pelo app) a partir de R$ 129,90/mês, no nível Bronze. Mínimo de licenças: conflito (1 ou 3).

Comparação rápida por cliente/mês: **Nibo** R$ 166–479 · **Conta Azul** R$ 130–930 · **Conecta** (CRM hoje) R$ 497 / R$ 797.

## 3. Mapa completo

Legenda: ✅ já temos algo reaproveitável · 🔨 construir · 🤝 contratar parceiro · ⏸️ não agora · ❌ não serve para clínica
Coluna "Nibo": tem (✔), não confirmado (⚠️) ou não tem (—).

### 3.1 Financeiro

| Funcionalidade do Conta Azul | Nibo | Conecta | Fase |
|---|---|---|---|
| Contas a pagar e a receber com baixa | ✔ | 🔨 | BPO |
| Alertas diários/semanais de contas a pagar | ⚠️ | ✅ WhatsApp/e-mail + cron · 🔨 regra | BPO |
| **A receber criado sozinho a partir da venda** | — | ✅ **atendimento concluído vira a receber** (agenda/ERP) | Gerencial/BPO |
| Juros, multa, taxas e desconto na baixa | ✔ | 🔨 | BPO |
| Contratos recorrentes com cobrança e nota automáticas e reajuste | recorrência ✔ | 🔨 recorrência + **planos/pacotes de tratamento** | BPO |
| Centro de custo e categorias sincronizáveis com o contador | ✔ | 🔨 | Gerencial |
| Comprovantes disponíveis para o contador | ⚠️ | 🔨 acesso só-leitura do contador + exportação | BPO |
| **Dono aprova pagamentos e vendas pelo app** | ⚠️ | 🔨 aprovação no PWA e pelo WhatsApp | BPO |
| Multiempresa para o dono | ⚠️ | 🔨 escritório → entidades (já no plano) | Gerencial |

### 3.2 Bancos e conciliação

| Funcionalidade do Conta Azul | Nibo | Conecta | Fase |
|---|---|---|---|
| Conciliação automática com baixa de pagar/receber | ✔ | 🔨 casamento em passes + prova = 0 | BPO |
| Open Finance incluído (12 ou 13 bancos: conflito) | Bradesco/Santander | 🤝 agregador (avaliar) | Depois |
| OFX e PDF com IA ⚠️ (linhas da tabela, sem marcação clara) | PDF ✔ | 🔨 OFX/CSV primeiro, PDF com IA depois | BPO |
| **Regras que automatizam a conciliação**, conciliação em lote | ⚠️ | 🔨 `fin_regras_categorizacao` | BPO |
| **Conta PJ gratuita integrada** | — | ⏸️ exige ser instituição de pagamento ou parceiro; **fora do escopo** | — |
| Contas de meio de recebimento (maquininha, Mercado Pago, PagSeguro, PayPal) com taxas | ⚠️ | 🔨 conta tipo ADQUIRENTE + MDR (já no plano) | Avançado |
| Saldo em tempo real, fluxo diário e mensal | ✔ | 🔨 | Gerencial |

### 3.3 Cobrança

| Funcionalidade do Conta Azul | Nibo | Conecta | Fase |
|---|---|---|---|
| Boleto registrado sem remessa/retorno | ✔ (parceiro) | 🤝 banco/PSP | Depois |
| Pix cobrança com juros e multa; **protesto em cartório** | Pix ✔ | 🤝 PSP; protesto ⏸️ | Depois |
| **Link de pagamento com cartão em até 12×** | "em breve" | 🤝 PSP — útil para **orçamento de procedimento** | Depois |
| Envio por **e-mail, WhatsApp e SMS** com lembretes; ver quem recebeu e leu | WhatsApp + e-mail | ✅ **já temos os três canais** + status de leitura | BPO |
| Baixa automática no pagamento | ✔ | 🔨 webhook do PSP | Depois |
| Nota enviada com a cobrança ou só após o pagamento | — | 🤝 integrador de NFS-e | Depois |
| Tarifas: R$ 0,77 (marketing) ou R$ 3,50 boleto / R$ 2,49 Pix / cartão 3,99% + R$ 0,29 (FAQ antiga): **conflito** | — | referência para negociar com o PSP | — |

### 3.4 Vendas e CRM

| Funcionalidade do Conta Azul | Conecta | Fase |
|---|---|---|
| Orçamento digital → venda com um clique | ✅ **fila de orçamentos 3/7/15 dias** + relatório de conversão já existem · 🔨 orçamento aprovado vira título a receber | BPO |
| Pedidos de venda por status | ✅ funil do CRM | — |
| Histórico de compras por cliente | ✅ linha do tempo do paciente · 🔨 aba "financeiro" na ficha | Gerencial |
| Tabela/lista de preços | ✅ preços por procedimento (`clinic_procedures`, Preços) | — |
| Alerta para atualizar preço quando o custo muda | 🔨 **precificação de procedimento** (custo real × preço × convênio) | Avançado |
| Comissão de vendedor ⚠️ | ✅ comissão de afiliado/marcador existe · 🔨 = **repasse médico** | Avançado |
| PDV com NFC-e | ❌ | — |

### 3.5 Fiscal

| Funcionalidade do Conta Azul | Conecta | Fase |
|---|---|---|
| NFS-e (1.861 municípios), notas ilimitadas, certificado A1 | 🤝 integrador de NFS-e | Depois |
| NF-e e NFC-e (produto), ICMS, ICMS-ST, DIFAL, IPI, CFOP, NCM | ❌ clínica emite serviço (NFS-e) | — |
| Emissão automática ao receber o pagamento | 🤝 + regra nossa | Depois |
| **Importação automática de notas de compra** (SEFAZ e prefeitura) | 🤝 integrador → vira título a pagar | Depois |
| Envio automático das notas ao contador | 🔨 exportação/acesso do contador | BPO |
| Reforma tributária (IBS/CBS) | 🤝 fica com o integrador e o contador | — |

### 3.6 Estoque e compras

| Funcionalidade do Conta Azul | Conecta | Fase |
|---|---|---|
| Estoque por compra/venda, mínimo, variações, kits, código de barras, etiquetas | ❌ para clínica com ERP (o estoque fica no ERP: Santa Clara já expõe `/api/estoque/resumo`) · ⏸️ para profissional/clínica sem ERP | — |
| Pedido de compra com previsão de despesa | 🔨 título a pagar previsto | BPO |
| Fornecedor e a pagar a partir da nota de compra | 🤝 + 🔨 | Depois |
| Consumo de material por procedimento | 🔨 entra no **custo do procedimento** | Avançado |

### 3.7 Relatórios

| Funcionalidade do Conta Azul | Nibo | Conecta | Fase |
|---|---|---|---|
| **DRE por competência e por caixa, personalizável** | — | 🔨 DRE gerencial de clínica (as duas visões) | Gerencial |
| Fluxo de caixa diário e mensal; "previsões de caixa" | ✔ | 🔨 + **13 semanas com agenda** | Gerencial |
| **Agendador de relatórios** (envio automático) | — | ✅ e-mail/WhatsApp · 🔨 relatório do mês ao gestor | Gerencial |
| 53 relatórios (vendas, compras, estoque, inadimplência, recebimentos) | — | 🔨 só os de clínica; inadimplência = aging | Gerencial |
| Filtros por período, categoria, centro de custo, responsável; exportação | ✔ | ✅ padrão do Relatório + CSV | Gerencial |
| Visão individual e consolidada por cliente (contador) | ✔ | 🔨 carteira `/bpo` | Gerencial |

### 3.8 App

| Funcionalidade do Conta Azul | Conecta | Fase |
|---|---|---|
| App "de Bolso": saldo, entradas/saídas, alertas | 🔨 PWA Sinergia do gestor | BPO |
| Orçamento, venda e aprovação pelo app | 🔨 aprovação de pagamento e de repasse | BPO |
| Cobrança pelo app | 🤝 depois do PSP | Depois |
| Pagamentos pela conta PJ com aprovação | ⏸️ sem conta PJ | — |

### 3.9 Contador e BPO

| Funcionalidade do Conta Azul | Conecta | Fase |
|---|---|---|
| Carteira com pendências e categorias críticas | 🔨 `/bpo` com semáforo | Gerencial |
| **Licença "Pro BPO"**: só o escritório opera, o dono aprova | 🔨 = papéis `fin.*` (gestor só vê e aprova) | Gerencial |
| **Exportação contábil para mais de 25 sistemas** (Domínio, SCI, Alterdata automáticos) | 🔨 começar por CSV; layout Domínio depois (pedir ao contador dos clientes) | BPO |
| Automação de lançamentos contábeis do escritório | ⏸️ é contabilidade, não BPO gerencial | — |

### 3.10 Integrações

| Funcionalidade do Conta Azul | Conecta | Fase |
|---|---|---|
| 100+ integrações, marketplace, e-commerce | ❌ e-commerce · ⏸️ marketplace | — |
| API REST com OpenAPI, OAuth 2.0 + PKCE, conta de teste com dados fictícios, rate limit | ⏸️ API pública v1 já desenhada e adiada · ✅ **clínica de teste** já existe | Depois |
| **Importar do Conta Azul** (clientes que vierem dele) | 🔨 importador, como o do Nibo (via API dele) | BPO |

### 3.11 IA

| Funcionalidade do Conta Azul | Conecta | Fase |
|---|---|---|
| **Lê documento, foto, texto ou áudio do WhatsApp/e-mail e cria o lançamento** (para revisão ou direto) | ✅ recebimento de mídia + transcrição de áudio (`ai-transcription.ts`) + `invoice-extraction.ts` · 🔨 caixa de entrada financeira | BPO |
| Planilha em lote vira cadastro | 🔨 importador de planilha | BPO |
| **Mais de 30 alertas** (cobrança que pode falhar, contrato sem renovação, nota rejeitada, lançamento duplicado…) | ✅ alertas de saúde do sistema (`health-alerts.ts`) · 🔨 catálogo de alertas financeiros | BPO |
| **Ensinar uma regra** ("Uber" → Transporte) e a IA aplica e concilia sozinha | 🔨 regras aprendidas + auto-aplicar com confiança alta | BPO |
| Chat de perguntas livres | não citado · 🔨 **Copiloto do BPO** (diferencial) | Avançado |

## 4. O que fazer com isso

### 4.1 O que o Conta Azul ensina e o Nibo não

1. **Preço por porte, não por módulo.** Combina com o "valor fixo mensal" da Sinergia: vale levar para a conversa de preço do Conecta + BPO.
2. **"Pro BPO": o escritório opera e o dono só aprova.** É exatamente o papel do gestor no nosso plano.
3. **DRE em competência e caixa** como relatório central.
4. **IA que aprende com a correção** e passa a conciliar sozinha.
5. **Agendador de relatórios**: o gestor recebe o mês pronto, sem entrar no sistema.
6. **Exportação contábil em layout de sistema** (Domínio, Alterdata): reduz atrito com o contador do cliente.

### 4.2 O que não vamos copiar

Conta PJ própria, PDV, NF-e de produto/ICMS, estoque de varejo, e-commerce, protesto em cartório (por ora). Boleto, Pix, cartão e NFS-e: **parceiro**, nunca construção própria.

### 4.3 O que nenhum dos dois tem (nosso diferencial)

Repasse médico, convênios e glosas, atendimento concluído virando receita, 13 semanas com agenda, custo e margem por procedimento, financeiro dentro do mesmo sistema do WhatsApp, agenda e CRM da clínica.

## 5. Para decidir com o consultor ("o que lançar no Conecta")

Marque por linha: **Conecta lança** · **Conecta só lê** (Nibo/ERP) · **Fora**.

| Bloco | Pergunta |
|---|---|
| Contas a pagar/receber | Os clientes da Sinergia passam a ser operados no Conecta? Todos ou só os novos? |
| Conciliação | OFX manual basta no começo, ou Open Finance é obrigatório? |
| Cobrança | Quantos clientes emitem boleto/Pix pelo Nibo hoje? Precisam de link de cartão? |
| Nota fiscal | Quem emite NFS-e pelo Nibo? Em quais municípios? |
| Aprovação | O dono deve aprovar todo pagamento, ou só acima de um valor? |
| App | O app com a marca Sinergia é prioridade? Para o gestor, o profissional ou os dois? |
| Contador | Quais sistemas contábeis os contadores dos clientes usam (Domínio, Alterdata, SCI…)? |
| Relatórios | Quais relatórios a Sinergia entrega todo mês hoje (pedir os modelos das planilhas)? |
| Saúde | Quais clientes têm repasse médico e convênio? Qual a regra de repasse de cada um? |
| Preço | Cobrar Conecta + BPO por faixa de faturamento (como o Conta Azul) ou valor fixo? |

## Fontes

https://contaazul.com/ · /planos/ · /funcionalidades/gestao-financeira/ · /funcionalidades/conciliacao-bancaria/ · /funcionalidades/cobranca-automatica/ · /funcionalidades/controle-de-vendas/ · /funcionalidades/emissao-de-nota-fiscal/ · /funcionalidades/controle-de-estoque/ · /funcionalidades/relatorios/ · /funcionalidades/conta-azul-ia/ · /funcionalidades/contratos-recorrentes/ · /funcionalidades/gestao-de-compras-e-fornecedores/ · /funcionalidades/ca-bolso/ · /funcionalidades/conexao-contador/ · /contadores/ · /integracoes/ · /conecta/

Não lidas: central de ajuda, página da Conta PJ, segmento Saúde/Clínica, documentação da API.
