# Funcionalidades do Nibo → o que trazer para o Conecta (28/11/2026)

Objetivo (decisão de 28/11): **deixar de usar o Nibo** e fazer o BPO da Sinergia inteiro no Conecta. Este documento lista o que o Nibo oferece, o que já temos, o que construir e o que contratar de terceiros.

Fonte: páginas públicas do Nibo e da central de ajuda (sem acesso ao produto logado). O que não foi confirmado está marcado com ⚠️. URLs no fim.

---

## 1. Resumo

- O Nibo é forte em **rotina financeira genérica** (pagar, receber, conciliar, cobrar, emitir nota) e na **operação de escritório** (multi-cliente, tarefas, portal e app do cliente).
- Não encontrei **DRE** nas páginas lidas, nem nada **específico de saúde** (repasse médico, convênio, glosa, TISS, ligação com agenda). Lá a clínica aparece só como mais um segmento.
- Partes que **dependem de licença bancária ou fiscal** (boleto, Pix, NFS-e em 2 mil municípios, Open Finance) o Nibo faz com parceiros (PJBank, Banco Inter). **Nós também devemos contratar** essas partes, e não construí-las.
- O Conecta já tem peças que o Nibo vende como diferencial: **WhatsApp oficial**, SMS/e-mail, IA com proteção de dados, leitura de documentos, tarefas, app/PWA e dados da agenda e do ERP das clínicas.

Preço de referência do Nibo por empresa: Light R$ 208, Plus R$ 312, Premium R$ 479/mês (no anual, R$ 166 / 250 / 383). Para escritório não há preço público.

## 2. Mapa completo

Legenda: ✅ já temos algo reaproveitável · 🔨 construir · 🤝 contratar parceiro · ⏸️ não agora

### 2.1 Gestão financeira

| Funcionalidade do Nibo | Plano Nibo | Conecta | Fase |
|---|---|---|---|
| Contas a pagar e a receber | Light | 🔨 títulos + parcelas + baixas (plano mestre §3.3) | BPO |
| Agendamentos recorrentes | Light | 🔨 `fin_recorrencias` | BPO |
| Rateio por várias categorias e centros de custo; juros, multa e desconto na baixa | Plus | 🔨 `fin_titulo_rateios` + colunas da baixa | BPO |
| Regime de competência | Plus | 🔨 nativo (competência no título, caixa no movimento) | Gerencial |
| Centros de custo | Plus | 🔨 + salas (`clinic_rooms` ✅) e profissionais | Gerencial |
| Permissão por usuário | Plus | ✅ padrão de `clinic-permissions.ts` → matriz `fin.*` | Gerencial |
| Controle de cartão de crédito (fatura da empresa) | ⚠️ | 🔨 conta tipo cartão, fatura como título | BPO |
| Emissão de recibos | ⚠️ | 🔨 PDF simples | BPO |
| Histórico de atividades | ⚠️ | ✅ padrão de auditoria → `fin_auditoria` append-only | Gerencial |
| Pagamento reembolsável | Premium | 🔨 despesa paga pelo sócio/funcionário a reembolsar | BPO |
| Fluxo de aprovação de pagamento | ⚠️ não confirmado | 🔨 **diferencial**: gestor aprova no app/WhatsApp | BPO |
| Parcelamento de lançamentos | ⚠️ | 🔨 parcelas, com MDR para cartão | BPO |

### 2.2 Bancos e conciliação

| Funcionalidade do Nibo | Conecta | Fase |
|---|---|---|
| Conciliação "inteligente" (sugere o lançamento de cada linha do extrato) | 🔨 casamento em passes + prova = 0 (plano §4.4) | BPO |
| Importação de extrato em **PDF com IA** | 🔨 via `ai-gateway`; OFX/CSV primeiro | BPO |
| Importação automática de extrato (Open Finance; confirmado só Bradesco e Santander PJ) | 🤝 agregador Open Finance (avaliar) | Depois |
| Pagamento por CNAB (Itaú, Inter) | ⏸️ arquivo de remessa; o banco executa | Depois |
| Saldos no painel | 🔨 saldo calculado (nunca gravado) | Gerencial |
| OFX/CSV | ⚠️ não citado pelo Nibo · 🔨 **nós fazemos** (todo banco exporta OFX) | BPO |

### 2.3 Cobrança

| Funcionalidade do Nibo | Conecta | Fase |
|---|---|---|
| Boleto e Pix (via PJBank/Inter, R$ 1,50 por boleto e R$ 0,95 por Pix acima do pacote) | 🤝 banco ou PSP com API (avaliar Inter, Asaas, Efí etc.) | Depois |
| Baixa automática quando o pagamento entra | 🔨 webhook do PSP → baixa | Depois |
| **Régua de cobrança por WhatsApp e e-mail** (até 10 lembretes) | ✅ **já temos** WhatsApp oficial + Resend + SMS Comtele + automações/régua de Disparos; 🔨 adaptar para parcela vencida | BPO |
| Juros, multa e desconto por cliente; perfis de cobrança | 🔨 | BPO |
| Histórico da cobrança (envio, abertura, acesso) | ✅ status de mensagem já existe no Chat | BPO |
| Central de cobranças, emissão em lote | 🔨 tela de aging com ação em lote | BPO |

### 2.4 Fiscal

| Funcionalidade do Nibo | Conecta | Fase |
|---|---|---|
| Emissão de NFS-e em 2 mil municípios (com reforma tributária) | 🤝 **integrador de NFS-e** (avaliar); nunca construir por prefeitura | Depois |
| Consulta de notas emitidas contra o CNPJ | 🤝 mesmo integrador | Depois |
| Recálculo de DAS/DARF, Radar e-CAC | ⏸️ é papel do contador | — |
| Exportação para a contabilidade | 🔨 CSV/planilha por período | BPO |

### 2.5 Relatórios

| Funcionalidade do Nibo | Conecta | Fase |
|---|---|---|
| Relatórios gerenciais e dashboards personalizados | ✅ Relatório com abas de BI (Faturamento, Financeiro, Estoque) → 🔨 aba DRE/Caixa/Indicadores | Gerencial |
| Fluxo de caixa com projeção | 🔨 + **13 semanas com agenda futura** (diferencial) | Gerencial |
| Planejamento orçamentário anual (orçado × realizado) | Premium · 🔨 `fin_orcamentos` + variação | Gerencial |
| Análise vertical e horizontal | Plus · 🔨 na DRE (% da receita e mês a mês) | Gerencial |
| **DRE** | ⚠️ não encontrada no Nibo · 🔨 **diferencial** | Gerencial |
| Indicadores de saúde (margem por procedimento/médico/convênio, glosa, DSO por convênio, custo por consulta) | ❌ não tem · 🔨 **diferencial** | Gerencial/Avançado |

### 2.6 Portal e app do cliente

| Funcionalidade do Nibo | Conecta | Fase |
|---|---|---|
| Portal do Cliente + app com marca do escritório ("Meu App", white label) | 🔨 PWA com marca **Sinergia** | BPO |
| Caixa de entrada de documentos (app, e-mail, Dropbox, Drive, OneDrive) | ✅ recebimento de mídia pelo WhatsApp já existe · 🔨 caixa de entrada financeira (WhatsApp + upload + e-mail) | BPO |
| Ler boleto/nota e preencher o lançamento | ✅ `invoice-extraction.ts`, `documents/*` · 🔨 linha digitável por algoritmo + XML de NFS-e | BPO |
| Status de entrega de cada documento | 🔨 | BPO |
| Formulários para coletar informação do cliente | ✅ motor de formulários da ficha prévia (`FormTemplate`) | BPO |

### 2.7 Operação do escritório (BPO)

| Funcionalidade do Nibo | Conecta | Fase |
|---|---|---|
| Painel centralizado com status de cada cliente; multi-cliente | 🔨 `/bpo` carteira com semáforo | Gerencial (leitura) → BPO |
| Tarefas padronizadas e recorrentes, prazos | ✅ `/clinic/tarefas` e `ClinicProcess` · 🔨 checklist de fechamento mensal | BPO |
| Dashboards de produtividade por colaborador | ✅ "desempenho da equipe" do Chat · 🔨 versão BPO | Depois |
| Atendimento ao cliente pelo portal e WhatsApp oficial (histórico, horário) | ✅ **já é o nosso produto** (Chat + WhatsApp oficial) | BPO |
| Robôs de leitura que identificam cliente e tipo de documento | 🔨 classificação na caixa de entrada | BPO |
| Correção de texto e tom nas mensagens | ✅ IA do Chat | — |
| Importador de dados de outros sistemas e planilhas | 🔨 **importador do Nibo** (API) + planilhas da Sinergia | Leitura Nibo |

### 2.8 Integrações e IA

| Funcionalidade do Nibo | Conecta | Fase |
|---|---|---|
| API pública (Premium) | ⏸️ API pública v1 já desenhada e adiada (só com integração real) | Depois |
| MCP (consultar contas, saldos, cobranças pela IA) | 🔨 Copiloto do BPO (tool calling, propor e confirmar) | Avançado |
| Sugestão de categoria ao lançar | 🔨 categorizador (regras aprendidas + LLM) | BPO |

## 3. O que só o Conecta terá

1. **Repasse médico** automático, com estorno por glosa.
2. **Convênios**: guias, glosas, recurso, prazo médio por convênio.
3. **Ligação com a agenda e o ERP**: atendimento concluído vira receita, sem digitar.
4. **13 semanas** usando a agenda futura × comparecimento.
5. **DRE de clínica** com margem de contribuição (repasse, materiais, MDR).
6. **Cobrança e alertas pelo WhatsApp oficial** que a clínica já usa com os pacientes.
7. **Um sistema só** para a clínica: atendimento, agenda, marketing e financeiro.

## 4. Plano de migração Nibo → Conecta (cliente a cliente)

1. **Ler** o cliente pelo Nibo (fase de leitura): cadastros, categorias, centros, títulos abertos e histórico de 12 meses.
2. **Mapear** categorias do Nibo → plano de contas Sinergia (uma vez por cliente).
3. **Rodar em paralelo** um mês: Nibo continua oficial, o Conecta mostra a mesma DRE e o mesmo caixa. Diferença tem que ser zero.
4. **Corte por data**: a partir do dia D, o cliente passa a `fonte_lancamentos = CONECTA`. Os títulos abertos são importados como títulos do Conecta; o histórico fica só leitura.
5. Cancelar a licença do Nibo daquele cliente.

Pré-requisitos antes do primeiro corte: contas a pagar e a receber, baixa, conciliação OFX, fechamento mensal, caixa de entrada e régua de cobrança prontos no Conecta (fase BPO). Boleto, Pix e NFS-e precisam de parceiro **antes** do corte de clientes que emitem por dentro do Nibo. Confirmar com o consultor quais emitem.

## 5. Parceiros a avaliar (não decidido)

| Necessidade | Opções a pesquisar | Observação |
|---|---|---|
| Boleto + Pix com baixa automática | bancos com API (Inter, Itaú, Sicoob) ou PSPs | custo por liquidação; conta do próprio cliente |
| NFS-e multi-município | integradores de NFS-e | reforma tributária (NFS-e nacional) muda o cenário em 2026–2027 |
| Extrato automático (Open Finance) | agregadores Open Finance | só leitura; OFX resolve no começo |

## Fontes

- https://www.nibo.com.br/ · https://www.nibo.com.br/empresa · https://www.nibo.com.br/empresa/planos-e-precos
- https://www.nibo.com.br/sistema-de-cobrancas · https://www.nibo.com.br/empresa/funcionalidades/conciliacao-inteligente
- https://www.nibo.com.br/empresa/funcionalidades/relatorios-gerenciais · https://www.nibo.com.br/bpo-financeiro/
- https://www.nibo.com.br/contador · https://www.nibo.com.br/contador/funcionalidades/obrigacoes
- https://www.nibo.com.br/empresa/funcionalidades/api-publica · https://ajuda.nibo.com.br/pt-BR/
