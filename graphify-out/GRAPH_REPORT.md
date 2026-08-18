# Graph Report - MARCACAO  (2026-08-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1094 nodes · 2262 edges · 72 communities (55 shown, 17 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 52 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bd2d042a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- format.ts
- Conecta Saúde (plataforma)
- dependencies
- Clinic model
- booking-dialog.tsx
- Fase 2 — Automação Total no WhatsApp
- whatsapp.ts
- (public)/page.tsx
- devDependencies
- inbox-layout.tsx
- Plataforma de Agendamento de Consultas e Exames
- VoucherCard component
- actions/inbox.ts
- ChatCrmApp
- compilerOptions
- chat-crm-app.tsx
- components.json
- select.tsx
- cn
- affiliates.ts
- clinicas/page.tsx
- button.tsx
- useActionFeedback
- painel/page.tsx
- logo.tsx
- chat-window.tsx
- affiliate-signup-form.tsx
- procedimentos/[id]/page.tsx
- migration 20260816022709_add_inbox_module
- conversation-list.tsx
- chat-crm-adapters.ts
- (admin)/layout.tsx
- command.tsx
- partner-lead-form.tsx
- seed.ts
- actions/clinic.ts
- (clinic)/layout.tsx
- partner-leads.ts
- app/layout.tsx
- scroll-showcase.tsx
- clinic/page.tsx
- input-group.tsx
- entrar/page.tsx
- precos/page.tsx
- faq-section.tsx
- popover.tsx
- logo-icon.svg
- ClinicProcedure model
- next-auth.d.ts
- conectasaudevc.com.br (domínio oficial de produção)
- Conecta Saúde Brand Logo (public/logo.svg)
- extends
- useInboxRealtime
- schemas/inbox.ts
- next.config.mjs
- privacidade/page.tsx
- termos/page.tsx
- ContactPanel
- PascalCase-to-snake_case naming convention
- inbox-app.tsx 3-column layout
- sendMessage Server Action
- postcss.config.mjs
- tailwind.config.ts
- internal network
- src/middleware.ts
- Development test credentials
- VoucherCard
- User model
- WebhookLog model
- crm-kanban.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 116 edges
2. `Button()` - 34 edges
3. `requireClinicSession()` - 27 edges
4. `requireAdminSession()` - 27 edges
5. `useActionFeedback()` - 26 edges
6. `formatCurrency()` - 23 edges
7. `ChatCrmApp()` - 20 edges
8. `Conecta Saúde (plataforma)` - 20 edges
9. `Input()` - 17 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Next.js project (create-next-app bootstrap)` --semantically_similar_to--> `Next.js (App Router, React 18/19, TypeScript)`  [INFERRED] [semantically similar]
  README.md → Prompts.txt
- `Plataforma de Agendamento de Consultas e Exames` --references--> `tailwindcss`  [EXTRACTED]
  Prompts.txt → package.json
- `Plataforma de Agendamento de Consultas e Exames` --references--> `react-hook-form`  [EXTRACTED]
  Prompts.txt → package.json
- `PostgreSQL` --semantically_similar_to--> `postgres service`  [INFERRED] [semantically similar]
  Prompts.txt → docker-compose.prod.yml
- `Prisma ORM` --semantically_similar_to--> `npx prisma migrate deploy`  [INFERRED] [semantically similar]
  Prompts.txt → docker-compose.prod.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Appointment Status Notification Flow** — docs_obsidian_02_dicionario_de_dados_e_banco_appointment, docs_obsidian_02_dicionario_de_dados_e_banco_appointmentstatus_enum, docs_obsidian_03_apis_e_webhooks_n8n_whatsapp_ts, docs_obsidian_03_apis_e_webhooks_n8n_whatsapp_webhook_route [EXTRACTED 1.00]
- **Authentication and Session Authorization Flow** — docs_obsidian_03_apis_e_webhooks_n8n_nextauth_route, docs_obsidian_03_apis_e_webhooks_n8n_auth_ts, docs_obsidian_03_apis_e_webhooks_n8n_middleware_ts, docs_obsidian_03_apis_e_webhooks_n8n_session_ts [EXTRACTED 1.00]
- **Seed Script Populates Dev Credentials by Role** — docs_obsidian_01_setup_e_infraestrutura_prisma_seed_ts, docs_obsidian_01_setup_e_infraestrutura_dev_credentials, docs_obsidian_01_setup_e_infraestrutura_user_role_enum [EXTRACTED 1.00]
- **Production deploy pipeline (Postgres to migrate to app to Nginx)** — docker_compose_prod_postgres, docker_compose_prod_migrate, docker_compose_prod_app, docker_compose_prod_nginx [EXTRACTED 1.00]
- **Docker Production Deploy Pipeline (Postgres → Migrate → App/Nginx)** — docs_obsidian_01_setup_e_infraestrutura_docker_compose_prod_yml, docs_obsidian_01_setup_e_infraestrutura_migrate_service, docs_obsidian_01_setup_e_infraestrutura_dockerfile, docs_obsidian_01_setup_e_infraestrutura_nginx_conf [EXTRACTED 1.00]
- **Fluxo de Split Automático de Pagamentos (Fase 3)** — docs_obsidian_09_roadmap_e_planejamento_estrat_gico_fase_3_m_dulo_fintech_split_autom_tico_de_pagamentos, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_gateway_de_pagamento_com_split_nativo, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_asaas, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_ef_, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_split_autom_tico_e_instant_neo [EXTRACTED 1.00]
- **Fluxo de Validação E2E do Sistema** — docs_obsidian_10_central_de_testes_e_acessos_matriz_de_credenciais_de_acesso, docs_obsidian_10_central_de_testes_e_acessos_roteiro_passo_a_passo_de_testes, docs_obsidian_10_central_de_testes_e_acessos_registro_da_ltima_bateria_de_testes_e2e, docs_obsidian_10_central_de_testes_e_acessos_mapa_completo_de_rotas [EXTRACTED 1.00]
- **Inbox Message Ingestion Pattern** — docs_obsidian_02_dicionario_de_dados_e_banco_contact, docs_obsidian_02_dicionario_de_dados_e_banco_conversation, docs_obsidian_02_dicionario_de_dados_e_banco_message, docs_obsidian_03_apis_e_webhooks_n8n_findorcreateconversation [EXTRACTED 1.00]
- **Mecanismo de sincronização em tempo real do inbox** — docs_obsidian_05_modulo_de_atendimento_e_chat_realtime_useinboxrealtime, docs_obsidian_05_modulo_de_atendimento_e_chat_realtime_polling, docs_obsidian_05_modulo_de_atendimento_e_chat_realtime_supabase_realtime, docs_obsidian_05_modulo_de_atendimento_e_chat_realtime_rls_deny_by_default [EXTRACTED 1.00]
- **Sequenciamento por Fases do Roadmap** — docs_obsidian_09_roadmap_e_planejamento_estrat_gico_fase_1_valida_o_go_to_market, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_fase_2_automa_o_total_no_whatsapp, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_fase_3_m_dulo_fintech_split_autom_tico_de_pagamentos, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_fase_4_vertical_saas_ecossistema_cl_nico_com_ia, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_kpis_e_m_tricas_de_valida_o_por_fase [EXTRACTED 1.00]
- **VoucherCard reaproveitado em 3 fluxos (agendamento, acompanhamento, validação)** — docs_obsidian_07_guia_de_encaminhamento_e_captacao_b2b_vouchercard, docs_obsidian_07_guia_de_encaminhamento_e_captacao_b2b_comprovante_route, docs_obsidian_07_guia_de_encaminhamento_e_captacao_b2b_acompanhar_route [EXTRACTED 1.00]
- **Funil de captação e fechamento B2B** — docs_obsidian_07_guia_de_encaminhamento_e_captacao_b2b_captacao_b2b, docs_obsidian_07_guia_de_encaminhamento_e_captacao_b2b_partnerlead, docs_obsidian_08_playbook_comercial_e_proposta_b2b_proposta_comercial_page, docs_obsidian_08_playbook_comercial_e_proposta_b2b_termo_adesao [INFERRED 0.80]
- **Clinic booking data model flow** — prompts_clinic, prompts_procedure, prompts_clinicprocedure, prompts_appointment [INFERRED 0.85]

## Communities (72 total, 17 thin omitted)

### Community 0 - "format.ts"
Cohesion: 0.06
Nodes (52): getFinancialReport(), getAffiliates(), listClinicAppointments(), updateAppointmentStatus(), AdminAffiliatesPage(), dynamic, revalidate, AdminFinancialReportPage() (+44 more)

### Community 1 - "Conecta Saúde (plataforma)"
Cohesion: 0.07
Nodes (51): postgres:16-alpine Image, postgres_data Volume, postgres Service, 00 - Visão Geral (note), Appointment (status PENDING→CONFIRMED→COMPLETED), Área Admin, Área Clínica, Área Pública (+43 more)

### Community 2 - "dependencies"
Cohesion: 0.04
Nodes (47): @base-ui/react, bcryptjs, class-variance-authority, clsx, cmdk, date-fns, @hookform/resolvers, lucide-react (+39 more)

### Community 3 - "Clinic model"
Cohesion: 0.06
Nodes (47): Appointment model, AppointmentStatus enum, CannedResponse model, Clinic model, ClinicProcedure model, Contact model, Conversation model, Message model (+39 more)

### Community 4 - "booking-dialog.tsx"
Cohesion: 0.09
Nodes (32): createAppointment(), getAffiliateRefCode(), getAppointmentById(), TrackingPage(), TrackingPageProps, ComprovantePage(), ComprovantePageProps, metadata (+24 more)

### Community 5 - "Fase 2 — Automação Total no WhatsApp"
Cohesion: 0.07
Nodes (41): 00 - Visão Geral, 02 - Dicionário de Dados e Banco, 03 - APIs e Webhooks n8n, 07 - Guia de Encaminhamento e Captação B2B, 08 - Playbook Comercial e Proposta B2B, /admin/relatorio, Asaas, Efí (+33 more)

### Community 6 - "whatsapp.ts"
Cohesion: 0.10
Nodes (27): extractIncomingMessage(), findOrCreateConversation(), IncomingMessage, logInbound(), POST(), resolveStatusFromReply(), globalForPrisma, prisma (+19 more)

### Community 7 - "(public)/page.tsx"
Cohesion: 0.07
Nodes (28): buildQueryConditions(), CATEGORY_SYNONYMS, getFeaturedClinics(), getSpecialtyStartingPrices(), MEDICAL_SYNONYMS, searchClinicProcedures(), SearchFilters, stripAccents() (+20 more)

### Community 8 - "devDependencies"
Cohesion: 0.05
Nodes (37): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, postcss (+29 more)

### Community 9 - "inbox-layout.tsx"
Cohesion: 0.20
Nodes (17): CRMKanbanProps, InboxLayout(), InboxLayoutProps, PRESET_TAGS, tagClasses(), MessageBubble(), MessageBubbleProps, ScheduleModal() (+9 more)

### Community 10 - "Plataforma de Agendamento de Consultas e Exames"
Cohesion: 0.08
Nodes (29): app service, docker-compose.yml (dev, Postgres only), Dockerfile, docs/obsidian/04 - Manual de Edição Manual e Manutenção.md, migrate service, nginx service, deploy/nginx.conf, postgres service (+21 more)

### Community 11 - "VoucherCard component"
Cohesion: 0.08
Nodes (29): /acompanhar/[id] route, /admin/leads panel, buildWhatsAppLink(), Captação B2B (Seja um Parceiro), /comprovante/[id] route, createAppointment action, getBaseUrl(), Guia Digital / Voucher de Encaminhamento (+21 more)

### Community 12 - "actions/inbox.ts"
Cohesion: 0.16
Nodes (26): ACTIVE_STATUSES, assignConversationToMe(), assignConversationToUser(), getChatContactHistory(), getConversation(), INBOX_FILTER_TO_CONVERSATION_FILTER, listCannedResponses(), listChatAgents() (+18 more)

### Community 13 - "ChatCrmApp"
Cohesion: 0.07
Nodes (11): dynamic, revalidate, dynamic, revalidate, dynamic, revalidate, dynamic, revalidate (+3 more)

### Community 14 - "compilerOptions"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 15 - "chat-crm-app.tsx"
Cohesion: 0.17
Nodes (24): ACTIVE_STATUSES, assignConversationToUserAdmin(), getChatContactHistoryAdmin(), getChatMessagesAdmin(), getConversationAdmin(), INBOX_FILTER_TO_CONVERSATION_FILTER, listCannedResponsesAdmin(), listChatAgentsAdmin() (+16 more)

### Community 16 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 17 - "select.tsx"
Cohesion: 0.13
Nodes (17): StatusFilter(), statusOptions, appointmentTypeOptions, cityOptions, labelFor(), priceOptions, ratingOptions, ResultFilters() (+9 more)

### Community 18 - "cn"
Cohesion: 0.14
Nodes (16): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), CardAction(), CardDescription() (+8 more)

### Community 19 - "affiliates.ts"
Cohesion: 0.15
Nodes (17): generateAffiliateCode(), generateUniqueAffiliateCode(), getAffiliateDashboard(), getAffiliateSession(), AffiliatePanelPage(), AFFILIATE_COMMISSION_FLAT, AFFILIATE_REF_COOKIE, AFFILIATE_REF_COOKIE_MAX_AGE (+9 more)

### Community 20 - "clinicas/page.tsx"
Cohesion: 0.17
Nodes (15): createClinic(), getKpis(), listClinics(), updateClinic(), AdminClinicsPage(), dynamic, revalidate, AdminDashboardPage() (+7 more)

### Community 21 - "button.tsx"
Cohesion: 0.20
Nodes (10): loginAffiliateAction(), SUGGESTED_TAGS, AffiliateCopyLinkButton(), AffiliateLoginForm(), handleSubmit(), Button(), buttonVariants, Calendar() (+2 more)

### Community 22 - "useActionFeedback"
Cohesion: 0.18
Nodes (15): logoutAffiliateAction(), updateClinicBusinessHours(), updateClinicProcedure(), approveAndRegisterClinic(), ApproveClinicDialog(), handleSubmit(), BusinessHoursForm(), handleSubmit() (+7 more)

### Community 23 - "painel/page.tsx"
Cohesion: 0.22
Nodes (13): listPartnerLeads(), AdminLeadsPage(), dynamic, revalidate, dynamic, revalidate, dynamic, metadata (+5 more)

### Community 24 - "logo.tsx"
Cohesion: 0.13
Nodes (13): navLinks, brandTextClasses, iconSizeClasses, Logo(), LogoIcon(), LogoSize, LogoVariant, subtitleTextClasses (+5 more)

### Community 25 - "chat-window.tsx"
Cohesion: 0.17
Nodes (11): CannedResponseMenu(), ChatWindow(), dateLabel(), initials(), MessageBubble(), MessageBubbleData, ConversationDetail, ConversationListItem (+3 more)

### Community 26 - "affiliate-signup-form.tsx"
Cohesion: 0.17
Nodes (11): registerAffiliate(), addClinicProcedure(), audiences, metadata, steps, AddProcedureForm(), handleSubmit(), AffiliateSignupForm() (+3 more)

### Community 27 - "procedimentos/[id]/page.tsx"
Cohesion: 0.23
Nodes (11): getClinicProcedureDetail(), DetailPageProps, ProcedureDetailPage(), clinicPhotos, FeaturedClinic, RatingStars(), Badge(), badgeVariants (+3 more)

### Community 28 - "migration 20260816022709_add_inbox_module"
Cohesion: 0.18
Nodes (14): CannedResponse model, CannedResponseMenu component, Contact model, Conversation model, findOrCreateConversation, Message model, migration 20260816022709_add_inbox_module, Single global WhatsApp number limitation (+6 more)

### Community 29 - "conversation-list.tsx"
Cohesion: 0.22
Nodes (11): ConversationList(), filterLabels, formatTime(), initials(), ScrollArea(), ScrollBar(), Tabs(), TabsContent() (+3 more)

### Community 30 - "chat-crm-adapters.ts"
Cohesion: 0.17
Nodes (12): getChatMessages(), channelFromDb, ConversationWithRelations, departmentFromDb, departmentToDb, formatMessageTimestamp(), funnelStageBadgeVariant, funnelStageFromDb (+4 more)

### Community 31 - "(admin)/layout.tsx"
Cohesion: 0.23
Nodes (6): dynamic, revalidate, handler, AdminNav(), navItems, authOptions

### Community 32 - "command.tsx"
Cohesion: 0.24
Nodes (10): Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator() (+2 more)

### Community 33 - "partner-lead-form.tsx"
Cohesion: 0.24
Nodes (7): submitPartnerLead(), benefits, metadata, neighborhoods, PartnerLeadForm(), handleSubmit(), Textarea()

### Community 34 - "seed.ts"
Cohesion: 0.20
Nodes (8): clinicProceduresData, clinicsData, consultationProceduresData, defaultBusinessHours, otherProceduresData, prisma, specialtiesData, urolaserProceduresData

### Community 35 - "actions/clinic.ts"
Cohesion: 0.40
Nodes (7): businessHoursDays, addClinicProcedureSchema, BusinessHours, businessHoursDaySchema, businessHoursSchema, updateAppointmentStatusSchema, updateClinicProcedureSchema

### Community 36 - "(clinic)/layout.tsx"
Cohesion: 0.27
Nodes (7): getClinicInfo(), ClinicLayout(), dynamic, revalidate, ClinicNav(), navItems, SignOutButton()

### Community 37 - "partner-leads.ts"
Cohesion: 0.29
Nodes (7): updatePartnerLeadStatus(), PartnerLeadStatusForm(), handleSave(), statusOptions, partnerLeadStatusLabels, SubmitPartnerLeadInput, submitPartnerLeadSchema

### Community 38 - "app/layout.tsx"
Cohesion: 0.24
Nodes (7): geistMono, geistSans, metadata, RootLayout(), SessionProvider(), Toaster(), TooltipProvider()

### Community 39 - "scroll-showcase.tsx"
Cohesion: 0.20
Nodes (5): PhoneShowcase(), ScreenLayer(), ScrollShowcase(), StepDefinition, steps

### Community 40 - "clinic/page.tsx"
Cohesion: 0.36
Nodes (7): getClinicOverview(), ClinicDashboardPage(), dynamic, revalidate, statusBadge, addUTCDays(), startOfUTCDay()

### Community 41 - "input-group.tsx"
Cohesion: 0.28
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 42 - "entrar/page.tsx"
Cohesion: 0.36
Nodes (3): LoginForm(), LoginInput, loginSchema

### Community 43 - "precos/page.tsx"
Cohesion: 0.43
Nodes (6): listClinicProcedures(), listProceduresNotOffered(), ClinicSettingsPage(), dynamic, revalidate, toPlainClinicProcedureItem()

### Community 44 - "faq-section.tsx"
Cohesion: 0.48
Nodes (5): faqs, Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 45 - "popover.tsx"
Cohesion: 0.29
Nodes (4): PopoverContent(), PopoverDescription(), PopoverHeader(), PopoverTitle()

### Community 46 - "logo-icon.svg"
Cohesion: 0.33
Nodes (5): Conecta Saude Brand, favicon.ico, conectaSaudeIconGradient (linear gradient #0284c7 to #0d9488), Conecta Saude Icon Mark (rounded square, pulse line, connection dots), src/app/icon.svg (Favicon Convention File)

### Community 47 - "ClinicProcedure model"
Cohesion: 0.47
Nodes (6): Appointment model, Clinic model, ClinicProcedure model, Procedure model, prisma/seed.ts, Specialty model

### Community 48 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 49 - "conectasaudevc.com.br (domínio oficial de produção)"
Cohesion: 0.40
Nodes (5): conectasaudevc.com.br (domínio oficial de produção), getBaseUrl(), src/app/layout.tsx, src/lib/format.ts, VERCEL_ENV / VERCEL_URL

### Community 50 - "Conecta Saúde Brand Logo (public/logo.svg)"
Cohesion: 0.60
Nodes (5): Conecta Saúde Brand Logo (public/logo.svg), Brand Gradient (#0284c7 blue → #0d9488 teal), Logo Symbol (rounded square + pulse/connection path + 4 dots), "VITÓRIA DA CONQUISTA" Tagline, "Conecta Saúde" Wordmark Text

### Community 51 - "extends"
Cohesion: 0.50
Nodes (3): extends, next/core-web-vitals, next/typescript

### Community 71 - "crm-kanban.tsx"
Cohesion: 0.29
Nodes (8): AvatarBadge(), initialsFor(), CRMKanban(), KanbanStage, kanbanStageOf(), parseEstimatedValue(), STAGE_ORDER, STAGES

## Ambiguous Edges - Review These
- `Clinic model` → `PartnerLead model`  [AMBIGUOUS]
  docs/obsidian/02 - Dicionário de Dados e Banco.md · relation: conceptually_related_to
- `Procedure model` → `Specialty model`  [AMBIGUOUS]
  Prompts.txt · relation: conceptually_related_to

## Knowledge Gaps
- **313 isolated node(s):** `AgendamentosPageProps`, `CommissionRow`, `SpecialtyItem`, `ChatCrmAppProps`, `Scope` (+308 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Clinic model` and `PartnerLead model`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Procedure model` and `Specialty model`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `cn()` connect `cn` to `command.tsx`, `format.ts`, `partner-lead-form.tsx`, `booking-dialog.tsx`, `app/layout.tsx`, `(public)/page.tsx`, `scroll-showcase.tsx`, `input-group.tsx`, `faq-section.tsx`, `popover.tsx`, `select.tsx`, `button.tsx`, `painel/page.tsx`, `logo.tsx`, `chat-window.tsx`, `affiliate-signup-form.tsx`, `procedimentos/[id]/page.tsx`, `conversation-list.tsx`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `Button()` connect `button.tsx` to `format.ts`, `partner-lead-form.tsx`, `booking-dialog.tsx`, `partner-leads.ts`, `(clinic)/layout.tsx`, `(public)/page.tsx`, `input-group.tsx`, `entrar/page.tsx`, `cn`, `clinicas/page.tsx`, `useActionFeedback`, `painel/page.tsx`, `logo.tsx`, `chat-window.tsx`, `affiliate-signup-form.tsx`, `procedimentos/[id]/page.tsx`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `useActionFeedback()` connect `useActionFeedback` to `format.ts`, `partner-lead-form.tsx`, `partner-leads.ts`, `clinicas/page.tsx`, `button.tsx`, `painel/page.tsx`, `affiliate-signup-form.tsx`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `AgendamentosPageProps`, `CommissionRow`, `SpecialtyItem` to the rest of the system?**
  _313 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `format.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06153846153846154 - nodes in this community are weakly interconnected._