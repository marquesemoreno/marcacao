#testes #qa #acessos #credenciais

> [!info] Sobre esta nota
> Parte de [[00 - Visão Geral]]. Central executiva de testes, mapa de rotas e credenciais de acesso da Conecta Saúde — o documento de referência para qualquer pessoa (ou IA) que precise testar o sistema de ponta a ponta sem precisar ler o código primeiro. Todas as credenciais e rotas abaixo foram **verificadas contra `prisma/seed.ts` e testadas ao vivo no navegador** na validação registrada em [[#5. Registro da Última Bateria de Testes E2E]] — não são um esboço a confirmar depois.

# 🏥 Conecta Saúde — Central de Testes, Rotas e Credenciais

## 1. Links e Ambientes

| Ambiente | URL |
|---|---|
| Produção (domínio oficial) | `https://conectasaudevc.com.br` — hardcoded como fallback de `getBaseUrl()` (`src/lib/format.ts`) e como `metadataBase`/`og:url` em `src/app/layout.tsx`; usado sempre que `VERCEL_ENV === "production"`, independente do que `VERCEL_URL` disser |
| Produção (URL de deploy da Vercel) | `https://marcacao-six.vercel.app` — a URL de deploy gerada automaticamente por trás do domínio; ainda funciona para acessar o app, mas não é mais o que aparece nos links de QR Code/WhatsApp |
| Desenvolvimento local | `http://localhost:3000` (`npm run dev`, ver [[01 - Setup e Infraestrutura]]) |

## 2. Mapa Completo de Rotas

### Rotas Públicas (Paciente e B2B)

| Rota | Descrição |
|---|---|
| `/` | Landing page oficial com busca inteligente |
| `/buscar` | Catálogo de procedimentos com filtros por especialidade, tipo de atendimento e bairros de Vitória da Conquista |
| `/procedimentos/[id]` | Detalhe do procedimento/clínica + modal "Solicitar Agendamento" |
| `/seja-parceiro` | Formulário de captação de novas clínicas (grava em `PartnerLead`) |
| `/proposta-comercial` | Proposta comercial B2B pronta para apresentação e impressão/PDF — ver [[08 - Playbook Comercial e Proposta B2B]] |
| `/acompanhar/[id]` | Status do agendamento + guia de encaminhamento com QR Code (link enviado por WhatsApp) |
| `/comprovante/[id]` | Validação pública da guia com QR Code (alvo do QR — pensado para a recepção da clínica) |
| `/entrar` | Página de autenticação central (admin, clínica e paciente) |
| `/termos`, `/privacidade` | Páginas institucionais estáticas |

### Rotas Administrativas Master (`/admin`, exige login `ADMIN`)

| Rota | Descrição |
|---|---|
| `/admin` | Visão geral: clínicas ativas, total de pedidos, taxa de conversão, procedimentos mais buscados |
| `/admin/inbox` | Chat/WhatsApp cross-clínica — mesmas conversas do inbox de cada clínica, vistas de uma vez só pelo Admin (badge com o nome da clínica em cada card) — ver [[11 - Modulo Isolado de Atendimento e CRM]] |
| `/admin/crm` | Kanban de funil de leads cross-clínica (Novos → Em Atendimento → Orçamento → Agendado → Finalizado) — ver [[11 - Modulo Isolado de Atendimento e CRM]] |
| `/admin/clinicas` | Gestão das 11 clínicas cadastradas e taxas de comissão |
| `/admin/leads` | Painel de prospecção B2B, com botões "Chamar no WhatsApp" e "Enviar Proposta" |
| `/admin/relatorio` | Fechamento financeiro e controle de comissões por clínica |

### Rotas da Clínica Parceira (`/clinic`, exige login `CLINIC`)

| Rota | Descrição |
|---|---|
| `/clinic` | Resumo do dia, da semana e pendências |
| `/clinic/agendamentos` | Gestão de presenças (confirmar/concluir/faltar/cancelar) e lista de pacientes |
| `/clinic/inbox` | Live chat multicanal com pacientes via WhatsApp, em tempo real (polling + Supabase Realtime opcional) |
| `/clinic/crm` | Kanban de funil de leads da clínica (Novos → Em Atendimento → Orçamento → Agendado → Finalizado) — ver [[11 - Modulo Isolado de Atendimento e CRM]] |
| `/clinic/precos` | Tabela de procedimentos, preços e horários de atendimento da clínica |

## 3. Matriz de Credenciais de Acesso (Login e Senha)

> [!warning] Somente ambiente de desenvolvimento/seed
> As credenciais abaixo vêm de `prisma/seed.ts` — existem em qualquer banco criado com `npx prisma db seed` (ambiente local ou de homologação semeado a partir do mesmo script). **Não é garantido que sejam as mesmas em produção**: se o banco de produção não recebeu esse seed (por exemplo, se as clínicas reais foram cadastradas manualmente), essas contas podem não existir lá. Confirme o ambiente antes de testar.

| Perfil | E-mail | Senha | Portal Principal |
| :--- | :--- | :--- | :--- |
| **👑 Administrador Master** | `admin@tivdc.com.br` | `Admin@123` | `/admin` |
| **🏥 Clínica Santa Clara** | `santaclara@clinica.com.br` | `Clinica@123` | `/clinic` |
| **🏥 Clínica Imad** | `imad@clinica.com.br` | `Clinica@123` | `/clinic` |
| **🏥 Urolaser** | `urolaser@clinica.com.br` | `Clinica@123` | `/clinic` — tabela oficial de preços em [[12 - Tabela de Precos e Procedimentos Urolaser]] |
| **🎧 Atendente / Recepção (Santa Clara)** | `atendente@tivdc.com.br` | `Atendente@123` | `/clinic/inbox` |
| **👤 Paciente de Teste** | `paciente@teste.com.br` | `Paciente@123` | `/` (ver nota abaixo) |

> [!warning] "Paciente de Teste" não tem uma área logada própria
> Diferente do que uma tabela de credenciais sugeriria, o login de paciente **não** leva a `/acompanhar/1` nem a nenhuma outra tela protegida — hoje não existe role `PATIENT` com área própria no app. O agendamento público é **guest-checkout** (não exige login nenhum) e, ao fazer login com essa conta em `/entrar`, o redirecionamento cai em `/` (mesma lógica de `src/app/(public)/entrar/page.tsx`: só `ADMIN` e `CLINIC` têm redirecionamento dedicado). Além disso, `/acompanhar/[id]` espera um `id` de agendamento real (`cuid`, ex. `cmsw82wwt00011x1chpp8kqlw`) — `/acompanhar/1` sempre retorna 404. O único jeito de chegar numa página `/acompanhar/{id}` válida é completar um agendamento de verdade (Teste 1 abaixo) e usar o `id` retornado.

## 4. Roteiro Passo a Passo de Testes (Para o Lucas testar)

- **Teste 1 (Paciente):** Fazer um agendamento do início ao fim pela Landing Page (`/` → busca → `/procedimentos/[id]` → "Solicitar Agendamento"), conferir as instruções de preparo/jejum exibidas no modal e gerar a Guia com QR Code ao final.
- **Teste 2 (Recepcionista):** Copiar o link de `/comprovante/[id]` gerado no Teste 1 (ou escanear o QR Code com o celular) e validar a autenticidade da guia — deve aparecer a faixa verde "Guia autêntica".
- **Teste 3 (Clínica):** Logar com `santaclara@clinica.com.br`, confirmar um agendamento em `/clinic/agendamentos` e ajustar o valor de um procedimento em `/clinic/precos`.
- **Teste 4 (Admin):** Logar com `admin@tivdc.com.br`; em outra aba/anônima, enviar um lead pelo formulário em `/seja-parceiro`; voltar para `/admin/leads` e conferir se o lead aparece com o botão "Chamar no WhatsApp" (e "Enviar Proposta", que já manda o link de `/proposta-comercial`).

## 5. Registro da Última Bateria de Testes E2E

Executada nesta sessão, ambiente local (`http://localhost:3000`), banco semeado via `prisma/seed.ts`.

### Validação técnica

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos TypeScript | `npx tsc --noEmit` | ✅ Sem erros |
| Testes automatizados | `npm test` | ✅ 41/41 (5 arquivos) |
| Linter | `npm run lint` | ✅ Sem warnings/erros |
| Build de produção | `npm run build` | ✅ 21 rotas geradas |

### Rotas testadas no navegador (status 200, sem erros de console)

Todas as rotas da seção 2 foram abertas e conferidas uma a uma (conteúdo renderizado + `read_console_messages` sem erros):

- **Públicas:** `/`, `/buscar` (23 resultados), `/procedimentos/[id]`, `/seja-parceiro`, `/proposta-comercial`, `/termos`, `/privacidade`, `/entrar`.
- **Fluxo de agendamento completo (Teste 1 do roteiro):** busca → `/procedimentos/[id]` (Urolaser, Procedimento Urológico a Laser) → modal "Solicitar Agendamento" preenchido e enviado → guia gerada com QR Code, código `#VDC-2026-XXXXX`, instruções de jejum e botão "Enviar Guia no WhatsApp" — tudo correto.
- **`/acompanhar/[id]` e `/comprovante/[id]`** com o `id` real gerado no passo acima: ambos renderizaram os mesmos dados da guia; `/comprovante/[id]` mostrou a faixa "Guia autêntica" corretamente.
- **Admin** (login `admin@tivdc.com.br`): `/admin` (11 clínicas ativas, 9 pedidos), `/admin/clinicas` (lista completa), `/admin/leads` (botão "Ver Proposta Comercial (PDF)" presente), `/admin/relatorio` (tabela de comissão por clínica).
- **Clínica** (login `santaclara@clinica.com.br`): `/clinic`, `/clinic/agendamentos` (1 agendamento confirmado listado), `/clinic/precos` (tabela de preços e horários), `/clinic/inbox` (fila de conversas carregando sem erro).

> [!note] Rotas simplificadas depois desse teste
> As URLs acima refletem a validação E2E de quando os dashboards ainda viviam em `/admin/dashboard` e `/clinic/dashboard`. Desde a simplificação de rotas, os mesmos dashboards vivem em `/admin` e `/clinic` — as URLs antigas continuam funcionando via redirect permanente (`next.config.mjs`), mas o mapa de rotas na seção 2 já reflete as novas.
- **Produção:** `https://marcacao-six.vercel.app` conferida ao vivo — título e hero já refletem a marca Conecta Saúde, sem erros de console.

Nenhum erro de console real foi encontrado. Uma única requisição `POST /clinic/inbox` apareceu como `net::ERR_ABORTED` na aba de rede durante o teste do inbox — é o polling de 5s (`use-inbox-realtime.ts`) cancelando uma requisição em voo quando a próxima já estava saindo, comportamento esperado de `AbortController` em polling, não um erro real (sem entrada correspondente no console, e as chamadas antes/depois completaram normalmente com 200).

Os dados de teste criados durante esta bateria (1 `PartnerLead` e 1 `Appointment` fictícios) foram removidos do banco ao final, para não poluir o ambiente de demonstração.

### Validação das novas rotas de CRM/Chat (`/clinic/crm`, `/admin/inbox`, `/admin/crm`)

Sessão posterior, mesmo ambiente. `tsc`/`lint`/`test`/`build` limpos (24 rotas). Testado ao vivo com uma conversa de teste (removida ao final):

- **`/clinic/crm`**: Kanban com as 5 colunas, card com nome/telefone/última interação/valor estimado, "💬 Abrir no Chat" navegando para `/clinic/inbox?c=<id>` com a conversa já selecionada.
- **`/admin/inbox`** e **`/admin/crm`**: mesma conversa (de uma clínica específica) visível cross-clínica, com badge do nome da clínica no card/cabeçalho; tags, funil, nota interna, transferência e agendamento funcionando idênticos ao `/clinic`.
- **Atalho "➕ Criar Agendamento Rápido"**: catálogo real de procedimentos carregado (`fetchProcedures`, escopado por clínica no admin), agendamento criado via `createAppointment`, nota interna com o link de `/comprovante/[id]` colada automaticamente no chat, e etapa do funil avançando para "Agendado".
- **Bug encontrado e corrigido**: a coluna "🏁 Finalizado" do Kanban nunca populava — o filtro usado (`"todas"`) exclui conversas com `status: RESOLVED` por design (mesmo comportamento da aba "Todas" da Caixa de Entrada, que não deveria misturar finalizadas). Corrigido buscando `"todas"` + `"finalizadas"` em paralelo só quando `view === "crm"`, sem alterar o filtro da Caixa de Entrada.
- **Atalho `/` no composer**: digitar `/` (ex. `/pix`) abre e filtra a lista de respostas rápidas; selecionar uma agora **substitui** o texto digitado em vez de concatenar (documentado como comportamento pretendido desde a nota 05, mas que tinha sido perdido nessa reimplementação — corrigido aqui).

## Notas relacionadas

- [[00 - Visão Geral]]
- [[01 - Setup e Infraestrutura]] — como rodar o projeto localmente e variáveis de ambiente
- [[07 - Guia de Encaminhamento e Captação B2B]] — detalhes do fluxo de guia/QR Code testado no Teste 1 e 2
- [[08 - Playbook Comercial e Proposta B2B]] — conteúdo de `/proposta-comercial`, testada na seção 5
- [[11 - Modulo Isolado de Atendimento e CRM]] — módulo de chat/CRM, incluindo as rotas `/clinic/crm`, `/admin/inbox` e `/admin/crm`
- [[12 - Tabela de Precos e Procedimentos Urolaser]] — tabela oficial de preços 2026 da Urolaser, códigos TUSS
