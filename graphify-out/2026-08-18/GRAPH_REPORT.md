# Graph Report - MARCACAO  (2026-08-16)

## Corpus Check
- 145 files · ~175,513 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 910 nodes · 1782 edges · 51 communities (36 shown, 15 thin omitted)
- Extraction: 98% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.79)
- Token cost: 472,407 input · 53,449 output

## Community Hubs (Navigation)
- Admin & Clinic Server Actions
- Booking & Search Server Actions
- Clinic Financial Overview
- Platform Overview & Local Postgres
- Runtime Dependencies
- Auth Route & WhatsApp Webhook
- Data Model Documentation
- Strategic Roadmap
- Inbox Server Actions
- Dev Tooling Dependencies
- Referral Guide & B2B Capture Docs
- Production Deploy Config
- TypeScript Config
- Admin & Clinic Panel Layouts
- Status Management UI
- shadcn/ui Config
- Command Palette & Canned Responses
- Landing Page Sections
- UI Primitives (Avatar/Card)
- Chat Window UI
- Inbox Module Documentation
- Conversation List UI
- Sheet UI Primitive
- Database Seed Data
- Root App Layout
- Input Group UI
- FAQ Accordion UI
- Brand Icon Asset
- Original Project Prompt
- NextAuth Type Augmentation
- Official Domain Configuration
- Brand Logo Asset
- ESLint Config
- PostCSS Config
- Privacy Policy Page
- Terms of Use Page
- Schema Naming Convention
- Inbox Layout & Notification Sound
- WhatsApp Message Sending
- Next.js Config
- Route Middleware
- Tailwind Config
- Docker Internal Network
- Middleware Reference (doc)
- Dev Test Credentials
- VoucherCard Reference
- User Model
- WebhookLog Model

## God Nodes (most connected - your core abstractions)
1. `cn()` - 112 edges
2. `Button()` - 29 edges
3. `requireClinicSession()` - 22 edges
4. `Conecta Saúde (plataforma)` - 20 edges
5. `useActionFeedback()` - 18 edges
6. `Input()` - 16 edges
7. `compilerOptions` - 16 edges
8. `InboxApp()` - 13 edges
9. `Badge()` - 13 edges
10. `Card()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Next.js project (create-next-app bootstrap)` --semantically_similar_to--> `Next.js (App Router, React 18/19, TypeScript)`  [INFERRED] [semantically similar]
  README.md → Prompts.txt
- `PostgreSQL` --semantically_similar_to--> `postgres service`  [INFERRED] [semantically similar]
  Prompts.txt → docker-compose.prod.yml
- `Prisma ORM` --semantically_similar_to--> `npx prisma migrate deploy`  [INFERRED] [semantically similar]
  Prompts.txt → docker-compose.prod.yml
- `NextAuth (JWT / Credentials)` --conceptually_related_to--> `app service`  [INFERRED]
  Prompts.txt → docker-compose.prod.yml
- `app service` --conceptually_related_to--> `Plataforma de Agendamento de Consultas e Exames`  [INFERRED]
  docker-compose.prod.yml → Prompts.txt

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Production deploy pipeline (Postgres to migrate to app to Nginx)** — docker_compose_prod_postgres, docker_compose_prod_migrate, docker_compose_prod_app, docker_compose_prod_nginx [EXTRACTED 1.00]
- **Clinic booking data model flow** — prompts_clinic, prompts_procedure, prompts_clinicprocedure, prompts_appointment [INFERRED 0.85]
- **Docker Production Deploy Pipeline (Postgres → Migrate → App/Nginx)** — docs_obsidian_01_setup_e_infraestrutura_docker_compose_prod_yml, docs_obsidian_01_setup_e_infraestrutura_migrate_service, docs_obsidian_01_setup_e_infraestrutura_dockerfile, docs_obsidian_01_setup_e_infraestrutura_nginx_conf [EXTRACTED 1.00]
- **Seed Script Populates Dev Credentials by Role** — docs_obsidian_01_setup_e_infraestrutura_prisma_seed_ts, docs_obsidian_01_setup_e_infraestrutura_dev_credentials, docs_obsidian_01_setup_e_infraestrutura_user_role_enum [EXTRACTED 1.00]
- **Appointment Status Notification Flow** — docs_obsidian_02_dicionario_de_dados_e_banco_appointment, docs_obsidian_02_dicionario_de_dados_e_banco_appointmentstatus_enum, docs_obsidian_03_apis_e_webhooks_n8n_whatsapp_ts, docs_obsidian_03_apis_e_webhooks_n8n_whatsapp_webhook_route [EXTRACTED 1.00]
- **Authentication and Session Authorization Flow** — docs_obsidian_03_apis_e_webhooks_n8n_nextauth_route, docs_obsidian_03_apis_e_webhooks_n8n_auth_ts, docs_obsidian_03_apis_e_webhooks_n8n_middleware_ts, docs_obsidian_03_apis_e_webhooks_n8n_session_ts [EXTRACTED 1.00]
- **Inbox Message Ingestion Pattern** — docs_obsidian_02_dicionario_de_dados_e_banco_contact, docs_obsidian_02_dicionario_de_dados_e_banco_conversation, docs_obsidian_02_dicionario_de_dados_e_banco_message, docs_obsidian_03_apis_e_webhooks_n8n_findorcreateconversation [EXTRACTED 1.00]
- **Funil de captação e fechamento B2B** — docs_obsidian_07_guia_de_encaminhamento_e_captacao_b2b_captacao_b2b, docs_obsidian_07_guia_de_encaminhamento_e_captacao_b2b_partnerlead, docs_obsidian_08_playbook_comercial_e_proposta_b2b_proposta_comercial_page, docs_obsidian_08_playbook_comercial_e_proposta_b2b_termo_adesao [INFERRED 0.80]
- **Mecanismo de sincronização em tempo real do inbox** — docs_obsidian_05_modulo_de_atendimento_e_chat_realtime_useinboxrealtime, docs_obsidian_05_modulo_de_atendimento_e_chat_realtime_polling, docs_obsidian_05_modulo_de_atendimento_e_chat_realtime_supabase_realtime, docs_obsidian_05_modulo_de_atendimento_e_chat_realtime_rls_deny_by_default [EXTRACTED 1.00]
- **VoucherCard reaproveitado em 3 fluxos (agendamento, acompanhamento, validação)** — docs_obsidian_07_guia_de_encaminhamento_e_captacao_b2b_vouchercard, docs_obsidian_07_guia_de_encaminhamento_e_captacao_b2b_comprovante_route, docs_obsidian_07_guia_de_encaminhamento_e_captacao_b2b_acompanhar_route [EXTRACTED 1.00]
- **Sequenciamento por Fases do Roadmap** — docs_obsidian_09_roadmap_e_planejamento_estrat_gico_fase_1_valida_o_go_to_market, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_fase_2_automa_o_total_no_whatsapp, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_fase_3_m_dulo_fintech_split_autom_tico_de_pagamentos, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_fase_4_vertical_saas_ecossistema_cl_nico_com_ia, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_kpis_e_m_tricas_de_valida_o_por_fase [EXTRACTED 1.00]
- **Fluxo de Split Automático de Pagamentos (Fase 3)** — docs_obsidian_09_roadmap_e_planejamento_estrat_gico_fase_3_m_dulo_fintech_split_autom_tico_de_pagamentos, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_gateway_de_pagamento_com_split_nativo, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_asaas, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_ef_, docs_obsidian_09_roadmap_e_planejamento_estrat_gico_split_autom_tico_e_instant_neo [EXTRACTED 1.00]
- **Fluxo de Validação E2E do Sistema** — docs_obsidian_10_central_de_testes_e_acessos_matriz_de_credenciais_de_acesso, docs_obsidian_10_central_de_testes_e_acessos_roteiro_passo_a_passo_de_testes, docs_obsidian_10_central_de_testes_e_acessos_registro_da_ltima_bateria_de_testes_e2e, docs_obsidian_10_central_de_testes_e_acessos_mapa_completo_de_rotas [EXTRACTED 1.00]

## Communities (51 total, 15 thin omitted)

### Community 0 - "Admin & Clinic Server Actions"
Cohesion: 0.06
Nodes (60): createClinic(), getKpis(), listClinics(), updateClinic(), addClinicProcedure(), updateAppointmentStatus(), updateClinicBusinessHours(), updateClinicProcedure() (+52 more)

### Community 1 - "Booking & Search Server Actions"
Cohesion: 0.06
Nodes (56): createAppointment(), getAppointmentById(), listPartnerLeads(), getClinicProcedureDetail(), searchClinicProcedures(), SearchFilters, AdminLeadsPage(), dynamic (+48 more)

### Community 2 - "Clinic Financial Overview"
Cohesion: 0.08
Nodes (43): getFinancialReport(), businessHoursDays, getClinicOverview(), listClinicAppointments(), listClinicProcedures(), listProceduresNotOffered(), AdminFinancialReportPage(), dynamic (+35 more)

### Community 3 - "Platform Overview & Local Postgres"
Cohesion: 0.07
Nodes (51): postgres:16-alpine Image, postgres_data Volume, postgres Service, 00 - Visão Geral (note), Appointment (status PENDING→CONFIRMED→COMPLETED), Área Admin, Área Clínica, Área Pública (+43 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.04
Nodes (49): @base-ui/react, bcryptjs, class-variance-authority, clsx, cmdk, date-fns, @hookform/resolvers, lucide-react (+41 more)

### Community 5 - "Auth Route & WhatsApp Webhook"
Cohesion: 0.08
Nodes (31): handler, extractIncomingMessage(), findOrCreateConversation(), IncomingMessage, logInbound(), POST(), resolveStatusFromReply(), authOptions (+23 more)

### Community 6 - "Data Model Documentation"
Cohesion: 0.06
Nodes (47): Appointment model, AppointmentStatus enum, CannedResponse model, Clinic model, ClinicProcedure model, Contact model, Conversation model, Message model (+39 more)

### Community 7 - "Strategic Roadmap"
Cohesion: 0.07
Nodes (41): 00 - Visão Geral, 02 - Dicionário de Dados e Banco, 03 - APIs e Webhooks n8n, 07 - Guia de Encaminhamento e Captação B2B, 08 - Playbook Comercial e Proposta B2B, /admin/relatorio, Asaas, Efí (+33 more)

### Community 8 - "Inbox Server Actions"
Cohesion: 0.10
Nodes (29): ACTIVE_STATUSES, assignConversationToMe(), getConversation(), listCannedResponses(), listClinicProceduresForAppointment(), listConversations(), markConversationRead(), reopenConversation() (+21 more)

### Community 9 - "Dev Tooling Dependencies"
Cohesion: 0.05
Nodes (39): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, postcss (+31 more)

### Community 10 - "Referral Guide & B2B Capture Docs"
Cohesion: 0.08
Nodes (29): /acompanhar/[id] route, /admin/leads panel, buildWhatsAppLink(), Captação B2B (Seja um Parceiro), /comprovante/[id] route, createAppointment action, getBaseUrl(), Guia Digital / Voucher de Encaminhamento (+21 more)

### Community 11 - "Production Deploy Config"
Cohesion: 0.09
Nodes (27): app service, docker-compose.yml (dev, Postgres only), Dockerfile, docs/obsidian/04 - Manual de Edição Manual e Manutenção.md, migrate service, nginx service, deploy/nginx.conf, postgres service (+19 more)

### Community 12 - "TypeScript Config"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 13 - "Admin & Clinic Panel Layouts"
Cohesion: 0.10
Nodes (19): getClinicInfo(), dynamic, revalidate, ClinicLayout(), dynamic, revalidate, navLinks, brandTextClasses (+11 more)

### Community 14 - "Status Management UI"
Cohesion: 0.11
Nodes (21): updatePartnerLeadStatus(), PartnerLeadStatusForm(), handleSave(), statusOptions, StatusFilter(), statusOptions, appointmentTypeOptions, labelFor() (+13 more)

### Community 15 - "shadcn/ui Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 16 - "Command Palette & Canned Responses"
Cohesion: 0.13
Nodes (17): Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator() (+9 more)

### Community 17 - "Landing Page Sections"
Cohesion: 0.12
Nodes (15): getFeaturedClinics(), dynamic, HomePage(), benefits, BenefitsSection(), FaqSection(), HeroSearch(), HeroSection() (+7 more)

### Community 18 - "UI Primitives (Avatar/Card)"
Cohesion: 0.18
Nodes (14): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), CardAction(), CardDescription() (+6 more)

### Community 19 - "Chat Window UI"
Cohesion: 0.19
Nodes (10): CannedResponseMenu(), ChatWindow(), dateLabel(), initials(), MessageBubble(), MessageBubbleData, Tooltip(), TooltipContent() (+2 more)

### Community 20 - "Inbox Module Documentation"
Cohesion: 0.18
Nodes (14): CannedResponse model, CannedResponseMenu component, Contact model, Conversation model, findOrCreateConversation, Message model, migration 20260816022709_add_inbox_module, Single global WhatsApp number limitation (+6 more)

### Community 21 - "Conversation List UI"
Cohesion: 0.22
Nodes (11): ConversationList(), filterLabels, formatTime(), initials(), ScrollArea(), ScrollBar(), Tabs(), TabsContent() (+3 more)

### Community 22 - "Sheet UI Primitive"
Cohesion: 0.18
Nodes (6): SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 23 - "Database Seed Data"
Cohesion: 0.22
Nodes (7): clinicProceduresData, clinicsData, consultationProceduresData, defaultBusinessHours, otherProceduresData, prisma, specialtiesData

### Community 24 - "Root App Layout"
Cohesion: 0.28
Nodes (6): geistMono, geistSans, metadata, RootLayout(), SessionProvider(), Toaster()

### Community 25 - "Input Group UI"
Cohesion: 0.28
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 26 - "FAQ Accordion UI"
Cohesion: 0.48
Nodes (5): faqs, Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 27 - "Brand Icon Asset"
Cohesion: 0.33
Nodes (5): Conecta Saude Brand, favicon.ico, conectaSaudeIconGradient (linear gradient #0284c7 to #0d9488), Conecta Saude Icon Mark (rounded square, pulse line, connection dots), src/app/icon.svg (Favicon Convention File)

### Community 28 - "Original Project Prompt"
Cohesion: 0.47
Nodes (6): Appointment model, Clinic model, ClinicProcedure model, Procedure model, prisma/seed.ts, Specialty model

### Community 29 - "NextAuth Type Augmentation"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 30 - "Official Domain Configuration"
Cohesion: 0.40
Nodes (5): conectasaudevc.com.br (domínio oficial de produção), getBaseUrl(), src/app/layout.tsx, src/lib/format.ts, VERCEL_ENV / VERCEL_URL

### Community 31 - "Brand Logo Asset"
Cohesion: 0.60
Nodes (5): Conecta Saúde Brand Logo (public/logo.svg), Brand Gradient (#0284c7 blue → #0d9488 teal), Logo Symbol (rounded square + pulse/connection path + 4 dots), "VITÓRIA DA CONQUISTA" Tagline, "Conecta Saúde" Wordmark Text

### Community 32 - "ESLint Config"
Cohesion: 0.50
Nodes (3): extends, next/core-web-vitals, next/typescript

## Ambiguous Edges - Review These
- `Specialty model` → `Procedure model`  [AMBIGUOUS]
  Prompts.txt · relation: conceptually_related_to
- `Clinic model` → `PartnerLead model`  [AMBIGUOUS]
  docs/obsidian/02 - Dicionário de Dados e Banco.md · relation: conceptually_related_to

## Knowledge Gaps
- **270 isolated node(s):** `next/core-web-vitals`, `next/typescript`, `$schema`, `style`, `rsc` (+265 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Specialty model` and `Procedure model`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Clinic model` and `PartnerLead model`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `cn()` connect `UI Primitives (Avatar/Card)` to `Admin & Clinic Server Actions`, `Booking & Search Server Actions`, `Clinic Financial Overview`, `Admin & Clinic Panel Layouts`, `Status Management UI`, `Command Palette & Canned Responses`, `Landing Page Sections`, `Chat Window UI`, `Conversation List UI`, `Sheet UI Primitive`, `Root App Layout`, `Input Group UI`, `FAQ Accordion UI`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `Button()` connect `Admin & Clinic Server Actions` to `Booking & Search Server Actions`, `Admin & Clinic Panel Layouts`, `Status Management UI`, `Command Palette & Canned Responses`, `Landing Page Sections`, `UI Primitives (Avatar/Card)`, `Chat Window UI`, `Sheet UI Primitive`, `Input Group UI`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `prisma` connect `Auth Route & WhatsApp Webhook` to `Admin & Clinic Server Actions`, `Booking & Search Server Actions`, `Clinic Financial Overview`, `Inbox Server Actions`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `next/typescript`, `$schema` to the rest of the system?**
  _270 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin & Clinic Server Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.05917602996254682 - nodes in this community are weakly interconnected._