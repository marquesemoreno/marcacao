# Relatório de mercado — gestão financeira e contábil para o Conecta (28/11/2026)

**Para quê:** decidir com o consultor (Sinergia) o que o módulo financeiro do Conecta precisa ter para competir (**paridade**) e o que pode torná-lo **melhor que o mercado** (**diferencial**).

**Base:** páginas públicas de 20 produtos lidas em 28/11/2026 (sem acesso logado, sem centrais de ajuda). Preços são de referência; vários estão com promoção de Black Friday. Itens marcados ⚠️ não foram confirmados. Análises detalhadas: `docs/analise-nibo-funcionalidades.md` e `docs/analise-conta-azul-funcionalidades.md`.

---

## 1. Resumo

1. **O mercado está dividido em três grupos que não conversam:**
   - **gestão financeira genérica** (Nibo, Conta Azul, Omie, Granatum, Bling, Olist, Asaas): forte em pagar, receber, conciliar, cobrar e emitir nota, mas **nada de saúde**;
   - **software de clínica** (iClinic, Clinicorp, Ninsaúde, Amplimed, Simples Dental, Clínica nas Nuvens): tem agenda, repasse e TISS, mas um **financeiro raso** (pouca DRE, quase nenhum plano de contas, conciliação vaga);
   - **sistemas contábeis** (Domínio, Alterdata, SCI, Contmatic): recebem dados prontos e fazem a contabilidade fiscal.
2. **A brecha:** ninguém junta **financeiro de verdade + operação da clínica + BPO**. O Conecta já tem a operação (agenda, WhatsApp oficial, CRM, ponte com o ERP); falta o financeiro.
3. **O que virou básico** e precisa existir: contas a pagar e a receber, recorrência, conciliação bancária, boleto/Pix/link, régua de cobrança, NFS-e, DRE e fluxo de caixa, app do dono e exportação para o contador.
4. **O que quase ninguém faz bem** (onde ganhamos): repasse com deduções, ciclo completo de glosa, margem por procedimento, DRE de clínica, caixa da recepção, projeção de caixa pela agenda, IA que trabalha no financeiro, operação de BPO multi-clínica.
5. **Não construir o que exige licença**: conta digital, boleto, Pix, cartão e NFS-e entram **por parceiro**. Todos os concorrentes fazem assim.

## 2. Quem foi analisado

| Grupo | Produto | Preço de referência (mês) | Para quem |
|---|---|---|---|
| Financeiro/ERP | **Nibo** | R$ 166–479 por empresa | PMEs e escritórios de BPO |
| | **Conta Azul** | R$ 180–930 (por faixa de faturamento); Pro BPO a partir de R$ 130 | PMEs; programa para contadores |
| | **Omie** | a partir de R$ 339 (por receita; páginas divergem) | PMEs; tem segmento "clínicas" ⚠️ |
| | **Granatum** | R$ 396, plano único | só financeiro |
| | **Bling** | R$ 60–1.250 | comércio e e-commerce |
| | **Olist ERP** (ex-Tiny) | R$ 66–948 | comércio e marketplace |
| | **Asaas** | sem mensalidade; tarifa por cobrança | cobrança e conta digital |
| Clínica | **iClinic** (Afya) | R$ 99–299 por profissional; financeiro completo só no Pro (R$ 169) | consultórios médicos |
| | **Clinicorp** | R$ 160–469 + implantação | odonto e estética, redes |
| | **Ninsaúde** | não publicado | médico, odonto, fisio, franquias |
| | **Amplimed** | não publicado | consultórios e clínicas |
| | **Simples Dental** | R$ 150–350 | odonto |
| | **Clínica nas Nuvens** | R$ 99 por usuário (mín. 3) | multiespecialidade |
| | Feegow, Doctoralia Pro | não lidos (site fora do ar / sem fonte) | — |
| Contábil | **Domínio** (Thomson Reuters), **Alterdata**, **SCI**, **Contmatic** | sob consulta | escritórios contábeis |
| | Contabilizei, Agilize | R$ 159–450 | contabilidade online |
| Referência internacional | QuickBooks Online Accountant, Brex, Bill.com, Digits | — | padrão de UX e automação |

**Preço do Conecta hoje:** R$ 497 (Essencial) e R$ 797 (Completo), só o CRM. Um financeiro de nível Nibo/Conta Azul vale, sozinho, R$ 200–480 por empresa no mercado.

## 3. O que precisamos ter (paridade de mercado)

Coluna "Quem tem": **F** = financeiros genéricos, **C** = software de clínica. "Conecta": ✅ já temos base · 🔨 construir · 🤝 parceiro.

### 3.1 Operação financeira

| # | Funcionalidade | Quem tem | Conecta | Fase |
|---|---|---|---|---|
| P1 | Contas a pagar e a receber, com baixa, juros, multa e desconto | F todos, C maioria | 🔨 | BPO |
| P2 | Recorrência (aluguel, sistemas, contratos) | F todos | 🔨 | BPO |
| P3 | Parcelamento (paciente e despesas) | F, C | 🔨 | BPO |
| P4 | Plano de contas e categorias | F todos | 🔨 modelo Sinergia de clínica | Gerencial |
| P5 | Centro de custo e rateio | Nibo Plus, Conta Azul, Granatum, iClinic | 🔨 + salas ✅ | Gerencial |
| P6 | Anexo do comprovante/boleto/nota no lançamento | F todos | ✅ Storage · 🔨 | BPO |
| P7 | Permissões por usuário/perfil | F todos | ✅ padrão de funções · 🔨 `fin.*` | Gerencial |
| P8 | Multiempresa / multiunidade | Bling, Olist, C nos planos altos | 🔨 escritório → entidades | Gerencial |
| P9 | Lançamento a partir da agenda/atendimento | C todos | ✅ agenda + ponte · 🔨 | Gerencial |

### 3.2 Bancos

| # | Funcionalidade | Quem tem | Conecta | Fase |
|---|---|---|---|---|
| P10 | Conciliação bancária com sugestão automática | F todos, C metade | 🔨 | BPO |
| P11 | Importação de extrato OFX | Bling ✔, outros ⚠️ | 🔨 | BPO |
| P12 | Extrato automático (Open Finance) | Nibo (2 bancos), Conta Azul (12–13 bancos) | 🤝 agregador | Depois |
| P13 | Extrato em PDF lido por IA | Nibo, Conta Azul ⚠️ | 🔨 | BPO |

### 3.3 Cobrança e recebimento

| # | Funcionalidade | Quem tem | Conecta | Fase |
|---|---|---|---|---|
| P14 | Boleto e Pix com baixa automática | F todos, C todos | 🤝 PSP/banco | Depois |
| P15 | Link de pagamento com cartão parcelado | Conta Azul, Omie, Olist, Asaas, C todos | 🤝 PSP | Depois |
| P16 | Régua de cobrança (WhatsApp, e-mail, SMS) | Nibo, Conta Azul, Asaas, Clinicorp, Simples Dental | ✅ **já temos os três canais** + régua de Disparos · 🔨 adaptar | BPO |
| P17 | Relatório de inadimplência (aging) | F, C | 🔨 | Gerencial |

### 3.4 Fiscal e contador

| # | Funcionalidade | Quem tem | Conecta | Fase |
|---|---|---|---|---|
| P18 | Emissão de NFS-e | F todos, C quase todos | 🤝 integrador ou **API da NFS-e Nacional** | Depois |
| P19 | Exportação para o contador (planilha + documentos) | F todos, Simples Dental | 🔨 CSV/planilha + pacote de documentos | BPO |
| P20 | Acesso só-leitura do contador | Granatum, Conta Azul | 🔨 papel `CONTADOR_LEITURA` | BPO |

### 3.5 Relatórios e app

| # | Funcionalidade | Quem tem | Conecta | Fase |
|---|---|---|---|---|
| P21 | Fluxo de caixa realizado e previsto | F todos, C todos | 🔨 | Gerencial |
| P22 | DRE (competência e caixa) | Conta Azul, Omie, Granatum, Bling, Olist, Ninsaúde | 🔨 | Gerencial |
| P23 | Orçamento × realizado | Nibo Premium, Granatum | 🔨 | Gerencial |
| P24 | Dashboards e exportação | F, C | ✅ Relatório + CSV | Gerencial |
| P25 | App do dono: saldo, alertas, aprovar pagamento | Conta Azul, Omie (via WhatsApp) | 🔨 PWA + WhatsApp | BPO |
| P26 | Portal/app do cliente para mandar documentos | Nibo, Domínio, Contmatic, SCI | ✅ WhatsApp · 🔨 caixa de entrada | BPO |

### 3.6 IA básica (já virou padrão em 2026)

| # | Funcionalidade | Quem tem | Conecta | Fase |
|---|---|---|---|---|
| P27 | Ler boleto/nota/foto e criar lançamento para revisão | Nibo, Conta Azul, Omie | ✅ leitura de documento + transcrição de áudio · 🔨 | BPO |
| P28 | Sugerir categoria e aprender com a correção | Nibo, Conta Azul, Digits | 🔨 | BPO |
| P29 | Alertas automáticos (duplicidade, vencimento, falha de cobrança) | Conta Azul (+30 alertas), Brex | ✅ alertas do sistema · 🔨 catálogo financeiro | BPO |
| P30 | Assistente que consulta e age (MCP/chat) | Nibo, Omie, Bling, Olist | 🔨 Copiloto do BPO | Avançado |

## 4. O que seria diferencial

Ordenado pelo valor para clínica e para a Sinergia. **Base** indica o que já temos para construir em cima.

| # | Diferencial | Situação no mercado | Base no Conecta | Esforço |
|---|---|---|---|---|
| D1 | **DRE de clínica com margem de contribuição** (receita por convênio/particular, glosa como dedução, repasse + materiais + MDR como custo direto) | Genéricos não têm contas de saúde; software de clínica quase não tem DRE (só Ninsaúde e Clínica nas Nuvens citam) | plano de contas modelo + ponte do ERP | médio |
| D2 | **Repasse médico completo**: %, valor fixo, por procedimento e convênio, base bruta ou líquida, **descontando material, laboratório e MDR**, gatilho faturado ou recebido, **estorno automático por glosa**, extrato do médico no app | Comum em %; deduções só no Simples Dental; estorno por glosa em nenhum | agenda + ponte (médicos, guias) | alto |
| D3 | **Ciclo completo de glosa**: guia → lote → demonstrativo do convênio conciliado → glosa com motivo TISS → recurso com prazo → valor recuperado → efeito no repasse | Só a Clínica nas Nuvens descreve glosa e recurso; conciliação do demonstrativo, ninguém | guias do Firebird já lidas (Santa Clara) | alto |
| D4 | **Atendimento vira receita sem digitar**, mesmo com ERP de terceiro (lê o Firebird da clínica) | Software de clínica faz só dentro dele; genéricos não fazem | ✅ pontes Urolaser, Santa Clara, Onix | médio |
| D5 | **Projeção de caixa de 13 semanas pela agenda futura** (marcados × ticket × taxa de comparecimento) | Ninguém | ✅ agenda, confirmações, faltas e "Receita Protegida" já calculados | médio |
| D6 | **Margem por procedimento** (tempo de sala + material + repasse + imposto + MDR × preço particular × valor do convênio) | Ninguém mostra | ✅ ocupação de salas, preços, estoque da ponte | médio |
| D7 | **Cobrança e alertas no WhatsApp oficial que a clínica já usa**, com IA que entende a resposta ("já paguei", "posso pagar dia 10?") | Régua existe; IA lendo a resposta, ninguém | ✅ WhatsApp oficial, Lara/Jev classificando respostas | baixo |
| D8 | **Caixa da recepção** (abertura, fechamento, sangria, diferença por operador, conferência com a maquininha) | Nenhum site de clínica mostra | ✅ telas da recepção | baixo |
| D9 | **Operação de BPO multi-clínica**: carteira com semáforo, fechamento mensal com checklist, prova de conciliação, revisor ≠ preparador, explicação de variação | Nibo e Conta Azul têm carteira; fechamento com prova, ninguém no Brasil (QuickBooks e Digits estão lançando "fechamento com agentes") | ✅ tarefas, processos | médio |
| D10 | **Aprovação de pagamento por exceção** (política: abaixo de X aprova sozinho; acima, o dono aprova no WhatsApp) | Brex e Bill.com lá fora; aqui, aprovação simples no app | ✅ WhatsApp + propor-e-confirmar do Copiloto | baixo |
| D11 | **Diagnóstico mensal pronto** (DRE + caixa + 5 indicadores + 3 alertas, texto revisado pelo consultor, enviado sozinho ao gestor) | Conta Azul agenda relatórios; diagnóstico escrito, ninguém | ✅ resumo IA do Relatório | baixo |
| D12 | **Um sistema só para a clínica**: WhatsApp, agenda, CRM, marketing, financeiro e BPO | Software de clínica tem agenda, mas não WhatsApp oficial nem BPO; genéricos não têm agenda | ✅ é o produto | — |
| D13 | **Dado financeiro + saúde com LGPD de verdade** (portão de PII na IA, registro de acesso, exclusão do titular) | Ninguém comunica isso | ✅ já implementado | baixo |

## 5. O que não fazer (ou fazer só por parceiro)

| Item | Por quê |
|---|---|
| Conta digital própria (Omie.Cash, Bling, Olist, Conta Azul) | exige ser instituição de pagamento; usar PSP |
| Boleto, Pix, cartão, antecipação | via PSP/banco (ex.: Asaas: sem mensalidade, régua, split, webhooks; Clinicorp e Simples Dental já usam PSPs) |
| NFS-e por prefeitura | integrador, ou a **API da NFS-e Padrão Nacional** (gov.br, credenciamento no Painel do Contribuinte) |
| NF-e de produto, ICMS, PDV, estoque de varejo, e-commerce | não é clínica |
| Contabilidade fiscal (SPED, ECD/ECF, folha) | é do contador; o Conecta entrega os dados prontos |
| Negativação/protesto | ⏸️ risco de imagem para clínica; decidir caso a caso |

## 6. Integração com o contador

- Os sistemas contábeis importam **documentos fiscais (XML), extratos (OFX) e planilhas** (SCI e Contmatic declaram importar lançamentos por planilha em vários layouts; o Domínio importa XML/TXT de ERPs via API).
- **Nenhum layout de lançamento contábil está publicado** nas páginas lidas. Proposta: começar com **planilha padrão** (data, conta, centro de custo, contraparte com CNPJ/CPF, histórico, valor, documento) + **pacote de comprovantes**. Depois, pedir aos contadores dos clientes da Sinergia o layout do sistema que usam (Domínio é o mais comum) e fazer o primeiro conversor.

## 7. Regulação a acompanhar

| Tema | O que muda | Status nesta pesquisa |
|---|---|---|
| **NFS-e Padrão Nacional** (LC 214/2025) | emissor web + **API para ERPs**, com credenciamento | página do gov.br atualizada em 29/10/2026 |
| **Reforma tributária (IBS/CBS)** | cálculo novo nas notas; PGDAS-D atualizado a partir de nov/2026; piloto da CBS | cronograma de 2026–2027 **não confirmado** em fonte oficial |
| **TISS (ANS)** | padrão de guias e XML de convênio | página com "Padrão TISS – Setembro/2026"; versão e prazos não confirmados |
| **LGPD** | dado de saúde é sensível; financeiro de paciente junto com procedimento exige cuidado redobrado | o Conecta já tem portão de IA, registro de acesso e exclusão |
| Pix Automático, Open Finance | cobrança recorrente por Pix; extrato automático | fontes oficiais não abriram nesta pesquisa |

## 8. Proposta de ordem (para validar com o consultor)

1. **Gerencial só leitura** (já aprovado): DRE de clínica (D1), fluxo de caixa (P21), aging (P17), orçado × realizado (P23), 13 semanas pela agenda (D5), carteira do BPO (D9 leitura), lendo o ERP das clínicas (D4) e o Nibo.
2. **BPO no Conecta**: P1–P3, P6, P10–P11, P16, P19–P20, P25–P29 + caixa da recepção (D8), aprovação por exceção (D10), diagnóstico mensal (D11), fechamento com prova (D9 completo).
3. **Saúde avançado**: repasse completo (D2), glosas (D3), margem por procedimento (D6), cobrança com IA (D7).
4. **Parceiros**, na hora em que a migração de um cliente exigir: PSP (P14–P15), NFS-e (P18), Open Finance (P12).

**Posicionamento sugerido:** "o financeiro que entende clínica": não é um Nibo/Conta Azul genérico nem o financeiro raso do software de agenda. O preço pode seguir o modelo do Conta Azul (por faixa de faturamento, sistema completo) somado ao valor fixo do BPO da Sinergia.

## 9. Limitações

- Só páginas comerciais. Muito do que está ⚠️ pode existir na central de ajuda ou no produto.
- Não lidos: Feegow (erro de conexão), Doctoralia Pro, Questor, Xero, Ramp, Pilot, páginas de clínica do Omie e do Conta Azul, Open Finance e Pix Automático no BCB.
- Preços promocionais de Black Friday em vários produtos.

## Fontes

**Financeiro/ERP:** nibo.com.br (/empresa, /empresa/planos-e-precos, /sistema-de-cobrancas, /bpo-financeiro/, /contador) · contaazul.com (/planos/, /funcionalidades/*, /contadores/, /integracoes/) · omie.com.br (/precos, /funcionalidades/controle-financeiro-empresarial/, /omie-cash/, /ia/) · granatum.com.br (/financeiro/precos-planos, /financeiro/funcionalidades) · bling.com.br (/planos-e-precos, /gestao-financeira) · olist.com (/planos/, /sistema-erp/) · asaas.com (/precos-e-taxas, /cobranca-cartao, /regua-de-cobranca)
**Clínica:** iclinic.com.br (/funcionalidades/gestao-financeira/, /precos/) · clinicorp.com (/planos, /gestao-financeira-clinipay) · ninsaude.com (/pt-br/gerenciamento-financeiro-software-clinica/, /pt-br/faturamento-de-convenios-software-clinica/) · amplimed.com.br (/gestao-financeira/, /planos-e-recursos/) · simplesdental.com (/gestao-e-financeiro, /planos-e-precos) · clinicanasnuvens.com.br
**Contábil:** dominiosistemas.com.br (/solucoes/integracao-com-erp, /solucoes/evolucao-em-nuvem/portal-do-cliente) · alterdata.com.br (/contabil) · sci.com.br · contmatic.com.br (/sistema-contabil-contabil-phoenix) · contabilizei.com.br · agilize.com.br
**Internacional:** quickbooks.intuit.com/accountants/ · brex.com/product/expense-management · bill.com/product/accounts-payable · digits.com
**Regulação:** gov.br/pt-br/servicos/emitir-nota-fiscal-de-servico-eletronica · gov.br/receitafederal/pt-br/assuntos/reforma-tributaria · gov.br/ans (Padrão TISS)
