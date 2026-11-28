# Plano Mestre — Módulo Financeiro e BPO (Conecta Saúde × Sinergia)

> Versão 2 · 28/11/2026 · **decisões aprovadas** (ver [§8](#8-decisões-aprovadas-28112026)); roteiro revisto em [§6](#6-roadmap). Nenhum código alterado ainda.
> Análise do Nibo para substituí-lo: `docs/analise-nibo-funcionalidades.md`.
> Base: leitura do repositório MARCACAO (schema Prisma com 1.985 linhas, `src/lib`, `src/actions`, pontes em `CLIENTES/*/index.js`) e das skills de referência ([§2](#2-o-que-aproveitamos-das-skills-de-referência)).
> Documentos relacionados: `docs/prompt-modulo-financeiro-bpo.md`, `docs/levantamento-api-nibo.md`, `docs/roteiro-primeiro-atendimento-sinergia.md`.

---

## 0. Correção de premissa: a stack real

O pedido cita **Node.js + Express + EJS**. A auditoria mostra outra coisa, e o plano segue o que existe:

| Camada | O que o pedido supõe | O que o repositório tem de fato |
|---|---|---|
| App web | Express + EJS | **Next.js 15 (App Router)** + React 18, Tailwind 3, shadcn |
| Regras de negócio | rotas Express | **Server Actions** (`src/actions/*.ts`) + **Route Handlers** (`src/app/api/**`) + funções puras testadas em `src/lib/*.ts` (vitest) |
| Banco | PostgreSQL | **PostgreSQL no Supabase**, acessado **só pelo Prisma 5** (pooler 6543 em runtime, conexão direta só para migration) |
| Auth | — | **NextAuth 4** (JWT, `sessionVersion`, 2FA TOTP) |
| Hospedagem | — | **Vercel** (16 crons em `vercel.json`) |
| Express | — | Existe **só nas pontes** que rodam no PC de cada clínica (`CLIENTES/UROLASER`, `SANTA CLARA`, `ONIX`), falando com o Firebird |

**Consequência:** onde o pedido diz "endpoints Express", o plano entrega **Server Actions + Route Handlers do Next.js**, e onde diz "migrations SQL", entrega **migrations do Prisma** (que geram SQL; o DDL está escrito abaixo para revisão). As pontes Express ganham **novas rotas de leitura** do financeiro do ERP, e nada mais.

---

## 1. Auditoria do código atual

### 1.1 Banco de dados: o que existe e o que falta

| Conceito pedido | Tabela real | Observação importante para o financeiro |
|---|---|---|
| `clinicas` | `clinics` (model `Clinic`) | Tenant atual. Tem `cnpj` único, `commissionRate`, `defaultTicket` (Decimal). |
| `pacientes` | `contacts` + `contact_clinic_profiles` | `Contact` é **global** (telefone único, atravessa clínicas). Dados por clínica (CPF, convênio, carteirinha) ficam em `ContactClinicProfile`. **O financeiro liga em `contact_clinic_profiles`**, nunca só em `contacts`. |
| `agendamentos` | `appointments` | **Só os do marketplace.** Agendamentos da Urolaser, Santa Clara e Onix **não estão no nosso banco**: vivem no Firebird e são lidos pela ponte em tempo real (`fetchBridgeDailyAgenda`, `MARCACAO.NUMERO`). |
| `profissionais` | **não existe** | Médico é texto livre: `Appointment.doctorName`, `User.doctorName` (função MEDICO), `Contact.preferredDoctor`. Na ponte, `MEDICOS.A_MEDICOS`. **Repasse exige uma tabela nova de profissionais.** |
| `convenios` | **não existe** | `ClinicInsuranceSettings.accepted` (lista de nomes para a IA) e `ContactClinicProfile.convenio` (texto). Na ponte, tabela `CONVENIO`. |
| `procedimentos` | `procedures` + `clinic_procedures` | Catálogo do marketplace com `tussCode` e preço (Decimal 10,2). Clínicas com ponte usam o catálogo do Firebird. |
| Salas | `clinic_rooms` | Úteis como centro de custo ("Ocupação de salas" já existe). |
| Auditoria | `audit_logs` | Genérica (`action`, `entity`, `changes` JSON). Não é append-only garantido por banco. |
| Financeiro hoje | **nenhuma tabela** | O BI (`/clinic/relatorio?aba=financeiro` e `?aba=faturamento`) só **lê o Firebird ao vivo** pela ponte (`/api/financeiro/resumo`, `/api/bi/faturamento`) e não grava nada. |

**Dinheiro hoje** usa `Decimal(10,2)`. O módulo novo usará **centavos em `BIGINT`** (regra do projeto) e converte só na borda.

### 1.2 Autenticação, permissões e isolamento

- `UserRole`: `ADMIN | CLINIC | PATIENT`. Um usuário CLINIC pertence a **uma** clínica (`User.clinicId`).
- Funções na clínica (`src/lib/clinic-permissions.ts`): `RECEPCAO`, `MARKETING`, `GESTAO`, `MEDICO`, com a matriz de permissões `atendimento | ficha.ver | disparos | relatorios | config | chamar`.
- Guardas no servidor (`src/lib/session.ts`): `requireClinicSession`, `requireClinicPermission`, `requireClinicManager`, `requireAdminSession`. O **isolamento é feito na aplicação**: toda query filtra por `session.clinicId`.
- `middleware.ts` separa `/admin`, `/clinic` e `/clinic/medico`.
- **RLS ligado em todas as tabelas sem policy** (migration `20260915120000`): bloqueia a API REST do Supabase (chave anon pública). O Prisma usa o papel `postgres` (BYPASSRLS). Há **trava no CI** que reprova tabela nova sem RLS.
- Segredos de integração **cifrados** (`src/lib/token-crypto.ts`), com trava no CI (`integration-secrets.guard.test.ts`).
- IA passa pelo **portão LGPD** (`src/lib/ai-gateway.ts`, mascara PII; trava no CI).

**O que não cabe no modelo atual:** o escritório de BPO precisa enxergar **várias clínicas** e **profissionais PF que não são clínica**. Um usuário com um único `clinicId` não resolve. É preciso um nível novo de tenant ([§3.1](#31-tenancy-escritório--entidade-financeira)).

### 1.3 Integrações com os ERPs (pontes Firebird)

| Ponte | O que já expõe | Financeiro no ERP? |
|---|---|---|
| **Santa Clara** | agenda, médicos, convênios, procedimentos, pacientes, `/api/financeiro/resumo` (`CPR1/CPR2/CPR3`, `CUSTOS`, `MOVIMEN`), `/api/faturamento/resumo`, `/api/bi/faturamento` (guias `CPS1/CPS2`, `RECIBO`, `INTER2`) | **Sim, completo**: contas a pagar e receber com baixas (`CPR2.DATABAIXA`), plano de contas (`CUSTOS`), guias de convênio por médico. |
| **Urolaser** | agenda, médicos, convênios, procedimentos, pacientes | Não exposto ainda. |
| **Onix** | agenda, médicos, convênios, procedimentos (sem criar agendamento: 501) | Não exposto. |

**Risco principal de conflito:** a Santa Clara **já faz o financeiro no ERP dela**, e a Sinergia faz o BPO no **Nibo**. Se o Conecta também virar lugar de lançamento, o mesmo pagamento pode existir em três sistemas. A regra que evita isso está em [§3.2](#32-fonte-da-verdade-por-entidade-a-regra-anti-duplicidade).

---

## 2. O que aproveitamos das skills de referência

Repositórios lidos (clone raso, só leitura, fora do projeto, nenhum script executado):
`openaccountant/skills` (business/*), `alirezarezvani/claude-skills` (`finance/skills/month-end-close`, `financial-analyst`), `get-zeked/finance-super-skill`.
*(Não existe um script de "fluxo de caixa de 13 semanas" pronto no segundo repositório: há `forecast_builder.py` e boas práticas de previsão contínua. As 13 semanas abaixo são desenho nosso, inspirado nessas práticas.)*

| Referência | Ideia aproveitada | Adaptação para clínica no Brasil |
|---|---|---|
| `profit-loss` (openaccountant) | Receita → custo direto → lucro bruto → despesas → líquido, com margens | **DRE gerencial de clínica**: receita bruta (particular/convênio), deduções (impostos sobre receita, **glosas**, cancelamentos), **custos diretos (repasse médico, materiais, MDR, laboratório)**, margem de contribuição, despesas fixas, EBITDA. A referência é regime de caixa; a nossa DRE é **por competência**. |
| `month-end-close` (alirezarezvani) | **Três portões**: calendário com dependências e caminho crítico; **reconciliação como prova** (diferença não explicada = 0, sem "plug"); **variação material exige explicação com número e evidência**; quem prepara não revisa | Checklist de fechamento Sinergia com tarefas brasileiras (guias/glosas, repasses, DAS/ISS/INSS/IRRF, NFS-e × receita, pró-labore). Limite de materialidade **por entidade** (ex.: 10% **e** R$ 1.000). Equipe pequena: controle compensatório documentado (consultor revisa tudo acima do limite). |
| `reconciliation_matcher.py` | Casamento em passes: **referência → valor + janela de datas → transposição de dígitos (7.980 × 7.890)**; diferença divisível por 9 = suspeita de transposição; itens envelhecidos por faixa | Passo 0 com chaves brasileiras: **FITID do OFX, E2E ID do PIX, nosso número do boleto, NSU/autorização do cartão**. Janela em **dias úteis** (feriados já existem em `src/lib/holidays.ts`). Passo extra de **agrupamento** (1 crédito da adquirente = N vendas menos MDR). |
| `flux_analyzer.py` | Explicação recusada se vazia, genérica ("timing", "normal") ou sem valor | Mesmo lint, em português ("sazonal", "dentro do esperado", "diversos" são recusados). |
| `invoice-aging` | Faixas 0–30 / 31–60 / 61–90 / 90+, DSO ponderado, ação por faixa | Aging **separado por tipo de devedor**: paciente particular, **convênio** (prazo contratual, não 30 dias), **adquirente** (D+1/D+30). Ação na faixa: lembrete pelo WhatsApp oficial, escalar ao gestor, recurso de glosa. |
| `contractor-tracking` | Somar pagamentos por prestador no ano, marcar limites fiscais | Vira **repasse médico**: regra por profissional/procedimento/convênio, base bruta ou líquida, gatilho faturado ou recebido; acompanhamento anual por profissional para **IRRF/INSS do autônomo (RPA)** e conferência das notas do médico PJ. As regras do IRS (1099, US$ 600) foram descartadas. |
| `multi-entity` | Visão por entidade + consolidada; **transferência entre entidades não é receita nem despesa**; alerta de mistura pessoal × empresa | Carteira do BPO (várias clínicas) e **profissional PF com conta pessoal**. A categoria `TRANSFERENCIA` fica fora da DRE. Alerta de mistura PF/PJ. |
| `cash-flow-forecast` + `forecasting-best-practices` | Média móvel, separar recorrente de variável, saldo mínimo de segurança, previsão contínua | **Fluxo de 13 semanas**: títulos abertos (certos) + recorrentes + variáveis por média + **agenda futura da clínica × ticket × taxa de comparecimento** (dado que só nós temos). |
| `budget_variance_analyzer.py` | Variação favorável/desfavorável pela natureza da conta (receita acima = bom; despesa acima = ruim), limite % e absoluto | Orçado × realizado mensal por conta e centro de custo. |
| finance-super-skill: anomalias | Valor redondo, fora de hora, desvio por conta (z-score), duplicidade | Regras determinísticas e baratas: **boleto duplicado** (mesma linha digitável), mesmo fornecedor + valor em 7 dias, lançamento fora do padrão do fornecedor. Sem ML pesado no MVP. |
| finance-super-skill: invoice organizer | Extrair fornecedor/data/valor, nome padronizado, fila de revisão | **Caixa de entrada pelo WhatsApp**: foto do boleto/NF → extração → rascunho de título → analista aprova. Nome padronizado `AAAA-MM-DD Fornecedor - Tipo.pdf` no Storage. |

**Descartados por serem americanos:** US GAAP, SOX/PCAOB como exigência, 1099/W-9/IRS, Schedule C, Chase/Amex/QuickBooks. Ficam só como inspiração de controle interno.

---

## 3. Arquitetura

### 3.1 Tenancy: escritório → entidade financeira

```
fin_escritorios (Sinergia)
   │ 1:N
   ├── fin_membros ──────────── users   (sócio/consultor, analista, contador só-leitura)
   │ 1:N
   └── fin_entidades  ◄── o "cliente" do BPO: a empresa cujo financeiro é gerido
          ├── tipo CLINICA_PJ  ──(opcional, 1:1)── clinics   (Urolaser, Santa Clara…)
          ├── tipo PROFISSIONAL_PF / PROFISSIONAL_PJ (não precisa ser clínica)
          └── fin_entidade_acessos ── users  (gestor do cliente, profissional)
```

- **A entidade financeira é o tenant do módulo**, e não a clínica. Uma clínica do CRM pode ter entidade financeira ou não; um profissional pode ter entidade sem ter clínica.
- **Guarda nova** `requireFinAccess(entidadeId, permissao)` em `src/lib/fin/session.ts`. Libera quem é (a) membro do escritório dono da entidade, (b) usuário com acesso direto à entidade, ou (c) usuário GESTAO da clínica ligada. Toda query financeira filtra por `entidade_id`.
- **Permissões financeiras** (matriz própria, no padrão de `clinic-permissions.ts`): `fin.ver`, `fin.lancar`, `fin.aprovar_pagamento`, `fin.conciliar`, `fin.fechar_mes`, `fin.reabrir_mes`, `fin.config`, `fin.repasse.ver_proprio`.
  - Sócio/consultor: tudo. Analista: ver, lançar, conciliar, preparar o fechamento (sem fechar nem reabrir). Contador: só ver e exportar.
  - Gestor do cliente: ver e aprovar pagamento. Profissional: só o próprio repasse e a própria produção.
- O login continua o mesmo (NextAuth). O usuário do escritório entra com `role = CLINIC` sem `clinicId`, ou com um novo `UserRole.BPO`. **Decidido: `UserRole.BPO`** (ver [§8](#8-decisões-aprovadas-28112026)).

### 3.2 Fonte da verdade por entidade (a regra anti-duplicidade)

Cada entidade declara **uma** fonte de lançamentos: `fonte_lancamentos ∈ { CONECTA, NIBO, ERP }`.

| Fonte | Quem lança | O Conecta faz |
|---|---|---|
| `NIBO` (padrão da Sinergia hoje) | analista, no Nibo | **sincroniza** títulos, baixas, categorias, centros e extrato pela API (cron), e calcula DRE, indicadores de saúde, repasse e 13 semanas. Escreve no Nibo só ações explícitas (criar agendamento a partir de documento, anexar arquivo). |
| `ERP` (ex.: Santa Clara) | clínica, no Firebird | **lê** pela ponte (`CPR1/2/3`, `CUSTOS`, `CPS*`), só leitura. |
| `CONECTA` | analista ou gestor, no Conecta | é o livro-razão completo. |

Regras:
1. Todo registro importado guarda `(origem, origem_id)` com **UNIQUE por entidade**. Importar de novo **atualiza**, nunca duplica.
2. Registro importado é **somente leitura** no Conecta (edita-se na fonte). A tela mostra "vem do Nibo / do ERP".
3. Dados **que só nós temos** (regras de repasse, glosas detalhadas, ligação com agenda, orçamento, fechamento, explicações de variação) são sempre do Conecta, qualquer que seja a fonte.
4. Trocar a fonte de uma entidade é operação de admin, com corte por data (lançamentos antes da data ficam congelados).

### 3.3 Modelo de dados (PostgreSQL)

Convenções: prefixo `fin_`; nomes em português, como pedido (o resto do banco usa inglês e o Prisma mapeia com `@@map`); ids `text` (cuid, como o resto do banco); dinheiro `bigint` em **centavos**; percentuais em **pontos-base** (`int`, 1% = 100); `timestamptz`; **RLS ligado em todas** (trava do CI).

#### Diagrama (relações principais)

```
clinics ─1:1?─ fin_entidades ─N:1─ fin_escritorios ─1:N─ fin_membros ─N:1─ users
                  │
   ┌──────────────┼──────────────────┬────────────────────┬──────────────────┐
fin_plano_contas  fin_centros_custo  fin_profissionais    fin_contrapartes   fin_contas_bancarias
 (árvore, modelo   (─clinic_rooms?)   (─users? ─bridge     (─contact_clinic_     │
  padrão + cópia)                       MEDICOS id)          profiles?)          │
   │                    │                  │                    │                │
   └──── fin_titulo_rateios ──── fin_titulos ───────────────────┘                │
                                   │  (─appointments? ─bridge ref ─guia)         │
                                 fin_parcelas ───── fin_movimentos ──────────────┤ (append-only)
                                                        │                        │
                                     fin_conciliacoes ──┴── fin_extrato_linhas ──┘
                                                                  │
                                                       fin_extrato_importacoes
fin_guias_tiss ─1:N─ fin_glosas          fin_regras_repasse ─► fin_repasse_itens ─N:1─ fin_repasses
fin_fechamentos_mensais ─1:N─ fin_fechamento_tarefas / fin_variacoes      fin_orcamentos
fin_documentos  fin_sugestoes_ia  fin_regras_categorizacao  fin_integracoes  fin_auditoria
```

#### DDL das tabelas centrais

```sql
-- ── Tenancy ────────────────────────────────────────────────────────────────
CREATE TABLE fin_escritorios (
  id text PRIMARY KEY,
  nome text NOT NULL,                 -- "Sinergia"
  cnpj text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fin_membros (
  id text PRIMARY KEY,
  escritorio_id text NOT NULL REFERENCES fin_escritorios(id),
  user_id text NOT NULL REFERENCES users(id),
  papel text NOT NULL CHECK (papel IN ('SOCIO','ANALISTA','CONTADOR_LEITURA')),
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE (escritorio_id, user_id)
);

CREATE TABLE fin_entidades (
  id text PRIMARY KEY,
  escritorio_id text REFERENCES fin_escritorios(id),      -- null = gerida pela própria clínica
  clinic_id text UNIQUE REFERENCES clinics(id),           -- null = profissional sem clínica no CRM
  tipo text NOT NULL CHECK (tipo IN ('CLINICA_PJ','PROFISSIONAL_PF','PROFISSIONAL_PJ')),
  nome text NOT NULL,
  documento text,                                         -- CNPJ ou CPF (cifrado se PF)
  regime_tributario text CHECK (regime_tributario IN ('SIMPLES','PRESUMIDO','REAL','PF_CARNE_LEAO')),
  fonte_lancamentos text NOT NULL DEFAULT 'CONECTA' CHECK (fonte_lancamentos IN ('CONECTA','NIBO','ERP')),
  fonte_desde date,
  materialidade_bp int NOT NULL DEFAULT 1000,             -- 10%
  materialidade_centavos bigint NOT NULL DEFAULT 100000,  -- R$ 1.000
  saldo_minimo_centavos bigint,                           -- alerta das 13 semanas
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fin_entidade_acessos (
  entidade_id text NOT NULL REFERENCES fin_entidades(id),
  user_id text NOT NULL REFERENCES users(id),
  papel text NOT NULL CHECK (papel IN ('GESTOR','PROFISSIONAL')),
  profissional_id text,                                   -- PROFISSIONAL vê só o próprio
  PRIMARY KEY (entidade_id, user_id)
);

-- ── Cadastros ──────────────────────────────────────────────────────────────
CREATE TABLE fin_plano_contas (
  id text PRIMARY KEY,
  entidade_id text REFERENCES fin_entidades(id),          -- null = MODELO PADRÃO Sinergia
  pai_id text REFERENCES fin_plano_contas(id),
  codigo text NOT NULL,                                   -- "3.1.02"
  nome text NOT NULL,
  grupo_dre text NOT NULL CHECK (grupo_dre IN (
    'RECEITA_BRUTA','DEDUCAO','CUSTO_DIRETO','DESPESA_PESSOAL','DESPESA_OCUPACAO',
    'DESPESA_ADMIN','DESPESA_MARKETING','RESULTADO_FINANCEIRO','IMPOSTO_LUCRO',
    'NAO_OPERACIONAL','TRANSFERENCIA')),                  -- TRANSFERENCIA e NAO_OPERACIONAL ficam fora da DRE
  aceita_lancamento boolean NOT NULL DEFAULT true,        -- false = conta sintética (grupo)
  origem text NOT NULL DEFAULT 'CONECTA', origem_id text,
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE (entidade_id, codigo)
);

CREATE TABLE fin_centros_custo (
  id text PRIMARY KEY,
  entidade_id text NOT NULL REFERENCES fin_entidades(id),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('UNIDADE','ESPECIALIDADE','PROFISSIONAL','SALA','ADMINISTRATIVO')),
  clinic_room_id text REFERENCES clinic_rooms(id),
  origem text NOT NULL DEFAULT 'CONECTA', origem_id text,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE fin_profissionais (                          -- resolve o "doctorName texto livre"
  id text PRIMARY KEY,
  entidade_id text NOT NULL REFERENCES fin_entidades(id),
  nome text NOT NULL,
  nome_na_agenda text,                                    -- casa com Appointment.doctorName / User.doctorName
  bridge_medico_id int,                                   -- MEDICOS.A_MEDICOS do Firebird
  user_id text REFERENCES users(id),                      -- login do médico (função MEDICO)
  conselho text,                                          -- "CRM-BA 12345"
  vinculo text CHECK (vinculo IN ('SOCIO','PJ','AUTONOMO_RPA','CLT')),
  documento_cifrado text, chave_pix_cifrada text,
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE (entidade_id, bridge_medico_id)
);

CREATE TABLE fin_contrapartes (                           -- quem paga ou recebe
  id text PRIMARY KEY,
  entidade_id text NOT NULL REFERENCES fin_entidades(id),
  tipo text NOT NULL CHECK (tipo IN ('PACIENTE','CONVENIO','ADQUIRENTE','FORNECEDOR','PROFISSIONAL','ORGAO_PUBLICO','OUTRO')),
  nome text NOT NULL,
  documento text,
  contact_clinic_profile_id text REFERENCES contact_clinic_profiles(id) ON DELETE SET NULL, -- LGPD: exclusão do titular desliga
  profissional_id text REFERENCES fin_profissionais(id),
  registro_ans text,                                      -- convênio
  prazo_recebimento_dias int,                             -- convênio/adquirente
  origem text NOT NULL DEFAULT 'CONECTA', origem_id text,
  UNIQUE (entidade_id, origem, origem_id)
);

CREATE TABLE fin_contas_bancarias (
  id text PRIMARY KEY,
  entidade_id text NOT NULL REFERENCES fin_entidades(id),
  tipo text NOT NULL CHECK (tipo IN ('CORRENTE','POUPANCA','CAIXA_FISICO','ADQUIRENTE','APLICACAO')),
  banco_codigo text, agencia text, conta text, apelido text NOT NULL,
  saldo_inicial_centavos bigint NOT NULL DEFAULT 0,
  saldo_inicial_data date NOT NULL,
  origem text NOT NULL DEFAULT 'CONECTA', origem_id text,
  ativo boolean NOT NULL DEFAULT true
);

-- ── Títulos (obrigações) — regime de COMPETÊNCIA ───────────────────────────
CREATE TABLE fin_titulos (
  id text PRIMARY KEY,
  entidade_id text NOT NULL REFERENCES fin_entidades(id),
  natureza text NOT NULL CHECK (natureza IN ('RECEBER','PAGAR')),
  contraparte_id text REFERENCES fin_contrapartes(id),
  descricao text NOT NULL,
  documento_numero text,                                  -- nº NF, guia, boleto
  data_emissao date NOT NULL,
  data_competencia date NOT NULL,                         -- mês da DRE
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  status text NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('RASCUNHO','ABERTO','PARCIAL','QUITADO','CANCELADO')),
  aprovado_por text REFERENCES users(id), aprovado_em timestamptz,   -- pagar: fluxo de aprovação
  origem text NOT NULL DEFAULT 'CONECTA' CHECK (origem IN ('CONECTA','NIBO','ERP','AGENDA','TISS','DOCUMENTO','RECORRENCIA')),
  origem_id text,
  appointment_id text REFERENCES appointments(id),        -- agendamento do marketplace
  bridge_ref text,                                        -- ex.: "MARCACAO:48211" / "CPS1:9912"
  guia_id text,                                           -- FK para fin_guias_tiss (criada na fase 3)
  cancelado_motivo text,
  versao int NOT NULL DEFAULT 1,                          -- trava otimista
  criado_por text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entidade_id, origem, origem_id)
);
CREATE INDEX ON fin_titulos (entidade_id, natureza, status);
CREATE INDEX ON fin_titulos (entidade_id, data_competencia);

CREATE TABLE fin_titulo_rateios (                         -- classificação (soma = valor do título)
  id text PRIMARY KEY,
  titulo_id text NOT NULL REFERENCES fin_titulos(id) ON DELETE CASCADE,
  conta_id text NOT NULL REFERENCES fin_plano_contas(id),
  centro_custo_id text REFERENCES fin_centros_custo(id),
  profissional_id text REFERENCES fin_profissionais(id),
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0)
);

CREATE TABLE fin_parcelas (
  id text PRIMARY KEY,
  titulo_id text NOT NULL REFERENCES fin_titulos(id),
  numero int NOT NULL,
  vencimento date NOT NULL,
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  forma text CHECK (forma IN ('PIX','BOLETO','CARTAO_CREDITO','CARTAO_DEBITO','DINHEIRO','TRANSFERENCIA','CONVENIO','DEBITO_AUTOMATICO')),
  mdr_bp int,                                             -- taxa da maquininha (cartão)
  valor_liquido_previsto_centavos bigint,
  linha_digitavel text, pix_txid text, nsu text,          -- chaves de conciliação
  status text NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA','PARCIAL','QUITADA','CANCELADA')),
  UNIQUE (titulo_id, numero)
);
CREATE INDEX ON fin_parcelas (vencimento) WHERE status IN ('ABERTA','PARCIAL');

-- ── Movimentos de caixa — regime de CAIXA, APPEND-ONLY ─────────────────────
CREATE TABLE fin_movimentos (
  id text PRIMARY KEY,
  entidade_id text NOT NULL REFERENCES fin_entidades(id),
  conta_bancaria_id text NOT NULL REFERENCES fin_contas_bancarias(id),
  data_caixa date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('BAIXA','TRANSFERENCIA','TARIFA','ANTECIPACAO','AJUSTE','ESTORNO')),
  valor_centavos bigint NOT NULL CHECK (valor_centavos <> 0),  -- + entra, − sai
  parcela_id text REFERENCES fin_parcelas(id),
  principal_centavos bigint, juros_centavos bigint DEFAULT 0, multa_centavos bigint DEFAULT 0,
  desconto_centavos bigint DEFAULT 0, taxa_centavos bigint DEFAULT 0,   -- MDR/tarifa da baixa
  transferencia_par_id text REFERENCES fin_movimentos(id),             -- outra perna da transferência
  estorno_de_id text UNIQUE REFERENCES fin_movimentos(id),             -- 1 estorno por movimento
  descricao text,
  origem text NOT NULL DEFAULT 'CONECTA', origem_id text,
  criado_por text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entidade_id, origem, origem_id)
);
CREATE INDEX ON fin_movimentos (conta_bancaria_id, data_caixa);

-- ── Conciliação ────────────────────────────────────────────────────────────
CREATE TABLE fin_extrato_importacoes (
  id text PRIMARY KEY,
  conta_bancaria_id text NOT NULL REFERENCES fin_contas_bancarias(id),
  formato text NOT NULL CHECK (formato IN ('OFX','CSV','NIBO','API')),
  arquivo_nome text, arquivo_sha256 text,
  periodo_inicio date, periodo_fim date,
  saldo_final_banco_centavos bigint,                     -- LEDGERBAL do OFX: base da prova
  importado_por text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_bancaria_id, arquivo_sha256)
);

CREATE TABLE fin_extrato_linhas (
  id text PRIMARY KEY,
  importacao_id text NOT NULL REFERENCES fin_extrato_importacoes(id),
  conta_bancaria_id text NOT NULL REFERENCES fin_contas_bancarias(id),
  fitid text NOT NULL,                                    -- id único do banco (ou hash data+valor+desc no CSV)
  data date NOT NULL,
  valor_centavos bigint NOT NULL,
  descricao text, documento text, pix_e2e_id text,
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','CONCILIADA','IGNORADA')),
  UNIQUE (conta_bancaria_id, fitid)                       -- reimportar não duplica
);

CREATE TABLE fin_conciliacoes (
  id text PRIMARY KEY,
  grupo_id text NOT NULL,                                 -- N linhas ↔ M movimentos no mesmo casamento
  extrato_linha_id text REFERENCES fin_extrato_linhas(id),
  movimento_id text REFERENCES fin_movimentos(id),
  regra text NOT NULL CHECK (regra IN ('REFERENCIA','VALOR_DATA','TRANSPOSICAO','AGRUPAMENTO','MANUAL','IA')),
  confianca_bp int,
  preparado_por text REFERENCES users(id),
  revisado_por text REFERENCES users(id),                 -- ≠ preparado_por (checado na action)
  created_at timestamptz NOT NULL DEFAULT now(),
  desfeita_em timestamptz
);

-- ── Fechamento mensal ──────────────────────────────────────────────────────
CREATE TABLE fin_fechamentos_mensais (
  id text PRIMARY KEY,
  entidade_id text NOT NULL REFERENCES fin_entidades(id),
  competencia char(7) NOT NULL,                           -- "2026-11"
  status text NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO','EM_FECHAMENTO','FECHADO','REABERTO')),
  fechado_por text REFERENCES users(id), fechado_em timestamptz,
  revisado_por text REFERENCES users(id),
  snapshot jsonb,                                         -- DRE, DFC e saldos congelados no fechamento
  reaberto_motivo text,
  UNIQUE (entidade_id, competencia)
);
```

#### Demais tabelas (DDL na fase correspondente)

| Tabela | Fase | Colunas-chave |
|---|---|---|
| `fin_fechamento_tarefas` | 2 | fechamento_id, codigo, titulo, responsavel_id, revisor_id (≠), depende_de text[], prazo_dia_util, status, evidencia (texto + link) |
| `fin_variacoes` | 2 | fechamento_id, conta_id, centro_custo_id, atual, base, tipo_base (ORCADO/MES_ANTERIOR), material, explicacao, lint (OK/VAZIA/GENERICA/SEM_VALOR/SEM_EVIDENCIA), revisor_id |
| `fin_orcamentos` | 2 | entidade_id, conta_id, centro_custo_id, competencia, valor_centavos |
| `fin_recorrencias` | 1 | modelo de título recorrente (aluguel, sistemas), dia, valor, rateio, ativa |
| `fin_documentos` | 2 | entidade_id, tipo (BOLETO/NFSE/NFE/RECIBO/COMPROVANTE), storage_path, sha256, canal (WHATSAPP/APP/UPLOAD/EMAIL), extraido jsonb, confianca_bp, status, titulo_id |
| `fin_sugestoes_ia` | 2 | alvo (TITULO/EXTRATO_LINHA), tipo (CATEGORIA/CONCILIACAO/LANCAMENTO), proposta jsonb, confianca_bp, modelo, status, decidido_por |
| `fin_regras_categorizacao` | 2 | entidade_id, documento_contraparte, padrao_descricao, conta_id, centro_custo_id, origem (MANUAL/APRENDIDA), acertos |
| `fin_guias_tiss` | 3 | entidade_id, convenio_id, numero_guia, lote, data_atendimento, envio, valor_apresentado/pago/glosado, status, profissional_id, titulo_id, origem/origem_id |
| `fin_glosas` | 3 | guia_id, codigo_motivo_tiss, motivo, valor, status (ABERTA/RECURSO/RECUPERADA/ACEITA), prazo_recurso, recuperado |
| `fin_regras_repasse` | 3 | profissional_id, procedimento (TUSS ou texto), convenio_id, tipo (PERCENTUAL/FIXO), percentual_bp, valor_fixo, base (BRUTO/LIQUIDO), gatilho (FATURADO/RECEBIDO), deduz_mdr, deduz_imposto_bp, vigência, prioridade |
| `fin_repasses` / `fin_repasse_itens` | 3 | extrato mensal por profissional; item = título/guia × regra, base, valor, estorno_de_id (glosa), status (ABERTO/CONFERIDO/APROVADO/PAGO), titulo_pagar_id |
| `fin_integracoes` | 1 (Nibo) | entidade_id, provedor (NIBO/ERP_BRIDGE), token cifrado, ultimo_sync, cursor, erro |
| `fin_auditoria` | 1 | bigserial, entidade_id, user_id, tabela, registro_id, acao, antes, depois, created_at (**append-only**) |

---

## 4. Regras de negócio críticas

### 4.1 Edição, estorno e saldo que nunca quebra

Modelo em duas camadas, adaptando o "ledger imutável" sem forçar partidas dobradas completas (o BPO é gerencial, não contabilidade fiscal: essa continua com o contador):

1. **Título** (obrigação, competência) pode ser editado **enquanto não tem baixa** e o mês não está fechado. Cada edição grava antes/depois em `fin_auditoria` e sobe `versao` (trava otimista: duas pessoas editando ao mesmo tempo → a segunda recebe conflito).
2. **Movimento** (caixa) é **append-only**: trigger no banco recusa `UPDATE` e `DELETE`. Para corrigir, cria-se um `ESTORNO` com valor oposto e `estorno_de_id`, e depois o movimento certo.
3. **Saldo** de uma conta = `saldo_inicial + Σ movimentos`. Nunca é uma coluna gravada; é calculado (com índice), então não "desanda".
4. **Título com baixa** não muda de valor: estorna-se a baixa e, se preciso, cancela-se o título (`CANCELADO` com motivo) e cria-se outro.
5. **Mês fechado é imutável**: um trigger recusa inserir ou alterar título com `data_competencia`, ou movimento com `data_caixa`, numa competência `FECHADO`. Ajuste entra **no mês aberto**, com referência ao original. Reabrir exige `fin.reabrir_mes`, motivo, e gera novo snapshot.
6. **Transferência** entre contas = dois movimentos ligados (`transferencia_par_id`), conta `TRANSFERENCIA`, fora da DRE.
7. **Rateio** sempre soma o valor do título (checado na action e por trigger diferido).

### 4.2 Caixa × competência

| Pergunta | Regime | De onde vem |
|---|---|---|
| "Quanto a clínica faturou/gastou em outubro?" (**DRE**) | Competência | `fin_titulos.data_competencia` + `fin_titulo_rateios` |
| "Quanto entrou/saiu do banco em outubro?" (**DFC**) | Caixa | `fin_movimentos.data_caixa` (rateado pelo rateio do título da parcela) |
| "Quanto vou ter nas próximas 13 semanas?" | Caixa projetado | parcelas abertas por vencimento + recorrências + variáveis + agenda |
| "Quanto falta receber?" (**aging**) | Saldo de parcela | parcelas abertas − baixas |

Casos de saúde:
- **Cartão parcelado 3×**: receita na competência do atendimento (valor bruto). Caixa: 3 parcelas da **adquirente** (D+30, D+60, D+90), cada uma líquida de MDR. A MDR vai para **custo direto** na competência da venda. Antecipação = movimento `ANTECIPACAO` com `taxa_centavos` em resultado financeiro.
- **Convênio**: receita na competência do atendimento pelo valor apresentado. A **glosa** entra como **dedução** na competência em que for conhecida (não reescreve o mês fechado). O caixa entra quando o convênio paga (prazo contratual).
- **Profissional PF (carnê-leão)**: o livro-caixa é **por caixa** (regra da Receita para PF). A entidade PF mostra DFC como relatório principal e a DRE como gerencial.

### 4.3 O fluxo de automação

```
Atendimento concluído
  ├─ marketplace: appointments.status = COMPLETED
  └─ ponte: agenda do dia (status atendido) / RECIBO / guia CPS1 do Firebird
        │  cron fin-sync-agenda (de hora em hora) — idempotente por origem_id
        ▼
Título a RECEBER (origem AGENDA ou TISS, competência = data do atendimento)
  • contraparte: paciente (particular) | convênio | adquirente (cartão)
  • rateio: conta "Receita de consultas/exames/procedimentos" × centro (profissional/sala)
  • parcelas: conforme forma (PIX à vista; cartão N× líquido de MDR; convênio no prazo)
        │  regras de repasse avaliadas já aqui (gatilho FATURADO) → item PREVISTO
        ▼
Baixa
  • manual (recepção/analista) ou
  • conciliação: OFX/CSV importado → casamento com parcelas abertas
        │  gera fin_movimentos BAIXA (+ TARIFA/MDR) e conciliação com prova
        ▼
Repasse médico
  • gatilho RECEBIDO: item vira LIBERADO na baixa
  • glosa posterior: item de ESTORNO proporcional no repasse do mês seguinte
  • fim do mês: extrato por profissional → conferido → aprovado → vira título a PAGAR
        ▼
DRE gerencial (competência) + DFC (caixa) + indicadores
  • congelados no snapshot do fechamento mensal
```

Com `fonte_lancamentos = NIBO`, o mesmo fluxo vale, mas **títulos e baixas vêm do Nibo**. O Conecta só **liga** o título do Nibo ao atendimento (sugestão por data + valor + paciente) para medir produção × recebido e calcular repasse.

### 4.4 Conciliação bancária brasileira

- **Leitores**: OFX 1.x (SGML, o padrão dos bancos brasileiros: tags sem fechamento, `CHARSET 1252`) e 2.x (XML); CSV com **layout por banco** (Itaú, Bradesco, BB, Caixa, Santander, Inter, Nubank PJ, Sicoob/Sicredi); extrato do **Nibo** pela API. Todos viram `fin_extrato_linhas`; reimportar o mesmo arquivo ou a mesma linha é ignorado (`sha256`, `fitid`).
- **Casamento em passes** (adaptado de `reconciliation_matcher.py`):
  0. **Chave forte**: E2E ID do PIX, txid, nosso número ou linha digitável do boleto, NSU do cartão.
  1. **Valor exato + janela** de ±3 dias úteis, mesmo sinal; vence a data mais próxima.
  2. **Transposição de dígitos** (diferença divisível por 9) → sugestão, nunca automático.
  3. **Agrupamento**: 1 crédito da adquirente = soma de N parcelas líquidas do dia (problema do subconjunto, limitado a N ≤ 30 e janela D+0..D+2).
  4. **IA**: para o que sobrar, sugere contraparte e categoria ([§5](#5-ia-e-automação-skills-internas)), sempre como sugestão.
- **Prova** por conta e período: `saldo do banco (LEDGERBAL) − saldo do sistema = itens só no banco + itens só no sistema`. **Diferença não explicada tem que ser zero** para a tarefa de fechamento ficar verde. Sem linha de "ajuste" para tapar diferença.
- **Envelhecimento** dos pendentes: 0–30 / 31–60 / 61–90 / 90+. Acima de 60 dias, escala ao consultor.
- **Segregação**: quem concilia não revisa. Em equipe de uma pessoa, o controle compensatório (consultor revisa itens acima da materialidade) fica registrado.

### 4.5 Plano de contas padrão para clínicas (modelo Sinergia)

```
1 RECEITA BRUTA
  1.1 Consultas particulares          1.2 Consultas convênio
  1.3 Exames                          1.4 Procedimentos/cirurgias
  1.5 Outras receitas operacionais
2 DEDUÇÕES DA RECEITA
  2.1 Impostos sobre receita (DAS / ISS / PIS / COFINS)
  2.2 Glosas de convênio              2.3 Cancelamentos e devoluções
= RECEITA LÍQUIDA
3 CUSTOS DIRETOS
  3.1 Repasse médico/profissional     3.2 Materiais e medicamentos
  3.3 Taxas de cartão (MDR)           3.4 Laboratório/serviços terceirizados
= MARGEM DE CONTRIBUIÇÃO
4 DESPESAS OPERACIONAIS
  4.1 Pessoal (salários, encargos, benefícios, pró-labore)
  4.2 Ocupação (aluguel, condomínio, energia, água, manutenção)
  4.3 Administrativas (contador, sistemas, telefonia, material de escritório)
  4.4 Marketing (anúncios, agência, site)
= EBITDA
5 RESULTADO FINANCEIRO (juros, tarifas bancárias, antecipação, rendimentos)
6 IR / CSLL (presumido ou real)
= RESULTADO LÍQUIDO
7 NÃO OPERACIONAL — fora da DRE, dentro do DFC
  7.1 Investimentos (equipamentos)    7.2 Empréstimos (entrada/amortização)
  7.3 Distribuição de lucros          7.4 Aportes dos sócios
8 TRANSFERÊNCIAS ENTRE CONTAS — fora de tudo
```

O modelo é copiado para cada entidade nova (editável). Com fonte `NIBO`, o **mapeamento categoria do Nibo → conta Sinergia** é feito uma vez por entidade e padroniza a carteira toda.

### 4.6 Operação BPO multi-clínica

- **Carteira** (`/bpo`): uma linha por entidade com semáforo: vencidos a pagar, recebíveis 60+, conciliação pendente (dias), fechamento do mês (tarefas verdes/total), saldo projetado negativo nas 13 semanas, documentos parados na caixa de entrada.
- **Fechamento mensal** (adaptado dos três portões):
  1. **Calendário**: tarefas com responsável, revisor, dependências e prazo em dia útil (meta: D+5). Modelo padrão: importar extratos → conciliar cada conta → conferir guias/glosas → conferir repasses → conferir impostos (DAS, ISS, INSS/IRRF de RPA) → NFS-e emitidas × receita → variações → revisão do consultor → fechar.
  2. **Prova de conciliação** por conta (diferença = 0).
  3. **Variações materiais** explicadas com causa, valor e evidência (lint).
  Fechar exige os três verdes, revisor ≠ preparador, e congela o snapshot.
- **Aging e inadimplência**: diário por cron; paciente particular com parcela vencida → (opcional, por entidade) lembrete pelo **WhatsApp oficial** com modelo de utilidade aprovado. Convênio fora do prazo → tarefa do analista. Tudo respeita o consentimento que já existe (`ChannelConsent`).
- **Consolidado**: soma por escritório, excluindo `TRANSFERENCIA` e operações entre entidades do mesmo grupo.

---

## 5. IA e automação (skills internas)

Princípios: **a IA sugere, a pessoa decide**; nada move dinheiro; tudo passa pelo `ai-gateway` (máscara de PII); regra determinística antes de modelo; cada sugestão fica em `fin_sugestoes_ia` com confiança, modelo e quem decidiu (no padrão de `AiActionLog`).

| Skill interna | O que faz | Como | Fase |
|---|---|---|---|
| **Categorizador** | Sugere conta e centro de custo para título e linha de extrato | 1º regras aprendidas (mesmo CNPJ/descrição → mesma conta, `fin_regras_categorizacao`); 2º LLM com o plano de contas da entidade. Aplica sozinho só acima de 0,85 **e** com regra confirmada ≥ 3 vezes; o resto vai para fila | 2 |
| **Leitor de documentos** | Foto/PDF de boleto, NFS-e, recibo → rascunho de título com anexo | **Linha digitável e código de barras decodificados por algoritmo** (valor e vencimento sem IA); XML de NFS-e/NF-e lido direto; imagem → visão via gateway (pendência LGPD de foto no portão). Reaproveita `invoice-extraction.ts` e `documents/*` | 2 |
| **Conciliador assistido** | Explica o casamento sugerido e os pendentes | passes determinísticos + LLM só para descrever e sugerir contraparte | 2 |
| **Revisor de variações** | Rascunha a explicação de variação material a partir dos lançamentos que a causaram; lint recusa texto genérico | LLM com os maiores lançamentos da conta no mês | 2 |
| **Diagnóstico mensal** | Relatório do mês: DRE, DFC, 5 indicadores, 3 alertas, 3 recomendações de **gestão** (não de investimento), revisado pelo consultor antes de ir ao cliente | snapshot do fechamento + LLM; o consultor edita e aprova | 2 |
| **Alertas proativos** | WhatsApp ao gestor: saldo projetado abaixo do mínimo, pagamento aguardando aprovação, glosa acima do normal, repasse para aprovar | regras determinísticas + modelo de utilidade aprovado na Meta; consentimento do gestor | 2–3 |
| **Copiloto do BPO** | Chat para o analista ("quanto a Urolaser tem a receber de Unimed acima de 60 dias?", "agende o boleto da Coelba") | mesmo padrão do Copiloto da Recepção: tool calling com **propor e confirmar** | 3 |
| **Caçador de anomalias** | Boleto duplicado, fornecedor com valor fora do padrão, pagamento no fim de semana, título sem documento | regras simples (sem ML no MVP) | 2 |

---

## 6. Roadmap

> **Roteiro aprovado em 28/11** (substitui as fases originais abaixo, que ficam como referência de conteúdo):
>
> **Fase 1: área gerencial, só leitura.** Nada é lançado no Conecta ainda.
> - **1a. Leitura do Nibo** (clientes atuais da Sinergia): sincronizar cadastros, categorias, centros, títulos e baixas; mapear categorias → plano Sinergia. Serve também de importador para a migração. *Depende de um token de teste.*
> - **1b. Leitura do ERP das clínicas** (o financeiro **continua no ERP**): Santa Clara já expõe `CPR1/2/3`, `CUSTOS` e guias pela ponte; Urolaser e Onix precisam de novas rotas de leitura (mapear as tabelas financeiras do Firebird delas). Mapear `CUSTOS` → plano Sinergia.
> - Em cima das duas fontes: tenancy (escritório → entidade), **DRE gerencial** (com análise vertical e horizontal), **fluxo de caixa** realizado + **13 semanas**, **aging**, **orçado × realizado**, **indicadores de saúde** (margem por médico/convênio, DSO por convênio, glosa) e a **carteira `/bpo`** com semáforo.
>
> **Fase 2: BPO no Conecta** (substitui o Nibo). Livro-razão próprio: contas a pagar/receber, recorrência, rateio, baixa, estorno, aprovação de pagamento, conciliação OFX/CSV/PDF, fechamento mensal com os três portões, caixa de entrada de documentos (WhatsApp + upload), régua de cobrança pelo WhatsApp/e-mail, PWA Sinergia do gestor e do profissional. Depois, **migração cliente a cliente** do Nibo (paralelo de um mês + corte por data).
>
> **Fase 3: avançado para clínicas.** Repasse médico, guias TISS e glosas, recebíveis de cartão, copiloto do BPO.
>
> **Com parceiros, quando a migração exigir:** boleto/Pix com baixa automática, NFS-e multi-município, Open Finance.
>
> Clínicas com ERP (Urolaser, Santa Clara, Onix) ficam sempre na fonte `ERP`: o Conecta lê e analisa, não lança.

### Fase 0: decisões (antes de codar)
Aprovar [§8](#8-decisões-aprovadas-28112026); mapear com o consultor as planilhas e o ciclo do primeiro cliente; testar a API do Nibo com um token real.

### Fase 1 original: MVP operacional *(conteúdo vai para a Fase 2 aprovada)*
- Tenancy (escritório, membros, entidades, acessos) + guarda `requireFinAccess` + permissões.
- Cadastros: plano de contas (modelo padrão + cópia), centros de custo, profissionais, contrapartes, contas bancárias.
- **Contas a pagar e a receber**: títulos, rateio, parcelas, recorrências, baixa manual, estorno, aprovação de pagamento.
- **Fluxo de caixa básico** (realizado + a vencer por semana/mês) e **aging** simples.
- **Integração com o agendamento**: cron que cria títulos a receber a partir de atendimentos concluídos (marketplace + ponte), idempotente.
- Movimentos append-only, auditoria, RLS, testes (TDD) nas regras de saldo, estorno, rateio, parcela de cartão e período.
- Telas: `/financeiro` (entidade), `/bpo` (carteira, versão simples).

### Fase 2: BPO e automação
- Importação **OFX/CSV** + conciliação em passes + prova + envelhecimento.
- **Sincronização com o Nibo** (fonte `NIBO`) e leitura do financeiro do ERP pela ponte (fonte `ERP`).
- **DRE gerencial** (competência) + DFC (caixa) + orçado × realizado.
- **Checklist de fechamento mensal** com os três portões e snapshot.
- IA: categorizador, leitor de documentos (caixa de entrada pelo WhatsApp), conciliador assistido, revisor de variações, diagnóstico mensal, anomalias.
- PWA do gestor: aprovar pagamentos, ver caixa e DRE, enviar documento.

### Fase 3: avançado para clínicas
- **Repasse médico** automatizado (regras, extrato, aprovação, título a pagar, estorno por glosa) + visão do profissional no app.
- **Convênios**: guias TISS, lotes, **glosas** com motivo e recurso, prazo médio por convênio.
- **Recebíveis de cartão**: MDR por bandeira/parcelas, antecipação, conciliação com o extrato da adquirente.
- **Projeção de caixa de 13 semanas** com agenda futura como direcionador e alerta de saldo mínimo.
- Relatórios executivos: margem por procedimento/profissional/convênio, ponto de equilíbrio, custo por consulta, DSO por convênio.
- Copiloto do BPO e alertas proativos completos.

### Depois (não entra neste plano)
NFS-e própria (hoje via Nibo), Open Finance, carnê-leão do PF, cobrança Pix/boleto registrada, exportação contábil em layout de importação.

---

## 7. Próximos passos imediatos (Fase 1)

### 7.1 Migrations (Prisma, em ordem)

| # | Migration | Conteúdo |
|---|---|---|
| 1 | `2026120X0100_fin_tenancy` | `fin_escritorios`, `fin_membros`, `fin_entidades`, `fin_entidade_acessos` (+ RLS) |
| 2 | `2026120X0200_fin_cadastros` | `fin_plano_contas`, `fin_centros_custo`, `fin_profissionais`, `fin_contrapartes`, `fin_contas_bancarias` (+ RLS) |
| 3 | `2026120X0300_fin_titulos` | `fin_titulos`, `fin_titulo_rateios`, `fin_parcelas`, `fin_recorrencias` (+ índices, + RLS) |
| 4 | `2026120X0400_fin_movimentos` | `fin_movimentos` + **trigger append-only** + `fin_auditoria` (append-only) |
| 5 | `2026120X0500_fin_fechamento_base` | `fin_fechamentos_mensais` + **trigger de período fechado** em títulos e movimentos |
| 6 | `2026120X0600_fin_integracoes` | `fin_integracoes` (token cifrado; entra na trava de segredos do CI) |
| seed | `scripts/fin-seed-plano-padrao.ts` | plano de contas modelo Sinergia ([§4.5](#45-plano-de-contas-padrão-para-clínicas-modelo-sinergia)); **o usuário roda**, como nos outros scripts |

Todas as tabelas novas são aditivas: nenhuma tabela "quente" (`Message`, `Contact`, `Appointment`) muda, então **não há risco de quebrar leituras com migration pendente**. Mesmo assim, aplicar logo após o merge.

### 7.2 Regras puras (TDD, `src/lib/fin/*.ts` + `*.test.ts`)

`money.ts` (centavos, arredondamento de parcela: a diferença vai na última) · `installments.ts` (parcelas de cartão com MDR e D+N em dia útil) · `balance.ts` (saldo, estorno, transferência) · `allocation.ts` (rateio soma 100%) · `period-lock.ts` · `aging.ts` (faixas por tipo de devedor) · `cashflow.ts` (realizado + projetado semanal) · `agenda-to-receivable.ts` (atendimento → título, idempotência) · `fin-permissions.ts`.

### 7.3 Server Actions (`src/actions/fin/*.ts`)

| Arquivo | Ações |
|---|---|
| `entities.ts` | `listMyFinEntities`, `createFinEntity`, `linkEntityToClinic`, `grantEntityAccess` |
| `chart.ts` | `listChartOfAccounts`, `cloneDefaultChart`, `upsertAccount`, `upsertCostCenter` |
| `parties.ts` | `searchParties`, `upsertParty`, `upsertProfessional`, `upsertBankAccount` |
| `titles.ts` | `listTitles` (filtros: natureza, status, vencimento, contraparte), `createTitle` (com rateio e parcelas), `updateTitle` (só sem baixa; `versao`), `cancelTitle`, `approvePayment` |
| `settlements.ts` | `settleInstallment` (baixa com juros/multa/desconto/taxa), `reverseMovement` (estorno), `transferBetweenAccounts` |
| `recurrences.ts` | `upsertRecurrence`, `generateRecurringTitles` |
| `reports.ts` | `getCashFlow` (semana/mês, realizado × previsto), `getAging`, `getAccountBalances` |

### 7.4 Route Handlers (`src/app/api/**`)

| Rota | Uso |
|---|---|
| `GET /api/cron/fin-sync-agenda` | de hora em hora: atendimentos concluídos (marketplace + pontes) → títulos a receber |
| `GET /api/cron/fin-recorrencias` | diário: gera títulos recorrentes do mês |
| `GET /api/cron/fin-aging` | diário: atualiza faixas e cria tarefas/alertas |
| `GET /api/fin/export/titulos.csv` | exportação para o contador (só-leitura) |
| Ponte (Express, Fase 2) | `GET /api/financeiro/titulos?desde=` e `GET /api/financeiro/baixas?desde=` na ponte Santa Clara (só leitura de `CPR1/CPR2/CPR3`) |

### 7.5 Telas da Fase 1

`/clinic/financeiro` (deixa de redirecionar para Relatórios quando a clínica tem entidade financeira): Resumo · A receber · A pagar · Fluxo de caixa · Cadastros. `/bpo`: carteira (lista de entidades + semáforo simples). Padrão visual "vidro" (DESIGN.md §5), testado via branch `design/*` + preview da Vercel.

---

## 8. Decisões aprovadas (28/11/2026)

| # | Decisão | Resposta |
|---|---|---|
| 1 | Stack | **Mesma stack** (Next.js + Server Actions + Prisma) |
| 2 | Tenancy escritório → entidade | **Aprovado** |
| 3 | Login do escritório | **`UserRole.BPO`** |
| 4 | Fonte da verdade por entidade | **Aprovado, com mudança de rumo: deixar de usar o Nibo** e fazer tudo no Conecta. O Nibo vira fonte só durante a transição. Funcionalidades a trazer: `docs/analise-nibo-funcionalidades.md` |
| 5 | Primeira entrega | **Começar pela leitura do Nibo** |
| 6 | Nomes das tabelas | **Português com `fin_`** |
| 7 | Clínicas com ERP | **Financeiro fica no ERP delas**; o Conecta puxa o necessário. **Começar pelas áreas gerenciais**, depois o BPO |

Mudança no [§7](#7-próximos-passos-imediatos-fase-1): as migrations de títulos, parcelas e movimentos continuam valendo, mas na Fase 1 são preenchidas **só por importação** (origem `NIBO` ou `ERP`, somente leitura). As telas de lançamento, baixa e estorno passam para a Fase 2.

### Texto original das decisões (para histórico)

1. **Stack**: seguir Next.js + Server Actions + Prisma (o que existe), e não Express/EJS. *Recomendado: sim.*
2. **Nível de tenant novo** (`fin_escritorios` → `fin_entidades`) em vez de esticar `clinics`. *Recomendado: sim.*
3. **Login do escritório**: novo `UserRole.BPO` (mais limpo) ou `CLINIC` sem `clinicId` (menos mudança). *Recomendado: `BPO`.*
4. **Fonte da verdade por entidade** (`CONECTA | NIBO | ERP`), com importados só-leitura. *Recomendado: sim; Sinergia começa em `NIBO`.*
5. **Primeira entrega**: Fase 1 como descrita **ou** começar pela leitura do Nibo + DRE + carteira (valor imediato para a Sinergia, sem livro-razão próprio ainda). *Recomendado: começar pela leitura do Nibo, porque os clientes atuais já estão lá, e fazer o livro-razão Conecta em seguida para quem não usa Nibo.*
6. **Nomes das tabelas** em português com prefixo `fin_` (pedido) × inglês como o resto do banco. *Recomendado: português com `fin_`, como pedido; os models do Prisma ficam `FinTitulo` etc.*
7. **Santa Clara**: o financeiro dela fica no ERP (fonte `ERP`, só leitura). Confirmar com a clínica.

## 9. Riscos e cuidados

- **LGPD**: dado financeiro + dado de saúde (procedimento, convênio) do paciente. O título guarda só o vínculo com `contact_clinic_profiles` e a descrição genérica ("Consulta"), nunca diagnóstico. A exclusão do titular já existente precisa anonimizar a contraparte PACIENTE. O termo com a clínica e a Sinergia precisa citar a TIVDC.
- **Não é contabilidade fiscal**: a DRE é gerencial; balanço, SPED e obrigações seguem com o contador.
- **Sem conselho de investimento**: diagnósticos falam de gestão (custo, prazo, margem), nunca de aplicação financeira.
- **Desempenho na Vercel**: crons de sincronização por entidade em lotes (limite de tempo da função); conciliação por agrupamento limitada (N ≤ 30).
- **Dependência do Nibo**: sem webhook financeiro e sem limite de requisições documentado. A sincronização é incremental e com recuo exponencial.

---

*Referências lidas: `openaccountant/skills` (business: profit-loss, month-end-close, invoice-aging, multi-entity, contractor-tracking, cash-flow-forecast) · `alirezarezvani/claude-skills` (finance/skills/month-end-close: SKILL, reconciliation_standards, flux_analysis_and_materiality, reconciliation_matcher.py; financial-analyst: budget_variance_analyzer.py, forecasting-best-practices) · `get-zeked/finance-super-skill` (SKILL.md: reconciliação, fechamento, variação, anomalias, documentos).*
