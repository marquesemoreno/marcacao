# Levantamento da API do Nibo (25/11/2026)

Fonte: documentação oficial em https://nibo.readme.io (o antigo developer.nibo.com.br redireciona para lá). Lida em 25/11/2026.
Pontos marcados com ⚠️ não foram confirmados e precisam de teste com um token real.

---

## 1. Resumo

O Nibo tem **duas APIs**:

| API | Para quem | Base | Serve para a Sinergia? |
|---|---|---|---|
| **Nibo Empresa** | a empresa (cliente do BPO) | `https://api.nibo.com.br/empresas/v1/` | **Sim, é a principal.** Contas a pagar/receber, extrato, saldo, conciliação, categorias, centros de custo, NFS-e, cobranças. |
| **Nibo Obrigações** | escritório contábil | `https://api.nibo.com.br/accountant/api/v1/accountingfirms/{id}` | Pouco: tarefas, processos, obrigações fiscais, documentos e atendimentos do escritório. **Não tem dados financeiros.** |

**Conclusão:** dá para ler praticamente tudo o que o BPO lança no Nibo e também escrever (agendar contas, baixar, anexar arquivos, emitir NFS-e). Não há DRE pronta nem webhook financeiro, então **nós calculamos os indicadores** e **buscamos os dados periodicamente** (cron).

## 2. Requisitos e acesso

- **Plano Premium do Nibo** é exigido para a API Empresa. Confirmar o plano de cada cliente.
- **Um token por empresa (cliente).** Gerado em *Empresa › Mais opções › Configurações › API*.
- Envio do token: cabeçalho `ApiToken: <token>` (ou `?apitoken=<token>` na URL, que **não** vamos usar para não vazar em logs).
- **Sem OAuth e sem sandbox.** Testes precisam de uma empresa de teste no próprio Nibo.
- ⚠️ Limite de requisições (rate limit) não está documentado.
- O token dá acesso total à empresa: guardar **cifrado**, como já fazemos com os segredos de integração.

## 3. O que dá para ler

| Área | Operações |
|---|---|
| Contas a pagar | pagamentos agendados, vencidos, em aberto |
| Contas a receber | recebimentos agendados, vencidos, em aberto |
| Realizado | pagamentos e recebimentos efetuados; todos os agendamentos |
| Bancos | contas, bancos, **saldo**, **extrato** (por conta e período), transferências |
| Conciliação | listar conciliações |
| Cadastros | clientes, fornecedores, funcionários, sócios |
| Classificação | **categorias** (com grupos e hierarquia), **centros de custo** |
| Documentos | arquivos e anotações de cada agendamento |
| Fiscal | NFS-e emitidas, perfis de serviço |
| Cobrança | perfis de cobrança, cobranças, parcelamentos |
| Planejamento | planejamento orçamentário (relatório) |
| Outros | empresas e usuários com acesso; agendamentos por contato |

## 4. O que dá para escrever

- Agendar, criar, atualizar e excluir **pagamentos e recebimentos**; **baixar** um agendado (pagar/receber).
- Criar, atualizar e excluir clientes, fornecedores, funcionários, sócios, **categorias**, **centros de custo**, contas.
- Criar e excluir transferências; excluir conciliação.
- **Enviar arquivos** e anexá-los a lançamentos; criar anotações.
- **Emitir e cancelar NFS-e.**
- Criar e cancelar cobranças.
- **Criar item na caixa de entrada** do Nibo.

⚠️ Os métodos HTTP e caminhos exatos de cada operação da API Empresa não foram confirmados (só vimos `/empresas/v1/schedules/debit` como exemplo). A divisão leitura × escrita acima vem dos nomes das operações.
⚠️ Não confirmamos se a API **cria** conciliação ou só lista e exclui.

## 5. Consultas e paginação

- Filtros no padrão **OData**: `$filter`, `$orderby`, `$top`, `$skip`.
  Ex.: `$filter=year(dueDate) eq 2026 and month(dueDate) eq 10`.
- Na API Empresa, **`$orderBy` é obrigatório para paginar** e cada página traz até **500 registros**; toda listagem devolve `count`.
- Na API Obrigações, até 100 por página.

## 6. Webhooks

- **Só na API Obrigações** (em beta para alguns escritórios), com eventos de tarefas, processos, documentos, clientes, certidões, Simples/PGDAS etc. **Nenhum evento financeiro.**
- A API Empresa **não tem webhook**: para saber de lançamento novo é preciso consultar de tempos em tempos.

## 7. O que isso significa para o nosso projeto

1. **Sincronização por cron** (ex.: a cada hora e no fechamento do dia) puxando agendamentos, realizados, saldo e extrato de cada cliente, com filtro por data de alteração ⚠️ (confirmar se existe campo de "atualizado em" para busca incremental).
2. **DRE e indicadores de saúde calculados por nós**, a partir das categorias e centros de custo do Nibo: margem por procedimento, repasse, convênio, glosa, custo por consulta. É aqui que entramos com valor.
3. **Plano de contas padrão Sinergia**: dá para criar as mesmas categorias e centros de custo em cada cliente novo pela API, padronizando a carteira.
4. **Caixa de entrada pelo WhatsApp**: o cliente manda foto do boleto, a IA lê, e nós criamos o lançamento agendado no Nibo com o arquivo anexado (ou "item na caixa de entrada" para o analista revisar). Isso usa o WhatsApp que já temos.
5. **Painel da carteira**: com um token por cliente, montamos o semáforo (vencidos, saldo projetado negativo, conciliação pendente) de todos os clientes num lugar só.
6. **NFS-e pelo Nibo**: o atendimento registrado na nossa Agenda/ponte pode disparar a emissão da nota pelo Nibo, sem integrar outro emissor.

## 8. Próximos passos

- [ ] Confirmar com o consultor se os clientes estão no **plano Premium**.
- [ ] Gerar um token numa **empresa de teste** (ou do primeiro cliente, com autorização dele) e testar: listar contas, saldo, extrato, categorias, agendamentos.
- [ ] Mapear os caminhos e campos reais (data de alteração, categoria, centro de custo, anexo).
- [ ] Medir o limite de requisições na prática.
- [ ] Incluir no termo de LGPD que a TIVDC acessa os dados do Nibo do cliente.

## Fontes

- https://nibo.readme.io/
- https://nibo.readme.io/llms.txt (índice das operações)
- https://nibo.readme.io/reference/como-utilizar-a-api.md
- https://nibo.readme.io/reference/acesso-e-token.md
- https://nibo.readme.io/reference/consultas-com-odata.md
- https://nibo.readme.io/reference/webhooks.md
- https://nibo.readme.io/reference/listar-escritórios.md
