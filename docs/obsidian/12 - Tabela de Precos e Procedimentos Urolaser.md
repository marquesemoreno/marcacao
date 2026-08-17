#urolaser #tabela-precos #tuss #catalogo

> [!info] Sobre esta nota
> Parte de [[00 - Visão Geral]]. Documenta a tabela oficial de procedimentos e preços 2026 da **Urolaser - Clínica de Urologia e Diagnóstico**, cadastrada em `prisma/seed.ts` (array `urolaserProceduresData` + o bloco correspondente em `clinicProceduresData`). Ligada a [[02 - Dicionário de Dados e Banco]] (modelos `Procedure`/`ClinicProcedure`) e a [[04 - Manual de Edição Manual e Manutenção]] (como editar preços fora do seed, pelo painel `/clinic/precos`).

## Dados da clínica

| Campo | Valor |
|---|---|
| Nome (tradeName) | Urolaser - Clínica de Urologia e Diagnóstico |
| Endereço | Av. Otávio Santos, 145, Recreio, Vitória da Conquista - BA |
| Telefone | (77) 3422-1010 |
| WhatsApp | (77) 98800-1010 |
| Login da clínica | `urolaser@clinica.com.br` / `Clinica@123` |

> [!note] `name` (razão social) não mudou
> O campo `Clinic.tradeName` (nome público, exibido em toda a plataforma) foi atualizado para o nome completo pedido. O campo `Clinic.name` (razão social, usada só internamente/no CNPJ) permanece "Urolaser Serviços Urológicos Ltda" — não fazia parte do pedido e não aparece em nenhuma tela do paciente.

## Sobre os códigos TUSS: confirmados vs. pendentes

> [!danger] Nem todo código TUSS abaixo foi confirmado contra a tabela oficial da ANS
> Os códigos marcados **✅ Confirmado** vêm de busca na web com uma fonte única e sem divergência entre as referências consultadas (páginas de convênios, iClinic, Código TUSS). Os marcados **⚠️ Pendente** são procedimentos reais da Urolaser, mas o código de faturamento TUSS específico não foi possível confirmar com segurança — ficaram `null` no banco (`Procedure.tussCode`) em vez de um número inventado. **Antes de usar qualquer um desses códigos numa guia TISS real, o setor de faturamento da clínica deve confirmar contra a tabela vigente da ANS/operadora.** Nunca cobre um convênio com um código não confirmado.

## Consultas

| Procedimento | Especialidade | TUSS | Particular | Parceiro Conecta Saúde |
|---|---|---|---|---|
| Consulta - Urologia | Urologia | ✅ 10101012 | R$ 250,00 | R$ 200,00 |
| Consulta - Ginecologia | Ginecologia | ✅ 10101012 | R$ 250,00 | R$ 200,00 |
| Consulta - Endocrinologia | Endocrinologia | ✅ 10101012 | R$ 300,00 | R$ 250,00 |
| Consulta - Proctologia | Proctologia | ✅ 10101012 | R$ 350,00 | R$ 320,00 |
| Consulta - Nutrição c/ Bioimpedância | Nutrição | ⚠️ Pendente | R$ 300,00 | R$ 250,00 |
| Consulta - Cirurgia Pediátrica | Cirurgia Pediátrica | ✅ 10101012 | R$ 290,00 | R$ 240,00 |
| Consulta - Pré-Anestésica | Anestesiologia | ✅ 10101012 | R$ 250,00 | R$ 200,00 |
| Consulta - Obstétrica | Obstetrícia | ✅ 10101012 | R$ 300,00 | R$ 250,00 |

> [!note] Por que a mesma consulta médica usa sempre o TUSS 10101012
> A tabela TUSS não tem um código de consulta separado por especialidade — `10101012` ("Consulta em consultório, no horário normal ou preestabelecido") é universal para qualquer especialidade médica. A especialidade é identificada em outro campo da guia TISS (CBO do profissional), não no código do procedimento. A consulta de Nutrição fica pendente porque nutricionista não é médico — o código correto pertence a outra tabela (serviços auxiliares), não confirmado nesta pesquisa.

## Procedimentos Urológicos

| Procedimento | TUSS | Particular | Parceiro Conecta Saúde | Preparo |
|---|---|---|---|---|
| Biópsia de Próstata Local | ✅ 40902030 | R$ 1.500,00 | R$ 1.300,00 | Preparo intestinal + antibiótico profilático (orientação médica). Vir acompanhado. |
| Biópsia Endoscópica Bexiga | ⚠️ Pendente | R$ 750,00 | R$ 700,00 | Jejum de 6h. Trazer exames de imagem recentes. |
| Biópsia Peniana | ⚠️ Pendente | R$ 600,00 | R$ 550,00 | — |
| Cistoscopia | ⚠️ Pendente | R$ 650,00 | R$ 590,00 | Bexiga vazia, sem jejum. |
| Dilatação Uretral | ✅ 31102085 | R$ 650,00 | R$ 590,00 | — |
| Urodinâmica Completa | ⚠️ Pendente | R$ 650,00 | R$ 590,00 | Vir com a bexiga cheia (sem urinar 2h antes). |
| Urofluxometria | ⚠️ Pendente | R$ 150,00 | R$ 130,00 | Vir com vontade de urinar. |
| Peniscopia | ⚠️ Pendente | R$ 300,00 | R$ 250,00 | — |
| Retirada Duplo J | ✅ 31103472 | R$ 650,00 | R$ 590,00 | Jejum de 6h. |
| Eletrocoagulação | ⚠️ Pendente | R$ 500,00 | R$ 450,00 | — |
| USG Próstata Abdominal | ✅ 40901173 | R$ 160,00 | R$ 130,00 | Bexiga cheia (beber água, não urinar 1h antes). |
| USG Próstata Transretal | ✅ 40901335 | R$ 160,00 | R$ 130,00 | Enema (lavagem intestinal) 2h antes. |
| USG Testicular com Doppler | ✅ 40901203 † | R$ 230,00 | R$ 200,00 | — |
| USG Testicular simples | ✅ 40901203 | R$ 150,00 | R$ 120,00 | — |
| Cateterismo Vesical | ⚠️ Pendente | R$ 350,00 | R$ 300,00 | — |
| Exérese de Lesão/Tumor | ⚠️ Pendente | R$ 1.000,00 | R$ 900,00 | — |

> † USG Testicular **com Doppler** soma o código base (`40901203`, US de bolsa escrotal) com o complemento `40901386` (Doppler colorido de órgão/estrutura isolada) na guia — não é um código único combinado. Só o código base foi salvo em `Procedure.tussCode` (limitação de um campo por procedimento).

## Procedimentos Ginecológicos

| Procedimento | TUSS | Particular | Parceiro Conecta Saúde | Preparo |
|---|---|---|---|---|
| Preventivo com Colposcopia | ✅ 41301102 | R$ 160,00 | R$ 140,00 | Evitar relações, duchas e cremes vaginais 48h antes. Não agendar na menstruação. |
| PCR HPV Genotipagem 28 tipos | ⚠️ Pendente | R$ 500,00 | R$ 460,00 | — |
| Biópsia Colo Uterino | ✅ 31303021 | R$ 250,00 | R$ 200,00 | — |
| USG Transvaginal | ✅ 40901300 | R$ 160,00 | R$ 140,00 | Bexiga vazia. |
| USG Obstétrica | ⚠️ Pendente | R$ 160,00 | R$ 140,00 | 1º trimestre: bexiga cheia (a critério médico). |
| USG Abdome Inferior | ✅ 40901181 | R$ 160,00 | R$ 140,00 | Bexiga cheia. |
| Check-up Ginecológico Completo | ⚠️ Pacote (n/a) | R$ 500,00 | R$ 450,00 | Consulta + preventivo + USG transvaginal em um só atendimento — não é um procedimento único cobrável, e sim um pacote comercial da clínica. |

## Cirurgias / Procedimentos com Anestesia Local

| Procedimento | TUSS | Particular | Parceiro Conecta Saúde | Preparo |
|---|---|---|---|---|
| Vasectomia Local | ✅ 31205046 † | R$ 3.500,00 | R$ 3.000,00 | Jejum de 6h. Vir acompanhado, com cueca justa para depois. |
| Postectomia Local | ✅ 31206220 † | R$ 3.500,00 | R$ 3.000,00 | Jejum de 6h. Vir acompanhado. |
| Implante DIU Mirena/Kyleena | ✅ 31303293 | R$ 2.300,00 | R$ 2.100,00 | Preferencialmente na menstruação. Dispositivo **não incluso** no valor — comprado à parte em farmácia. |
| Implanon | ⚠️ Pendente | R$ 2.000,00 | R$ 1.800,00 | Dispositivo **não incluso** no valor. |
| DIU de Cobre | ✅ 31303269 | R$ 700,00 | R$ 600,00 | Preferencialmente na menstruação. Dispositivo **não incluso** no valor. |

> † Vasectomia e Postectomia têm códigos divergentes entre fontes consultadas (ex. `31205046`/`31005098` para vasectomia, `31206220`/`31005047` para postectomia) — provavelmente reflexo de revisões diferentes da tabela TUSS ao longo do tempo. Usado o formato de 8 dígitos (padrão TUSS atual); confirmar o vigente com a operadora antes de faturar.

## Psicologia e Outros

| Procedimento | TUSS | Particular | Parceiro Conecta Saúde |
|---|---|---|---|
| Sessão Psicoterapia | ⚠️ Fora do escopo TUSS-médico | R$ 250,00 | R$ 200,00 |
| Pacote 4 Sessões de Psicoterapia | ⚠️ Pacote (n/a) | R$ 700,00 | R$ 650,00 |
| Aplicação de Injeção | ⚠️ Pendente | R$ 50,00 | R$ 50,00 (sem desconto) |
| Bioimpedância | ⚠️ Pendente | R$ 160,00 | R$ 120,00 |

> [!note] Psicoterapia não usa a tabela TUSS de procedimentos médicos
> Psicólogo não é médico — sessões de psicoterapia são faturadas por uma tabela própria (Conselho Federal de Psicologia / convênios específicos), fora do escopo desta pesquisa de códigos TUSS-médicos. "Pacote 4 Sessões" e "Check-up Ginecológico Completo" são pacotes comerciais da própria clínica (várias entregas por um preço fechado), não procedimentos únicos — não têm código TUSS por definição.

## Como isso foi cadastrado

Tudo entra pelo array `urolaserProceduresData` em `prisma/seed.ts` (38 procedimentos novos — as duas consultas de Urologia e Ginecologia já existiam no catálogo geral, reaproveitadas) e o bloco correspondente em `clinicProceduresData` (40 vínculos `ClinicProcedure` com `price`/`promotionalPrice`). O campo `Procedure.tussCode` (novo, migração `add_procedure_tuss_code`, `String?` — aditivo, não quebra nenhum procedimento existente de outras clínicas) guarda os códigos confirmados.

> [!warning] `npx prisma db seed` apaga e recria o banco inteiro
> `prisma/seed.ts` começa com `deleteMany()` em todas as tabelas antes de repopular (ver comentário no topo do arquivo) — é assim desde que o seed foi criado, pensado para um ambiente de demonstração, não para produção com dados reais. Antes de rodar o seed para cadastrar a Urolaser, foi conferido que o banco (o mesmo `DATABASE_URL` de produção, ligado a `conectasaudevc.com.br`) não tinha nenhum agendamento/conversa real além dos dados de demonstração já conhecidos — só então o seed foi executado. Se um dia houver agendamentos reais de pacientes nesse banco, **rodar `npx prisma db seed` de novo vai apagá-los** — nesse ponto, editar preços deve passar a ser feito só pelo painel `/clinic/precos` (ver [[04 - Manual de Edição Manual e Manutenção]]) ou por uma migração de dados não-destrutiva, nunca mais pelo seed completo.

## Novas especialidades cadastradas

Para suportar as consultas da Urolaser, seis especialidades novas entraram em `specialtiesData`: Endocrinologia, Proctologia, Nutrição, Cirurgia Pediátrica, Anestesiologia e Obstetrícia — antes só existiam Clínica Geral, Cardiologia, Urologia, Cirurgia Geral, Ginecologia e Ortopedia.

## Notas relacionadas

- [[00 - Visão Geral]]
- [[02 - Dicionário de Dados e Banco]] — modelos `Procedure`, `ClinicProcedure`, `Clinic`
- [[04 - Manual de Edição Manual e Manutenção]] — como editar preços/procedimentos fora do seed
- [[10 - Central de Testes e Acessos]] — credenciais de todas as clínicas, incluindo Urolaser
