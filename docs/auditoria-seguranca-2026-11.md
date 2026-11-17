# Auditoria de segurança — Conecta Saúde / MARCACAO

**Data:** 16/11/2026 · **Commit analisado:** `ee8ad09` (main) · **Método:** leitura do código + `npm audit --omit=dev`. Nada foi alterado, nenhum acesso a produção, nenhum login, nenhuma migration.

Nenhum valor de segredo aparece neste documento: só arquivo, linha e tipo.

---

## 1. Resumo

| Gravidade | Confirmados | Suspeitas a verificar |
|---|---|---|
| Crítico | 2 | 1 |
| Médio | 12 | 3 |
| Baixo | 16 | 3 |

Os três pontos que pedem ação primeiro:

1. **C1 — Agendamento sem login grava direto no sistema da clínica (Firebird) e envia WhatsApp pelo número dela.**
2. **C2 — Next.js 15.5.23 com avisos críticos no `npm audit`** (correção: atualizar dentro da mesma linha 15.5).
3. **S1 (suspeita, pode ser crítica) — cerca de 35 tabelas criadas depois de 15/09 não têm `ENABLE ROW LEVEL SECURITY` nas migrations.** Se o RLS não foi ligado à mão no Supabase, a chave pública (`anon`) que vai no navegador lê essas tabelas, inclusive `contact_clinic_profiles` (CPF, convênio) e `instagram_accounts` (token em texto puro). Uma consulta de leitura resolve a dúvida (seção 5).

O que está bem feito e vale registrar: as server actions do painel filtram por `clinicId` de forma consistente (helpers `assertClinicOwns…`, `updateMany({ id, clinicId })`); tokens de paciente, TV e senha têm 144–256 bits e ficam só como hash no banco; SQL cru é sempre parametrizado; não há `dangerouslySetInnerHTML`; o portão de IA mascara dados em texto e em argumentos de ferramenta e tem trava no CI; webhooks da Meta, Instagram e Resend conferem assinatura em tempo constante; todos os 15 crons exigem `CRON_SECRET`.

---

## 2. O que já tinha sido corrigido — continua corrigido

| Item (data) | Situação hoje |
|---|---|
| `isCronAuthorized` recusa `CRON_SECRET` ausente (19/10) | OK — `src/lib/request-auth.ts:12`; todos os arquivos em `src/app/api/cron/*/route.ts` chamam |
| Webhook Evolution com token e trava `WHATSAPP_WEBHOOK_ENFORCE` (10–11/11) | OK no código — `src/app/api/webhooks/whatsapp/route.ts:550-562`. Se a variável está ligada na Vercel não dá para ver daqui (ver S4) |
| Encaminhamento interno API oficial → automação com `x-internal-secret` (10/11) | OK — `route.ts:579-580` |
| Responsável de outra clínica mascarado / atribuição só para a própria clínica (19/10) | OK — `src/actions/inbox.ts:2317-2330` valida conversa e usuário pela clínica |
| `chatbot.ts` sem `"use server"`, `getAppointmentById` fora das actions (19/10) | OK — `src/lib/appointment-read.ts` |
| Painel do marcador e `/api/chat` desligados por padrão (11/11) | OK — `src/lib/public-features.ts`; conferido também dentro das actions (`affiliates.ts:48,78`) |
| Login: 5 erros/15 min, sessão de 12 h, 2FA, reset com token sha256 de 1 h, revogação por `sessionVersion` (07/11) | OK — `src/lib/auth.ts`, `src/lib/session.ts:15`, `src/actions/account.ts` |
| Logs do servidor com `errorSummary` (11/11) | OK na maioria; exceção em B2 |
| Portão de IA com máscara de PII e trava no CI (09/11) | OK — `src/lib/ai-gateway.ts`, `ai-gateway.guard.test.ts`. Todas as 14 chamadas de IA em `src/` passam por ele |
| Retenção: `webhook_logs` 60 dias, fichas 1 ano, cliques 90 dias | OK — `src/app/api/cron/data-retention/route.ts` |

---

## 3. Achados confirmados lendo o código

### Crítico

#### C1 — `createAppointment` é pública e escreve no Firebird da clínica

> **Corrigido no código em 16/11/2026 (ainda sem commit/deploy).** A action pública agora recusa id da ponte, só aceita catálogo de clínica ativa e listada, limita nome (120) e observação (1000) e tem freio de 3 pedidos/hora por telefone e 5/10 min por visitante. O painel (Chat, Agenda, Pacientes) usa a nova `createClinicAppointment`, que exige sessão e só agenda na clínica de quem está logado; a atendente virtual passa a clínica da conversa (`src/lib/appointment-create.ts`). Testes em `src/actions/appointments.guard.test.ts`. O texto abaixo descreve a situação anterior.
- **Onde:** `src/actions/appointments.ts:29-52` → `src/lib/hospital-bridge.ts:281-343` (POST `/api/agendamentos` da ponte) e `:360-378` (envio de WhatsApp).
- **O que é:** a action não pede sessão (é a mesma do agendamento público do marketplace). Quando `clinicProcedureId` vem no formato da ponte, o `clinicId` é tirado do próprio id enviado pelo navegador (`getBridgeClinicId`, `hospital-bridge.ts:37`) e a marcação é gravada no sistema hospitalar. O chamador também escolhe `patientId` (paciente já cadastrado no Firebird), `medicoId`, `convenioId`, data e hora.
- **Exploração em uma frase:** qualquer pessoa na internet chama a action do formulário público com `bridge:<id da clínica>:<serviço>` e enche a agenda real da clínica, amarra marcações a pacientes existentes e faz o número da clínica mandar WhatsApp para telefones à escolha, com o campo "nome" (sem tamanho máximo, `src/lib/schemas/appointment.ts:5-9`) dentro do texto.
- **Pré-condição:** conhecer o `clinicId`. As actions públicas de busca devolvem o registro inteiro da clínica (M12), então para clínica listada no marketplace ele é público. Ver S2.
- **Mesmo sem ponte:** o caminho do catálogo (`appointments.ts:59-83`) cria agendamento e dispara confirmação por WhatsApp para qualquer telefone, sem limite de taxa nem captcha.
- **Correção proposta:** separar em duas actions. A pública só aceita `ClinicProcedure` do catálogo de clínica `listedInMarketplace`, recusa ids de ponte, limita tamanho de nome/observação e ganha limite por IP + por telefone. A da ponte exige `requireClinicSession()` e usa o `clinicId` da sessão (o Chat, a Agenda e a ferramenta da IA passam a chamar essa, com a clínica vinda do servidor).
- **Esforço:** 3–4 h com testes.

#### C2 — Next.js 15.5.23 com avisos críticos

> **Corrigido em 16/11/2026 (commit `9c0ec5f`, falta push/deploy).** Next e `eslint-config-next` em 15.5.29; o `npm audit` não lista mais nenhum aviso do próprio Next. Restam, por dependência: `postcss` (só em build) e `sharp` 0.34.5 (só importa se a otimização de imagem rodar no nosso processo; o código não usa `next/image`). O texto abaixo descreve a situação anterior.
- **Onde:** `package.json` (`next ^15.5.23`, instalado 15.5.23).
- **O que o `npm audit` aponta:** execução remota de código na otimização de imagens com AVIF (`GHSA-2xp9-vwfh-vxw4`, corrigido em 15.5.24) e com SVG (`GHSA-2464-fhr4-w9xw`, afeta até 15.5.27), negação de serviço em Server Actions (`GHSA-p3m5-59mp-jv5r`, até 15.5.27), envenenamento de cache SSG/ISR (corrigido em 15.5.27) e RCE em servidor Windows (`GHSA-p293-qw3h-jr36`, não se aplica à Vercel).
- **Exploração em uma frase:** requisição sem login a `/_next/image` ou a qualquer Server Action pública.
- **Ressalva:** não consegui confirmar se a otimização de imagens da Vercel usa o código vulnerável (ver S6). O DoS de Server Actions se aplica com certeza: há actions públicas e o limite de corpo é 20 MB (B9).
- **Correção proposta:** atualizar `next` e `eslint-config-next` para a última 15.5.x acima de 15.5.27, rodar `tsc` + `vitest` + preview.
- **Esforço:** 1 h.

### Médio

#### M1 — Senha pelo QR/totem revela se um telefone tem consulta hoje e marca chegada

> **Corrigido em 17/11/2026 (falta push/deploy).** O QR do celular não procura mais a agenda pelo CPF/telefone digitado: só dá a senha, sem nome, horário nem chegada (a tela nem pede o número; chegada pelo celular é só pelo "Cheguei" do link pessoal). Limite de 5 senhas a cada 10 min por QR + IP, em memória por instância (`src/lib/memory-rate-limit.ts`). O totem físico da recepção continua casando CPF/telefone com a agenda, sem limite. A trava de localização segue vindo do navegador.
- **Onde:** `src/actions/queue-ticket.ts:43-68` → `src/lib/queue-ticket-server.ts:70-125`.
- **O que é:** `takeTicket` aceita um "identificador" livre; com 10+ dígitos casa com a agenda do dia, marca o paciente como chegado e devolve nome de exibição e horário da consulta. A trava de localização do QR vem do navegador (`input.location`) e pode ser inventada. Sem limite de taxa.
- **Exploração:** quem fotografou o cartaz do QR testa telefones de casa e descobre quem tem consulta naquele dia, além de bagunçar a fila com senhas e chegadas falsas.
- **Correção:** não devolver nome/horário quando a senha vem de QR (só o código); limite por token + IP (ex.: 5 senhas / 10 min); não marcar chegada por telefone digitado, só pelo "Cheguei" do link pessoal.
- **Esforço:** 2 h.

#### M2 — Cadastro de contato é global: uma clínica vê e altera dado de outra

> **Corrigido em parte em 17/11/2026 (falta push/deploy).** (a) `checkContactPhone` só devolve o nome quando o paciente já tem conversa nesta clínica; para paciente de outra clínica responde como número livre. (b) `updateContactInfo` recusa trocar o telefone de um contato que também tem conversa em outra clínica (`src/lib/shared-contact.ts`). **Continua aberto:** o nome ainda é um só para todas as clínicas — ao cadastrar um número que já é de outra unidade, a conversa nova mostra o nome gravado lá, e uma clínica ainda consegue renomear um contato compartilhado. A correção de verdade é o nome por clínica em `ContactClinicProfile` (migration + cerca de 60 leituras de `contact.name` em 28 arquivos, além do webhook que grava o nome do WhatsApp). O painel admin continua podendo trocar o telefone, por desenho.
- **Onde:** `src/actions/inbox.ts:109-118` (`checkContactPhone`) e `:1781-1785` (`updateContactInfo`).
- **O que é:** (a) digitar qualquer telefone devolve o nome gravado por outra clínica; (b) editar o cadastro troca `name` e `phone` do `Contact`, que é compartilhado.
- **Exploração:** atendente da clínica A confirma que alguém é paciente da plataforma e vê o nome; ou troca o telefone de um contato comum e as mensagens da clínica B passam a ir para outro número.
- **Correção:** `checkContactPhone` só devolve nome se já houver conversa nesta clínica; mover nome de exibição para `ContactClinicProfile`; troca de telefone cria/associa outro `Contact` em vez de editar o compartilhado.
- **Esforço:** 4–6 h (inclui migração do nome).

#### M3 — Atendente virtual cria agendamento sozinha a partir da mensagem do paciente

> **Corrigido em 17/11/2026 (falta push/deploy).** `criarPreAgendamento` não chama mais a criação de agendamento: registra um `BookingRequest` na fila "Pedidos de marcação" da Agenda, um por conversa (pedir de novo atualiza o mesmo), com data e horário validados e texto cortado em 120 caracteres. A recepção é quem marca. `abrirChamadoSuporte` (GLPI, só na clínica TIVDC) continua agindo sem confirmação.
- **Onde:** `src/lib/ai-tools.ts:45-60` e `:122-158` (`criarPreAgendamento` → `createAppointment`), chamada em `src/lib/ai-attendant.ts:124-160`.
- **O que é:** a descrição da ferramenta diz "pré-agendamento pendente", mas em clínica com ponte é um INSERT real no Firebird mais mensagem de confirmação. Não há confirmação humana. O modelo escolhe data, hora, médico e procedimento a partir do texto do paciente.
- **Exploração:** paciente (ou qualquer número) escreve instruções para a IA e gera marcações em série, em qualquer horário.
- **Atenuantes:** escopo preso à clínica e ao telefone da conversa; só vale onde `AiAttendantConfig.active` está ligado e o paciente aceitou a IA (ver S5).
- **Correção:** a ferramenta passa a gravar um `BookingRequest` (fila que a recepção já confirma) em vez de chamar `createAppointment`; limite de 1 pedido aberto por conversa.
- **Esforço:** 2–3 h.
- **Demais caminhos de IA, conferidos:** Copiloto da Recepção só propõe (cancelar e criar rascunho exigem clique e revalidam posse — `src/actions/copilot.ts:112-127`); Jev só devolve escolhas; marcação fora do horário só extrai campos e gera pedido; resposta de convênios não usa modelo (`src/lib/insurance-reply.ts` é texto fixo). `abrirChamadoSuporte` (GLPI) também age sem confirmação, mas só existe na clínica TIVDC.

#### M4 — Três formas de enviar marketing sem o aceite do paciente

> **Corrigido em 17/11/2026 (falta push/deploy).** (1) Só a gestão cadastra marcador ou troca o telefone de um, e marcador desativado deixa de ser dispensado do aceite (`src/actions/marcadores.ts`, `src/lib/broadcast.ts`). (2) Aceites de SMS/e-mail só pela gestão, e a lista não reativa mais quem pediu para sair (`planConsentChanges` devolve `optedOut`). (3) Aviso de remarcação pede a permissão `disparos` e o texto precisa manter `{{medico}}` e `{{data}}`, sem link, até 700 caracteres (`src/lib/reschedule-text.ts`). Limite que continua: a gestão ainda pode cadastrar qualquer telefone como marcador — fica registrado como decisão dela.
1. **Marcadores:** `src/actions/marcadores.ts:112-113` (`importMarcadores`, qualquer login da clínica) + `src/lib/broadcast.ts:96-110` (telefone cadastrado como marcador dispensa consentimento). *Exploração:* importar a lista de pacientes como "marcadores" e disparar campanha.
2. **Aceites de SMS/e-mail:** `src/actions/clinic-channel-broadcast.ts:144-145` — o comentário diz "só gestão", o código pede só a permissão `disparos` (Recepção e Marketing têm). Além disso `planConsentChanges` (`src/lib/channel-consent.ts:55`) **reativa aceite revogado**: reimportar a lista desfaz o "não quero mais receber" do paciente.
3. **Aviso de remarcação:** `src/actions/clinic-broadcast.ts:552-553` — texto livre, sai sem aceite e sem responsável técnico, já nasce enviando, e só pede `requireClinicSession`. Público limitado aos agendados daquele médico/dia.
- **Correção:** (1) dispensa de aceite só para marcador criado pela gestão e nunca para telefone que tenha conversa de paciente; (2) trocar para `requireClinicManager()` e nunca renovar aceite com `revokedAt` preenchido — só novo aceite do próprio paciente; (3) exigir `requireClinicPermission("disparos")` e texto com modelo fixo + variáveis.
- **Esforço:** 3–4 h.
- **Teto por rodada:** não achei forma de burlar. O intervalo é único por clínica (`broadcast.ts:68-71`), várias campanhas não somam. Opt-out ("9") vale em todos os caminhos.

#### M5 — Ações da API oficial não conferem se a sessão foi revogada

> **Corrigido em 17/11/2026 (falta push/deploy).** `requireCloudAccess` agora recusa sessão revogada (`isLive`).
- **Onde:** `src/actions/admin-whatsapp-cloud.ts:47-55` (`requireCloudAccess` usa `getServerSession` sem `isLive`).
- **Exploração:** usuário desativado, ou com senha trocada, mantém por até 12 h o poder de conectar número, enviar mensagem de teste e criar modelo.
- **Correção:** reutilizar `requireAdminSession` / `requireClinicManager` dentro do helper.
- **Esforço:** 30 min.

#### M6 — Segredos de integração em texto puro no banco

> **Corrigido em 17/11/2026 (falta push/deploy + rodar o script).** As três chaves passam a ser gravadas com `encryptToken` (mesma chave da API oficial) e toda leitura passa por `decryptToken`, que aceita o valor antigo em texto puro — nada para de funcionar antes da recifragem. Para cifrar o que já está no banco: `npx tsx scripts/encrypt-integration-secrets.ts` (só conta) e depois com `--apply`. Trava no CI: `src/lib/integration-secrets.guard.test.ts` falha se alguém ler esses campos da linha do banco sem decifrar. As pontes nas clínicas (`CLIENTES/`) não mudam: o token continua o mesmo, só fica cifrado do nosso lado.
- **Onde:** `WhatsappInstance.apiKey` (lido em `src/actions/clinic-whatsapp-qr.ts:20`), `HospitalIntegration.apiToken` (`src/lib/hospital-bridge.ts:28`), `InstagramAccount.accessToken` (`src/actions/admin-instagram-account.ts:19`). Só a API oficial, o TOTP e a ficha passam por `encryptToken`.
- **Exploração:** vazamento do banco (ou S1) entrega acesso de escrita ao Firebird das clínicas, às instâncias da Evolution e ao Direct do Instagram.
- **Correção:** cifrar os três campos com `token-crypto` (o `decryptToken` já aceita valor antigo em texto puro, então dá para migrar aos poucos).
- **Esforço:** 3 h + script de recifragem.

#### M7 — Nenhum cabeçalho de segurança

> **Corrigido em 17/11/2026 (falta push/deploy).** `next.config.mjs` envia `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e HSTS em todas as respostas. Falta a CSP completa (scripts e conexões), que pede ajuste em modo Report-Only.
- **Onde:** `next.config.mjs` (sem `headers()`), `src/middleware.ts`, `vercel.json`.
- **Falta:** `Content-Security-Policy` (ao menos `frame-ancestors 'none'`), `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Exploração:** o painel pode ser aberto dentro de um iframe de outro site (clickjacking: um clique "inocente" inicia campanha ou transfere conversa).
- **Correção:** bloco `headers()` no `next.config.mjs`; CSP completa em modo `Report-Only` primeiro.
- **Esforço:** 1–2 h (CSP completa: +1 dia de ajuste).

#### M8 — Exclusão do titular (LGPD) deixa dados para trás

> **Corrigido em 17/11/2026 (falta push/deploy).** A exclusão agora apaga Tarefas, inscrições de automação, pedidos de marcação, ficha prévia, aceite do termo, links do paciente, NPS, senhas e lista de espera; tira o telefone de marcações da agenda, lembretes, vagas oferecidas e destinatários de campanha (o relatório agregado continua); apaga todas as páginas de mídia no Storage e as cópias no bucket de backup; e aceita busca por `@usuario` do Instagram (`src/lib/lgpd-server.ts`, `src/actions/admin-lgpd.ts`). Continuam de fora, de propósito: agendamentos (guarda obrigatória), registro de acessos (prova de quem viu), quem pediu para sair do SMS (lista de bloqueio) e `webhook_logs` (somem sozinhos em 60 dias). No Backblaze B2, a versão antiga do arquivo só some de vez com a regra de ciclo de vida "manter só a última versão" ligada no painel.
- **Onde:** `src/actions/admin-lgpd.ts:41-118`.
- **Apaga hoje:** mensagens, mídias da pasta da conversa, perfil na clínica, triagem, logs de IA, sugestões, auditoria de qualidade.
- **Não apaga (confirmado, não há chamada):**
  - `ReceptionTask` (texto livre + `conversationId`) e `TagAutomationEnrollment` — os dois itens perguntados;
  - `PatientFormResponse` (ficha de saúde cifrada), `ConsentAcceptance`, `PatientToken`, `NpsResponse` (telefone + comentário), `QueueTicket` (nome + telefone), `AgendaMark`, `BridgeReminderLog`, `BroadcastRecipient` (telefone + variáveis com nome), `ChannelConsent`, `WaitlistEntry`, `BookingRequest`, `Marcador`, `PatientAccessLog`;
  - `webhook_logs` com o corpo das mensagens (somem sozinhos em 60 dias);
  - **Storage:** só lista o 1º nível da pasta, limite de 1000 arquivos (`:55-56`);
  - **Backblaze B2:** `src/lib/storage-backup.ts` e o cron só copiam, nunca removem — a mídia do paciente fica no backup para sempre.
- **Outras lacunas:** a busca é só por telefone (`:11-13`), então paciente só de Instagram não é encontrado; o nome só é anonimizado quando não há conversa em outra clínica.
- **Correção:** incluir as tabelas acima na transação (por `conversationId` e por telefone + clínica); paginar o Storage; remover do B2 as chaves `<conversationId>/…` e anotar no `DataDeletionRecord`; aceitar `@usuario` do Instagram na busca.
- **Esforço:** 1 dia com testes.

#### M9 — Registro de acessos não cobre todas as leituras

> **Corrigido em 17/11/2026 (falta push/deploy).** O painel admin da TIVDC passa a registrar abrir conversa, ficha, histórico, mídias e editar cadastro como "Suporte (TIVDC)…" na clínica da conversa (`recordSupportAccess`). Na clínica, entram também histórico, mídias, `getConversation` e o resumo do paciente na Agenda. Lista de pacientes e busca (inclusive por CPF) gravam um registro por usuário por hora, com a quantidade e nunca o termo buscado (`recordBulkAccess`, em `audit_logs`); a tela Acessos mostra esses registros. Ainda sem registro: CSV de relatórios, prévia de público pela ponte e as listagens do próprio admin (fila de conversas, lista de contatos).
- **Onde registra:** abrir conversa (`inbox.ts:2003`), abrir ficha (`patient-profile.ts:30`), editar cadastro (`inbox.ts:1771`), ver ficha prévia (`patient-form-view-server.ts:23-24`, com registro mesmo sem conversa).
- **Onde não registra:**
  - **todo o painel admin da TIVDC** — `src/actions/admin-inbox.ts` não tem nenhuma chamada a `recordPatientAccess`, e é quem lê conversas de todas as clínicas;
  - listas e exportações: `listAllContacts`/`listContactsPage` (`inbox.ts:122,298`, trazem CPF e convênio), CSV de contatos e relatórios;
  - `getConversation` (`inbox.ts:515`), `getChatContactHistory` (`:2058`), `listContactMedia` (`:2107`), `globalSearch` (`clinic-shell.ts:37`, busca por CPF), `getAgendaPatient` (`agenda.ts:111`);
  - leitura de público de campanha pela ponte (`previewBridgeAudience`, `clinic-broadcast.ts:651`).
- **Correção:** registrar no admin com ação própria (ex.: `SUPORTE_ABRIU_CONVERSA`); registrar exportações e buscas por CPF como evento único (quem, quando, quantos registros).
- **Esforço:** 4–6 h.

#### M10 — Login: bloqueio só por e-mail e 2FA opcional até para o admin

> **Corrigido em 17/11/2026 (falta push/deploy).** (1) Limite por origem: 20 erros de senha ou código do mesmo IP em 15 min bloqueiam aquele IP, em qualquer e-mail (`src/lib/auth.ts`, motivo `BLOQUEADO_IP`). (2) 2FA obrigatório para admin e gestão, **desligado até criar `TWO_FACTOR_ENFORCE=1` na Vercel**: quem não ativou é levado à tela Minha conta com um aviso e ativa sozinho (`twoFactorGate` nos layouts). É uma trava de tela; as ações do servidor seguem conferindo sessão e função como antes. (3) B4: e-mail inexistente demora o mesmo que um real. Continua valendo: quem souber o e-mail de alguém ainda consegue travar aquele login com 5 erros a cada 15 min (o bloqueio por e-mail foi mantido de propósito).
- **Onde:** `src/lib/auth.ts:49-56,65` e `src/lib/login-guard.ts`.
- **O que é:** o bloqueio conta erros por e-mail, não por IP. Quem souber o e-mail da recepção mantém o login travado com 5 tentativas a cada 15 min; e uma mesma origem pode testar uma senha comum contra muitos e-mails sem nunca ser bloqueada. O 2FA é opcional inclusive para `role = ADMIN`, que enxerga todas as clínicas.
- **Correção:** somar limite por IP (ex.: 20 erros / 15 min); 2FA obrigatório para ADMIN e GESTAO; aviso por e-mail quando houver bloqueio.
- **Esforço:** 3–4 h.

#### M11 — Guia e comprovante públicos pelo id do agendamento, sem validade

> **Corrigido em 17/11/2026 (falta push/deploy).** O link passa a ser `<id>.<assinatura>` (HMAC do id com `NEXTAUTH_SECRET`, `src/lib/guide-link.ts`), sem tabela nova. Vale até 7 dias depois da consulta; depois mostra "Este link expirou". As duas páginas têm `noindex` e entregam a clínica só com os campos públicos (fecha a sobra do M12; o agendamento pelo site também deixou de devolver a clínica inteira). **Efeito colateral:** links já enviados com o id puro deixam de abrir e mostram "Link inválido". Só agendamentos do catálogo têm guia; os da ponte nunca tiveram.
- **Onde:** `src/app/(public)/acompanhar/[id]/page.tsx:13`, `comprovante/[id]/page.tsx:45`, `src/components/public/voucher-card.tsx:79-80`.
- **O que é:** o "link secreto" é o `cuid` do agendamento (não foi feito para ser segredo, nunca expira, não tem `noindex`). Mostra nome completo, CPF mascarado, procedimento e clínica.
- **Correção:** trocar por token aleatório com hash (o mesmo `patient-token` já usado em `/p/[token]`), validade até alguns dias após a consulta, `robots: noindex`.
- **Esforço:** 3 h.

#### M12 — Busca pública devolve o registro inteiro da clínica

> **Corrigido em 17/11/2026 (falta push/deploy).** `searchClinicProcedures` e `getClinicProcedureDetail` passam a clínica por `toPublicClinic` (`src/lib/public-clinic.ts`): só nome, endereço, telefone, nota e horário saem; o resto vai vazio. A página do procedimento também deixa de abrir para clínica inativa ou fora do marketplace. As páginas de guia/comprovante (M11) ainda devolvem a clínica inteira.
- **Onde:** `src/actions/search.ts:93,107` (`include: { clinic: true }`), também `getFeaturedClinics`/`getAllClinics`.
- **Vaza:** `id` (insumo do C1), CNPJ, `commissionRate`, `defaultTicket`, `campaignExcludedPatientIds` (ids de pacientes no Firebird), ponto geográfico da cerca, textos automáticos.
- **Correção:** `select` só com nome, bairro, cidade, nota e telefone público.
- **Esforço:** 1 h.

### Baixo

| # | Achado | Onde | Exploração em uma frase | Correção | Esforço |
|---|---|---|---|---|---|
| B1 | `/api/track/click`: a origem pode ser forjada fora do navegador, o limite é em memória por instância, e `Access-Control-Allow-Credentials: true` é desnecessário | `src/app/api/track/click/route.ts:28,39-58` | script enche `ad_clicks` (some em 90 dias); nada é lido de volta | tirar `Allow-Credentials`; limite persistente (tabela ou Upstash) | 1–2 h |
| B2 | Log do webhook do Instagram em falha guarda o evento inteiro e `error.message` | `src/app/api/webhooks/instagram/route.ts:164` | texto do paciente e argumentos do Prisma ficam em `webhook_logs` | usar `errorSummary` e guardar só `mid` | 20 min |
| B3 | TOTP aceita o mesmo código mais de uma vez na janela de ±30 s; não há códigos de recuperação | `src/lib/totp.ts` | quem viu o código por cima do ombro reusa em 90 s | guardar o último passo usado por usuário; gerar códigos de reserva | 2–3 h |
| B4 | Tempo de resposta do login revela se o e-mail existe (bcrypt só roda quando o usuário existe); `loginFailure` é gravado para qualquer e-mail | `src/lib/auth.ts:62-65` | enumeração de e-mails e crescimento da tabela | comparar com hash fixo quando não há usuário | 30 min |
| B5 | Canal de tempo real do Chat tem nome previsível (`inbox-changes:<clinicId>`) e aceita publicação com a chave pública | `src/lib/supabase-server.ts` (`getInboxRealtimeChannelName`) | terceiro força recarga das telas; sem dado no canal | nome por HMAC, como já é na Agenda e na TV (`realtime-topic.ts`) | 1 h |
| B6 | Link da TV não vence (só revoga) e mostra nomes das últimas 24 h; `callPatientOnTv` aceita nome livre; Médico vê e chama a fila inteira | `src/lib/tv-call-server.ts:76-85`, `src/actions/tv-call.ts:18-27`, `queue-ticket.ts:76-92` | endereço da TV vazado mostra quem foi chamado; médico exibe texto qualquer no telão | validar `externalId` contra a agenda do dia; filtrar fila do médico; aviso quando a TV for aberta de IP novo | 3 h |
| B7 | Upload da TV confia no tipo declarado e usa `Math.random` no nome | `src/actions/tv-call.ts:150-161` | gestão sobe arquivo de outro tipo (bucket privado) | conferir assinatura do arquivo no passo 2; `randomUUID` | 1 h |
| B8 | Mídia recebida de paciente é guardada com qualquer tipo; extensão derivada do mimetype | `src/lib/whatsapp-media.ts` (`extensionFromMimeType`) | ver S7 | lista de tipos aceitos; o resto vira `application/octet-stream` | 1 h |
| B9 | Limite de 20 MB vale para todas as Server Actions, inclusive as públicas | `next.config.mjs:23` | corpo grande em action pública consome função | validar tamanho cedo nas públicas; ver C2 | 1 h |
| B10 | Formulários públicos sem limite: parceiro e marcador; com a prospecção ligada, o sistema manda WhatsApp escrito por IA para o número informado | `src/actions/partner-leads.ts:17-20`, `affiliates.ts:32-45`, `src/lib/ai-lead-outreach.ts:83-110` | spam para terceiros e injeção no texto de prospecção | limite por IP; prospecção só após aprovação manual | 2 h |
| B11 | Uma única chave (`WHATSAPP_TOKEN_ENCRYPTION_KEY`) cifra token da Meta, TOTP, ficha e NPS; `decryptToken` aceita texto puro | `src/lib/token-crypto.ts` | vazou uma, vazou tudo; sem rotação | chaves separadas por finalidade + versão no prefixo | 3 h |
| B12 | Pontes Firebird: escutam em `0.0.0.0`, um token fixo por clínica, sem limite de taxa, banco como `SYSDBA` | `CLIENTES/*/index.js` (Santa Clara `:40-44,165-169,866`; Urolaser `:52-56,210-214,620`; Onix `:33-37,73-75,309`) | token vazado (M6) dá leitura de pacientes, financeiro e escrita de agenda | usuário Firebird só com as permissões usadas; restringir origem no túnel; rotação do token | 0,5 dia por clínica |
| B13 | Contas de demonstração e de teste em produção com uma senha para todos os logins, sem 2FA; a clínica de teste se comporta como cliente real e pode receber o número oficial | `scripts/seed-demo-clinic.ts:129-164`, `scripts/setup-test-clinic.ts` | senha de demonstração compartilhada em vídeo/apresentação abre o painel | senha por usuário, 2FA na gestão de teste, desativar logins fora do uso | 1 h |
| B14 | Cookie `?ref=` sem `httpOnly`/`secure` | `src/middleware.ts:46-50` | só afeta comissão de marcador | acrescentar as duas opções | 10 min |
| B15 | Planilha do Google Ads com usuário e senha fixos, sem limite de tentativas | `src/app/api/conversions/google-ads/route.ts:19-30` | força bruta lenta; conteúdo é só `gclid` + hora | limite por IP | 30 min |
| B16 | `shadcn` (ferramenta de linha de comando) está em `dependencies` e traz 20+ pacotes com aviso, incluindo o crítico `proxy-addr` | `package.json` | nenhum em tempo de execução; polui o `npm audit` e a imagem | mover para `devDependencies` | 10 min |

> **Corrigidos em 17/11/2026 (falta push/deploy):**
> - **B1** (`a54a54f`): teto no banco, 1000 cliques em 10 min, que vale entre instâncias. O `Allow-Credentials` foi **mantido** de propósito: o `sendBeacon` manda credenciais e, se o `track.js` enviar como JSON, a pré-verificação exige esse cabeçalho.
> - **B2** (`98ceb32`): o log de falha do webhook do Instagram guarda só tipo, `mid` e `errorSummary`.
> - **B3** (`4dd8d68`): o login só aceita código de passo mais novo que o último usado; 10 códigos de reserva (SHA-256, um uso cada). **Migration `20261117120000_totp_replay_recovery` antes do deploy.**
> - **B4**: junto com o M10 (`f3d0ea9`).
> - **B5** (`9d0619f`): o canal do Chat passou a ter nome por HMAC, calculado no servidor.
> - **B14, B15, B16** (commit seguinte): cookie `?ref=` com `httpOnly`/`secure`; planilha do Google Ads com 30 pedidos a cada 15 min por origem; `shadcn` em `devDependencies` (o `npm audit --omit=dev` ficou em 27 moderados + 6 altos, sem críticos).
> - Continuam abertos: B6–B13.

Observações fora do repositório (não abri os arquivos): há `.env` com credenciais do Firebird e do token da ponte em `CLIENTES/SANTA CLARA/` e `CLIENTES/UROLASER/`, e um arquivo chamado `API Key OpenAI.txt` solto em `Documents/TIVDC/`. Vale guardar num cofre de senhas e apagar do disco.

---

## 4. Superfície pública, item por item

| Rota | Como autentica | Entropia / validade | O que vaza se o token for adivinhado | Limite de taxa |
|---|---|---|---|---|
| `/p/[token]` (ficha, Cheguei, NPS) | token no link, hash SHA-256 no banco (`patient-token.ts`) | 256 bits; 72 h ficha, 36 h check-in, 7 dias NPS; revogado ao cancelar; NPS de uso único | primeiro nome, data/hora, médico, perguntas da ficha; permite enviar ficha e marcar chegada | nenhum (desnecessário com 256 bits) |
| `/tv/[token]` | token do aparelho, hash no banco | 192 bits; **sem validade**, revogável | nomes chamados nas últimas 24 h, médico, sala, mídia da TV (URL assinada 12 h) | nenhum |
| `/totem/[token]`, `/chegada/[token]` | idem (tipo TOTEM / QR) | 192 bits, sem validade. O QR é **público por natureza** (cartaz) | ver M1 | nenhum |
| `/senha/[token]` | token da senha, hash no banco | 144 bits | posição na fila | nenhum |
| `/acompanhar/[id]`, `/comprovante/[id]` | **id do agendamento** | `cuid`, sem validade | ver M11 | nenhum |
| `/api/u/[token]` (descadastro) | id + HMAC truncado | 96 bits de assinatura, sem validade (de propósito) | nome da clínica; permite descadastrar | nenhum |
| `/api/track/click` | lista de origens + corpo ≤ 2 KB | — | nada (só grava) | em memória, por instância (B1) |
| `/api/conversions/google-ads` | usuário e senha (Basic), comparação em tempo constante; 404 sem as variáveis | — | `gclid` + nome genérico + hora | nenhum (B15) |
| `/api/webhooks/whatsapp` (Evolution) | `x-webhook-token` compartilhado; recusa só com `WHATSAPP_WEBHOOK_ENFORCE` | segredo único para todas as instâncias | com o segredo: injeta mensagem em qualquer clínica pelo nome da instância | nenhum |
| `/api/webhooks/whatsapp-cloud` | HMAC-SHA256 da Meta (`META_APP_SECRET`) | — | — | nenhum |
| `/api/webhooks/instagram` | HMAC-SHA256 (`INSTAGRAM_APP_SECRET`) | — | — | nenhum |
| `/api/webhooks/resend` | assinatura Svix com tolerância de tempo | — | — | nenhum |
| `/api/cron/*` (15 rotas) | `Authorization: Bearer CRON_SECRET`, tempo constante, recusa se ausente | — | dispara envios e limpezas | nenhum |
| `/api/chat` | desligada por padrão | — | — | — |
| Pontes Firebird | `x-api-token` em tempo constante, todas as rotas menos `/health` | token fixo por clínica | pacientes, agenda, financeiro, escrita de agenda | nenhum (B12) |
| Server actions públicas | nenhuma | — | `createAppointment` (C1), busca (M12), parceiro/marcador (B10), reset de senha (3/h por usuário, resposta sempre igual) | só o reset |

**Papéis, conferidos em `src/lib/clinic-permissions.ts` e `src/lib/session.ts`:**
- **Médico:** `requireClinicSession` recusa (`session.ts:31`). Só passa em `requireClinicPermission("chamar")` e nas actions `doctor*` de `src/actions/agenda.ts:164-213`. Vê os pacientes dele de hoje (casados por `User.doctorName`), abre a ficha prévia deles (com registro), chama na TV e muda status. Fora disso alcança: fila de senhas inteira com nome do paciente, médico e horário (`getQueue`; sem telefone), salas, e pode chamar qualquer nome na TV (B6). Não alcança Chat, CRM, Pacientes, Relatórios, Disparos nem Configurações.
- **Recepção × Marketing × Gestão:** as três passam em `requireClinicSession`. Relatórios e Configurações usam `requireClinicManager` ou `relatorios`. Exceções encontradas: `getClinicCampaignReport` (`clinic.ts:698`) e `getMarcadoresReport` só pedem sessão; Marketing não tem `ficha.ver`, mas lê CPF, convênio e observações pela ficha do Chat (`getPatientProfile`, `listAllContacts`). Se a intenção é Marketing sem dado de saúde, isso contraria a regra.
- **Conexão por QR (16/11):** `src/actions/clinic-whatsapp-qr.ts` exige gestão e não devolve URL, chave nem nome da instância. OK.
- **Hub de Configurações:** `src/app/(clinic)/clinic/configuracoes/page.tsx:16-18` só escolhe quais cartões mostrar; a trava de verdade está nas actions de cada tela. OK.
- **Tarefas e automações por tag:** todas as leituras e escritas filtram por `clinicId`; responsável e conversa são validados contra a clínica. OK.

---

## 5. Suspeitas a verificar (não dá para confirmar só lendo o código)

> **S1 CONFIRMADO em 17/11/2026 — passa a ser o achado crítico nº 1.** Consulta só ao catálogo do Postgres de produção (nenhuma linha de paciente lida): das 75 tabelas do schema `public`, **36 estão sem RLS** e o papel `anon` (a chave pública que vai no navegador) tem SELECT, INSERT, UPDATE e DELETE em todas elas. Nenhuma tabela tem policy. Tabelas afetadas: `acquisition_rules`, `agenda_marks`, `ai_action_logs`, `audit_logs`, `automation_rules`, `booking_requests`, `campaign_spends`, `channel_consents`, `cloud_test_messages`, `consent_acceptances`, `consent_terms`, `contact_clinic_profiles`, `contacts_sensitive_backup_20261020`, `conversation_stage_changes`, `data_deletion_records`, `doctor_rooms`, `form_templates`, `instagram_accounts`, `login_failures`, `loss_reasons`, `marcadores`, `nps_responses`, `patient_access_logs`, `patient_calls`, `patient_data_suggestions`, `patient_form_responses`, `patient_tokens`, `queue_services`, `queue_tickets`, `return_intervals`, `slot_offers`, `stage_messages`, `tv_displays`, `tv_media_items`, `waitlist_entries`, `whatsapp_cloud_accounts`.
> **Exploração:** qualquer pessoa pega a URL do Supabase e a chave `anon` no JavaScript do site e lê ou altera essas tabelas pela API REST do Supabase, sem login. Inclui CPF, RG, endereço e convênio dos pacientes (`contact_clinic_profiles` e a cópia `contacts_sensitive_backup_20261020`), o token do Instagram em texto puro, o registro de acessos e a trilha de auditoria (que podem ser apagados).
> **Correção:** `ALTER TABLE … ENABLE ROW LEVEL SECURITY` nas 36 (o app conecta como dono do banco e não é afetado, como já acontece nas outras 39); apagar `contacts_sensitive_backup_20261020`; trava no CI para toda migration com `CREATE TABLE` ligar o RLS; depois, trocar o token do Instagram e conferir nos logs da API do Supabase se houve leitura externa. **Esforço:** 1 h.
> **Fechado em 17/11/2026:** migration `20261117090000_enable_rls_remaining_tables` aplicada em produção; nova consulta ao catálogo mostra 75 de 75 tabelas com RLS. Trava no CI em `src/lib/rls-migrations.guard.test.ts`. Pendentes: apagar `contacts_sensitive_backup_20261020`, trocar o token do Instagram e conferir nos logs da API do Supabase se houve leitura externa antes do fechamento.
> **Logs conferidos em 17/11/2026 (pelo dono, no painel do Supabase):** nenhuma chamada a `/rest/v1/` no API Gateway nos últimos 7 dias, que é toda a retenção disponível. Não há evidência de leitura externa. O período anterior (as tabelas ficaram abertas desde a criação de cada uma, a partir de outubro) não pode mais ser verificado.
> **S3 conferido junto:** o bucket `whatsapp-media` é privado e não há policy de Storage. OK.

| # | Suspeita | Por que suspeito | Como conferir | Gravidade se confirmar |
|---|---|---|---|---|
| S1 | **Tabelas sem RLS no Supabase.** | Só 12 migrations têm `ENABLE ROW LEVEL SECURITY`; a de 15/09 cobriu as tabelas da época. Não achei o comando para cerca de 35 tabelas criadas depois, entre elas `contact_clinic_profiles`, `patient_form_responses`, `instagram_accounts`, `whatsapp_cloud_accounts`, `patient_access_logs`, `queue_tickets`, `agenda_marks`, `nps_responses`, `channel_consents`, `audit_logs`, `patient_tokens`, `tv_displays`, `marcadores`, `waitlist_entries`, `booking_requests`. A chave `anon` vai no navegador (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). | No SQL Editor do Supabase (só leitura): `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1;` — o resultado precisa vir vazio. | **Crítico** |
| S2 | Clínicas com ponte estão listadas no marketplace? | Define se o `clinicId` do C1 é público | `select trade_name, listed_in_marketplace from clinics c join hospital_integrations h on h.clinic_id = c.id;` | agrava C1 |
| S3 | Bucket `whatsapp-media` é privado e sem policy para `anon`? | O código assume que sim | Painel Supabase › Storage | Crítico se público |
| S4 | `WHATSAPP_WEBHOOK_SECRET` e `WHATSAPP_WEBHOOK_ENFORCE=1` estão na Vercel (produção)? | Sem a segunda, o webhook aceita qualquer remetente (`request-auth.ts:42`) | Vercel › Environment Variables; no log não pode aparecer "sem x-webhook-token válido" | Médio |
| S5 | Em quais clínicas a atendente virtual está ativa? | Define o alcance do M3 | `select clinic_id from ai_attendant_configs where active;` | — |
| S6 | Os avisos de RCE do Next valem na Vercel? | A otimização de imagem roda na infraestrutura da Vercel | Boletim da Vercel para cada GHSA; na dúvida, atualizar | — |
| S7 | Anexo HTML/SVG enviado por paciente abre renderizado? | Tipo não é filtrado (B8) | Mandar um `.html` de teste para a clínica de teste e abrir pelo Chat | Baixo (domínio é do Supabase, não o do painel) |
| S8 | Eventos do Sentry carregam dado pessoal? | `sendDefaultPii: false` está certo, mas não há `beforeSend`; erro do Prisma traz os argumentos da consulta na mensagem | Abrir 5–10 eventos recentes em `tivdc` e ler a mensagem inteira | Médio |
| S9 | Variáveis `NEXT_PUBLIC_*` na Vercel têm só valores públicos? | No código são 7 e todas legítimas (Supabase URL e anon, DSN do Sentry, ids da Meta, ambiente) | Vercel › Environment Variables | — |

---

## 6. Dependências (`npm audit --omit=dev`)

47 avisos: 2 críticos, 12 altos, 33 moderados.

| Pacote | Versão | Gravidade | Afeta código que usamos? | Ação |
|---|---|---|---|---|
| `next` | 15.5.23 | Crítico | Sim (C2) | atualizar para a última 15.5.x |
| `sharp` (via `next`) | 0.34.5 | Alto | Só se a otimização de imagem rodar no nosso processo (S6) | vem junto com o `next`; senão `npm audit fix` |
| `zod` | < 4.6.6 | Alto | Pouco: esgota memória com coleções grandes; nossas entradas públicas são textos curtos | `npm audit fix` |
| `undici` (via `openai`) | 7.29.0 | Alto | Baixo: só chamadas de saída para a OpenAI | `npm audit fix` |
| `postcss`, `source-map-js`, `brace-expansion`, `js-yaml`, `fast-uri` | — | Alto | Só em build | `npm audit fix` |
| `proxy-addr`, `body-parser`, `@modelcontextprotocol/sdk`, `hono`, `systeminformation`, `qs`, `ts-morph` | — | Crítico/Alto/Moderado | **Não** — entram pelo `shadcn` (B16) | mover `shadcn` para `devDependencies` |
| `@sentry/nextjs` e `@opentelemetry/*` | 9.47.2 | Moderado | Baixo (instrumentação de bibliotecas que não usamos) | planejar a subida para a 11 (muda de versão principal) |

Segredos: varredura do diretório versionado e das 754 revisões do `git log --all -p` por padrões de chave (OpenAI, Meta, JWT, AWS, Resend, Svix, chave privada, URL de banco com senha). **Nada real encontrado.** As ocorrências são marcadores de lugar (`.env.example:2,6`, `docs/obsidian/01 - Setup e Infraestrutura.md:113`) e constantes de teste (`src/lib/unsubscribe-token.test.ts`, `src/app/api/u/[token]/route.test.ts`, `src/app/api/webhooks/whatsapp-cloud/route.test.ts`). `.env` e `.env.prod` nunca foram versionados. `site/index.html` não tem chave.

---

## 7. Plano de ação, em ordem

| Ordem | O que fazer | Achado | Esforço |
|---|---|---|---|
| 1 | Rodar a consulta de RLS no Supabase; se vier tabela, ligar RLS em todas (migration só com `ALTER TABLE … ENABLE ROW LEVEL SECURITY`) e conferir o bucket | S1, S3 | 15 min para conferir; 1 h para corrigir |
| 2 | Fechar `createAppointment`: versão pública só catálogo, versão da ponte com sessão | C1 | 3–4 h |
| 3 | Atualizar `next`; mover `shadcn` para dev; `npm audit fix` | C2, B16 | 1–2 h |
| 4 | `select` enxuto nas buscas públicas | M12 | 1 h |
| 5 | `isLive` nas ações da API oficial | M5 | 30 min |
| 6 | Consentimento: marcadores, aceites só gestão e sem reativar revogado, remarcação com permissão | M4 | 3–4 h |
| 7 | Cabeçalhos de segurança (`frame-ancestors`, `nosniff`, `Referrer-Policy`) | M7 | 1–2 h |
| 8 | QR/totem: não devolver nome, limite de taxa, não marcar chegada por telefone | M1 | 2 h |
| 9 | Contato compartilhado: `checkContactPhone` e troca de telefone | M2 | 4–6 h |
| 10 | IA atendente grava pedido em vez de agendamento | M3 | 2–3 h |
| 11 | Login: limite por IP, 2FA obrigatório para admin e gestão | M10 | 3–4 h |
| 12 | Exclusão LGPD completa (tabelas, Storage paginado, B2) | M8 | 1 dia |
| 13 | Registro de acessos no admin, em exportações e buscas | M9 | 4–6 h |
| 14 | Cifrar chaves da Evolution, da ponte e do Instagram | M6 | 3 h |
| 15 | Guia/comprovante com token e validade | M11 | 3 h |
| 16 | Itens baixos, em lote | B1–B15 | 2–3 dias somados |

Os itens 1 a 5 cabem em um dia e tiram os riscos de maior impacto.

---

## 8. O que não consegui avaliar

- **Configuração real de produção:** variáveis na Vercel, RLS e policies do Supabase, privacidade do bucket, regras do túnel das pontes, lista de origens do `TRACK_CLICK_ORIGINS`. Tudo isso está nas suspeitas S1–S4 e S9.
- **Dados:** quais clínicas têm ponte listada no marketplace, IA ativa, responsável técnico, contas de teste ativas.
- **Comportamento em execução:** nenhum teste dinâmico (sem login e sem requisições, por regra). Não testei injeção de instrução na IA de verdade, nem cabeçalhos efetivos que a Vercel acrescenta (HSTS), nem como o Supabase serve um anexo HTML.
- **Conteúdo do Sentry e dos logs da Vercel:** só li a configuração.
- **Aplicabilidade dos avisos do Next à Vercel** (S6): os avisos são mais novos que o meu conhecimento; relatei o que o `npm audit` diz.
- **Pontes:** li autenticação, rotas e forma das consultas dos três `index.js`; não revisei a lógica de cada SQL nem os gatilhos do Firebird. Os `.env` das pontes não foram abertos.
- **Evolution API, GLPI, Comtele, Resend, Backblaze:** a segurança do lado deles (painel, chaves, permissões do bucket B2) está fora do código.
- **Painel admin (`src/actions/admin*.ts`):** conferi que todas as actions exigem admin (com as exceções de M5); não revisei uma a uma a lógica interna, já que o admin pode tudo por desenho.
- **Componentes React:** busquei padrões de XSS (`dangerouslySetInnerHTML`, `innerHTML`, `href` vindo de dado) e não achei problema; não li os ~770 arquivos.
- **Teto por rodada dos envios:** li o ritmo único por clínica em `broadcast.ts`; não revisei `automated-pacing.ts` linha a linha.
