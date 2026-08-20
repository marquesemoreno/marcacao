# Graph Report - MARCACAO  (2026-08-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2291 nodes · 4195 edges · 163 communities (112 shown, 51 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 82 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fc5975d3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cn
- format.ts
- validate_data.py
- appointments.ts
- gray
- Conecta Saúde (plataforma)
- search
- Clinic model
- button
- slide_search_core.py
- Fase 2 — Automação Total no WhatsApp
- actions/inbox.ts
- search.ts
- procedimentos/[id]/page.tsx
- dependencies
- scripts/core.py
- leads/page.tsx
- spacing
- inbox-layout.tsx
- ChatCrmApp
- TestTailwindConfigGenerator
- search_stack
- read_rows
- chat-crm-app.tsx
- booking-dialog.tsx
- VoucherCard component
- html-token-validator.py
- actions/admin.ts
- affiliates.ts
- search
- compilerOptions
- DesignSystemGenerator
- seja-parceiro/page.tsx
- BM25
- color
- BM25
- devDependencies
- design_system.py
- TailwindConfigGenerator
- components.json
- Plataforma de Agendamento de Consultas e Exames
- logo.tsx
- button.tsx
- generate-slide.py
- fetch-background.py
- radius
- partner-lead-status-form.tsx
- TestThresholdGate
- actions/clinic.ts
- icon/generate.py
- fontSize
- CatalogRefreshTest
- TestShadcnInstaller
- detect_domain
- _palette_is_dark
- extract-colors.cjs
- validate-asset.cjs
- migration 20260816022709_add_inbox_module
- scripts
- chat-crm-adapters.ts
- design-tokens-starter.json
- _select_palette_for_mode
- test_design_system_mode.py
- validate-tokens.cjs
- ShadcnInstaller
- .check_shadcn_config
- .generate_config_string
- patch
- conversation-list.tsx
- inject-brand-context.cjs
- embed-tokens.cjs
- test_tailwind_config_gen.py
- generate_design_system
- chatbot.ts
- logo/generate.py
- generate-tokens.cjs
- duration
- ._base_config
- parse_decision_rules
- test_text_layout_resilience.py
- seed.ts
- clinic/page.tsx
- app/layout.tsx
- scroll-showcase.tsx
- sync-brand-to-tokens.cjs
- _run
- (clinic)/layout.tsx
- _row_identities
- whatsapp.ts
- reminders.ts
- entrar/page.tsx
- .generate
- Next.js project (create-next-app bootstrap)
- appointment-actions.tsx
- logo-icon.svg
- ClinicProcedure model
- next-auth.d.ts
- sm
- conectasaudevc.com.br (domínio oficial de produção)
- Conecta Saúde Brand Logo (public/logo.svg)
- xl
- none
- extends
- how-it-works.tsx
- useInboxRealtime
- test_sync_brand_to_tokens.py
- main
- destructive-foreground
- primary
- primary-foreground
- whatsapp-templates.ts
- .__init__
- .temp_project
- buscar/page.tsx
- privacidade/page.tsx
- termos/page.tsx
- ContactPanel
- .test_add_components_no_config
- .test_list_installed_empty
- .test_init_custom_project_root
- .test_check_shadcn_config_not_exists
- .test_get_installed_components_empty
- .test_get_installed_components_no_config
- .test_add_components_no_components
- .test_add_fonts
- .test_recommend_plugins
- .test_recommend_plugins_nextjs
- .test_init_default_typescript
- .test_generate_javascript_config
- .test_generate_config_with_colors
- .test_generate_config_with_plugins
- .test_validate_config_valid
- .test_validate_config_no_content
- .test_write_config_creates_content
- .test_write_config_invalid_path
- .test_full_configuration_typescript
- .test_default_output_path_typescript
- .test_base_config_structure
- .test_default_content_paths_react
- .test_default_content_paths_vue
- clsx
- date-fns
- PascalCase-to-snake_case naming convention
- inbox-app.tsx 3-column layout
- sendMessage Server Action
- next.config.mjs
- shadcn
- @supabase/supabase-js
- postcss.config.mjs
- tailwind.config.ts
- internal network
- src/middleware.ts
- Development test credentials
- VoucherCard
- User model
- WebhookLog model
- prisma.ts
- whatsapp/route.ts
- site-footer.tsx
- secondary-foreground

## God Nodes (most connected - your core abstractions)
1. `cn()` - 118 edges
2. `TailwindConfigGenerator` - 58 edges
3. `search()` - 43 edges
4. `Button()` - 39 edges
5. `requireAdminSession()` - 36 edges
6. `TestTailwindConfigGenerator` - 35 edges
7. `DesignSystemGenerator` - 35 edges
8. `search_stack()` - 35 edges
9. `ShadcnInstaller` - 34 edges
10. `requireClinicSession()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Next.js project (create-next-app bootstrap)` --semantically_similar_to--> `Next.js (App Router, React 18/19, TypeScript)`  [INFERRED] [semantically similar]
  README.md → Prompts.txt
- `Plataforma de Agendamento de Consultas e Exames` --references--> `react-hook-form`  [EXTRACTED]
  Prompts.txt → package.json
- `Plataforma de Agendamento de Consultas e Exames` --references--> `tailwindcss`  [EXTRACTED]
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

## Communities (163 total, 51 thin omitted)

### Community 0 - "cn"
Cohesion: 0.05
Nodes (53): CannedResponseMenu(), ChatWindow(), dateLabel(), initials(), MessageBubble(), MessageBubbleData, Category, cityOptions (+45 more)

### Community 1 - "format.ts"
Cohesion: 0.09
Nodes (43): getAffiliateDashboard(), getAffiliates(), getAffiliateSession(), AdminAffiliatesPage(), dynamic, revalidate, dynamic, revalidate (+35 more)

### Community 2 - "validate_data.py"
Cohesion: 0.08
Nodes (46): read_rows(), TestAccessibilityGuidance, TestChartsTypographyAndIcons, TestCurrentReactGuidance, TestSemanticColors, _catalog_date(), _check_app_interface_contract(), _check_catalog_contract() (+38 more)

### Community 3 - "appointments.ts"
Cohesion: 0.17
Nodes (15): createAppointment(), getAffiliateRefCode(), getAppointmentById(), TrackingPage(), TrackingPageProps, ComprovantePage(), ComprovantePageProps, metadata (+7 more)

### Community 4 - "gray"
Cohesion: 0.05
Nodes (53): $type, $value, $type, $value, $type, $value, $type, $value (+45 more)

### Community 5 - "Conecta Saúde (plataforma)"
Cohesion: 0.07
Nodes (51): postgres:16-alpine Image, postgres_data Volume, postgres Service, 00 - Visão Geral (note), Appointment (status PENDING→CONFIRMED→COMPLETED), Área Admin, Área Clínica, Área Pública (+43 more)

### Community 6 - "search"
Cohesion: 0.07
Nodes (42): BM25, detect_domain(), get_cip_brief(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection (+34 more)

### Community 7 - "Clinic model"
Cohesion: 0.06
Nodes (47): Appointment model, AppointmentStatus enum, CannedResponse model, Clinic model, ClinicProcedure model, Contact model, Conversation model, Message model (+39 more)

### Community 8 - "button"
Cohesion: 0.06
Nodes (45): $type, $value, $type, $value, bg, fg, font-size, hover-bg (+37 more)

### Community 9 - "slide_search_core.py"
Cohesion: 0.08
Nodes (36): format_context(), format_result(), main(), Format a single search result for display, Format contextual recommendations for display., BM25, calculate_pattern_break(), detect_domain() (+28 more)

### Community 10 - "Fase 2 — Automação Total no WhatsApp"
Cohesion: 0.07
Nodes (41): 00 - Visão Geral, 02 - Dicionário de Dados e Banco, 03 - APIs e Webhooks n8n, 07 - Guia de Encaminhamento e Captação B2B, 08 - Playbook Comercial e Proposta B2B, /admin/relatorio, Asaas, Efí (+33 more)

### Community 11 - "actions/inbox.ts"
Cohesion: 0.12
Nodes (34): ACTIVE_STATUSES, assignConversationToMe(), assignConversationToUser(), claimConversation(), getAttendantCapacity(), getChatContactHistory(), getConversation(), INBOX_FILTER_TO_CONVERSATION_FILTER (+26 more)

### Community 12 - "search.ts"
Cohesion: 0.07
Nodes (29): buildQueryConditions(), CATEGORY_SYNONYMS, getFeaturedClinics(), getSpecialtyStartingPrices(), MEDICAL_SYNONYMS, searchClinicProcedures(), SearchFilters, stripAccents() (+21 more)

### Community 13 - "procedimentos/[id]/page.tsx"
Cohesion: 0.13
Nodes (17): getClinicProcedureDetail(), cityOptions, ClinicasPageProps, clinicPhotos, dynamic, neighborhoodOptions, DetailPageProps, ProcedureDetailPage() (+9 more)

### Community 14 - "dependencies"
Cohesion: 0.05
Nodes (38): @base-ui/react, class-variance-authority, cmdk, @hookform/resolvers, lucide-react, next-auth, next-themes, dependencies (+30 more)

### Community 15 - "scripts/core.py"
Cohesion: 0.09
Nodes (36): _contains_phrase(), _domain_keywords(), _exact_match_diagnostic(), _exact_stack_identifier(), _file_signature(), _get_bm25(), _legacy_successor_guidance(), _load_csv() (+28 more)

### Community 16 - "leads/page.tsx"
Cohesion: 0.13
Nodes (18): listPartnerLeads(), AdminClinicsPage(), dynamic, revalidate, AdminLeadsPage(), dynamic, revalidate, ChatRequestBody (+10 more)

### Community 17 - "spacing"
Cohesion: 0.06
Nodes (34): $type, $value, $type, $value, $type, $value, $type, $value (+26 more)

### Community 18 - "inbox-layout.tsx"
Cohesion: 0.10
Nodes (28): seedDemoConversations(), AvatarBadge(), initialsFor(), CRMKanban(), CRMKanbanProps, KanbanStage, parseEstimatedValue(), STAGE_ORDER (+20 more)

### Community 19 - "ChatCrmApp"
Cohesion: 0.07
Nodes (14): dynamic, revalidate, dynamic, revalidate, dynamic, revalidate, dynamic, revalidate (+6 more)

### Community 20 - "TestTailwindConfigGenerator"
Cohesion: 0.06
Nodes (16): Test adding colors multiple times., Test adding full color palette., Test adding custom spacing., Test adding custom breakpoints., Test TailwindConfigGenerator class., Test generating TypeScript configuration., Test validating config with empty theme extensions., Test writing configuration to file. (+8 more)

### Community 21 - "search_stack"
Cohesion: 0.11
Nodes (6): Search stack-specific guidelines, search_stack(), _rows(), TestNativeDesktopStackFreshness, _rows(), TestWebStackFreshness

### Community 22 - "read_rows"
Cohesion: 0.11
Nodes (7): read_rows(), split_values(), style_identities(), TestGeneratedCatalogContract, TestLandingAndStackContract, TestReasoningContract, TestStyleIdentityContract

### Community 23 - "chat-crm-app.tsx"
Cohesion: 0.16
Nodes (27): ACTIVE_STATUSES, assignConversationToUserAdmin(), claimConversationAdmin(), getAttendantCapacityAdmin(), getChatContactHistoryAdmin(), getChatMessagesAdmin(), getConversationAdmin(), INBOX_FILTER_TO_CONVERSATION_FILTER (+19 more)

### Community 24 - "booking-dialog.tsx"
Cohesion: 0.14
Nodes (16): BookingDialog(), timeSlots, ClinicProcedureResult, Dialog(), DialogContent(), DialogFooter(), DialogHeader(), DialogOverlay() (+8 more)

### Community 25 - "VoucherCard component"
Cohesion: 0.08
Nodes (29): /acompanhar/[id] route, /admin/leads panel, buildWhatsAppLink(), Captação B2B (Seja um Parceiro), /comprovante/[id] route, createAppointment action, getBaseUrl(), Guia Digital / Voucher de Encaminhamento (+21 more)

### Community 26 - "html-token-validator.py"
Cohesion: 0.13
Nodes (24): get_context(), is_allowed_exception(), is_allowed_rgba(), is_inside_block(), load_css_variables(), main(), print_result(), print_summary() (+16 more)

### Community 27 - "actions/admin.ts"
Cohesion: 0.20
Nodes (12): createTeamMember(), getAttendantPerformanceReport(), getFinancialReport(), getKpis(), listClinics(), updateUserMaxConcurrentChats(), AdminDashboardPage(), dynamic (+4 more)

### Community 28 - "affiliates.ts"
Cohesion: 0.12
Nodes (22): generateAffiliateCode(), generateUniqueAffiliateCode(), registerAffiliate(), registerAffiliatePaymentAction(), updateAffiliateStatusAction(), AffiliateActionsCell(), AffiliateActionsCellProps, AffiliatePaymentModal() (+14 more)

### Community 29 - "search"
Cohesion: 0.12
Nodes (7): Resolve a deprecated in-domain alias, or expose a cross-domain redirect., Main search function with auto-domain detection, search(), _style_search_destination(), TestSearchDomains, read_rows(), TestStyleTaxonomy

### Community 30 - "compilerOptions"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 31 - "DesignSystemGenerator"
Cohesion: 0.22
Nodes (5): DesignSystemGenerator, Generates design system recommendations from aggregated searches., Load reasoning rules from CSV., Select best matching result based on priority keywords., TestReasoningMatch

### Community 33 - "BM25"
Cohesion: 0.11
Nodes (19): BM25, detect_domain(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection, Search across all domains and combine results (+11 more)

### Community 34 - "color"
Cohesion: 0.08
Nodes (25): $type, $value, background, destructive, foreground, muted, muted-foreground, primary-hover (+17 more)

### Community 35 - "BM25"
Cohesion: 0.11
Nodes (9): BM25, BM25 ranking algorithm for text search, Lowercase, normalize synonyms, split, remove punctuation, filter stopwords, Build BM25 index from documents, Score all documents against query, All indexed terms, for suggestion/typo-recovery purposes., TestBm25CoreBehavior, TestDiagnosticsContracts (+1 more)

### Community 36 - "devDependencies"
Cohesion: 0.08
Nodes (25): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, postcss (+17 more)

### Community 37 - "design_system.py"
Cohesion: 0.12
Nodes (23): ansi_ljust(), _detect_page_type(), format_ascii_box(), format_master_md(), format_page_override_md(), _generate_intelligent_overrides(), hex_to_ansi(), persist_design_system() (+15 more)

### Community 38 - "TailwindConfigGenerator"
Cohesion: 0.10
Nodes (12): main(), Add custom font families. Args: fonts: Dict of font_type: [font_names] e.g.,…, Add custom spacing values. Args: spacing: Dict of name: value e.g., {'18':…, Add custom breakpoints. Args: breakpoints: Dict of name: width e.g., {'3xl':…, Add plugin requirements. Args: plugins: List of plugin names e.g.,…, Get plugin recommendations based on configuration. Returns: List of recommended…, Generate Tailwind CSS configuration files., Validate configuration. Returns: Tuple of (valid, message) (+4 more)

### Community 39 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 40 - "Plataforma de Agendamento de Consultas e Exames"
Cohesion: 0.11
Nodes (22): app service, docker-compose.yml (dev, Postgres only), Dockerfile, docs/obsidian/04 - Manual de Edição Manual e Manutenção.md, migrate service, nginx service, deploy/nginx.conf, postgres service (+14 more)

### Community 41 - "logo.tsx"
Cohesion: 0.17
Nodes (10): brandTextClasses, iconSizeClasses, Logo(), LogoIcon(), LogoSize, LogoVariant, subtitleTextClasses, AIAssistantWidget() (+2 more)

### Community 42 - "button.tsx"
Cohesion: 0.09
Nodes (42): createClinic(), updateClinic(), loginAffiliateAction(), logoutAffiliateAction(), addClinicProcedure(), updateClinicBusinessHours(), updateClinicProcedure(), approveAndRegisterClinic() (+34 more)

### Community 43 - "generate-slide.py"
Cohesion: 0.15
Nodes (19): _e(), generate_chart_slide(), generate_cta_slide(), generate_deck(), generate_metrics_slide(), generate_problem_slide(), generate_solution_slide(), generate_testimonial_slide() (+11 more)

### Community 44 - "fetch-background.py"
Cohesion: 0.17
Nodes (17): generate_css_for_background(), get_background_image(), get_curated_images(), get_overlay_css(), get_pexels_search_url(), load_backgrounds_config(), load_brand_colors(), main() (+9 more)

### Community 45 - "radius"
Cohesion: 0.15
Nodes (19): $type, $value, lg, $type, $value, $type, $value, $type (+11 more)

### Community 46 - "partner-lead-status-form.tsx"
Cohesion: 0.11
Nodes (22): updatePartnerLeadStatus(), PartnerLeadStatusForm(), handleSave(), statusOptions, StatusFilter(), statusOptions, categoryTabs, cityOptions (+14 more)

### Community 47 - "TestThresholdGate"
Cohesion: 0.13
Nodes (3): TestFixtureValidation, TestMetricMath, TestThresholdGate

### Community 48 - "actions/clinic.ts"
Cohesion: 0.21
Nodes (15): businessHoursDays, getClinicInfo(), listClinicProcedures(), listProceduresNotOffered(), ClinicSettingsPage(), dynamic, revalidate, ClinicLayout() (+7 more)

### Community 49 - "icon/generate.py"
Cohesion: 0.20
Nodes (15): apply_color(), apply_viewbox_size(), extract_svgs(), generate_batch(), generate_icon(), generate_sizes(), load_env(), main() (+7 more)

### Community 50 - "fontSize"
Cohesion: 0.12
Nodes (16): $type, $value, $type, $value, $type, $value, $type, $value (+8 more)

### Community 52 - "TestShadcnInstaller"
Cohesion: 0.14
Nodes (8): Test adding components in dry run mode., Test ShadcnInstaller class., Test adding all components without config., Test listing installed components without config., Test listing installed components when they exist., Test checking for existing shadcn config., Test getting installed components when files exist., TestShadcnInstaller

### Community 53 - "detect_domain"
Cohesion: 0.23
Nodes (3): detect_domain(), Auto-detect the most relevant domain from query. Matches are weighted by…, TestDomainDetection

### Community 54 - "_palette_is_dark"
Cohesion: 0.18
Nodes (7): _palette_is_dark(), WCAG relative luminance of a #RRGGBB string, or None if unparseable., True when a colors.csv row's Background is a dark surface., _relative_luminance(), The exact reproduction from issue #428., TestEndToEndCoherence, TestLuminance

### Community 55 - "extract-colors.cjs"
Cohesion: 0.22
Nodes (11): calculateCompliance(), colorDistance(), displayPalette(), extractHexColors(), findNearestBrandColor(), fs, generateImageMagickCommand(), hexToRgb() (+3 more)

### Community 56 - "validate-asset.cjs"
Cohesion: 0.25
Nodes (13): checkManifest(), formatBytes(), formatOutput(), fs, main(), parseFilename(), path, RULES (+5 more)

### Community 57 - "migration 20260816022709_add_inbox_module"
Cohesion: 0.18
Nodes (14): CannedResponse model, CannedResponseMenu component, Contact model, Conversation model, findOrCreateConversation, Message model, migration 20260816022709_add_inbox_module, Single global WhatsApp number limitation (+6 more)

### Community 58 - "scripts"
Cohesion: 0.14
Nodes (13): name, prisma, seed, private, scripts, build, dev, lint (+5 more)

### Community 59 - "chat-crm-adapters.ts"
Cohesion: 0.15
Nodes (14): getChatMessages(), listChatContacts(), channelFromDb, ConversationWithRelations, departmentFromDb, departmentToDb, formatMessageTimestamp(), funnelStageBadgeVariant (+6 more)

### Community 60 - "design-tokens-starter.json"
Cohesion: 0.17
Nodes (11): $type, $value, dark, semantic, $schema, $type, $value, semantic (+3 more)

### Community 61 - "_select_palette_for_mode"
Cohesion: 0.22
Nodes (7): _contrast_ratio(), _derive_dark_palette(), WCAG contrast ratio for two hex colors, or None if either is invalid., Keep product brand tokens while deriving accessible dark surfaces., Pick the highest-ranked palette matching the resolved mode. Only the dark case…, _select_palette_for_mode(), TestPaletteSelection

### Community 62 - "test_design_system_mode.py"
Cohesion: 0.23
Nodes (7): _query_wants_dark(), True when a styles.csv row describes itself as dark-first., True when the query explicitly asks for a dark theme., Resolve the mode the rest of the output has to agree with., _resolve_color_mode(), _style_is_dark_primary(), TestModeResolution

### Community 63 - "validate-tokens.cjs"
Cohesion: 0.24
Nodes (11): extensions, formatReport(), fs, getFiles(), main(), parseArgs(), path, patterns (+3 more)

### Community 64 - "ShadcnInstaller"
Cohesion: 0.20
Nodes (7): main(), Handle shadcn/ui component installation., ShadcnInstaller, Tests for shadcn_add.py, Test adding components that are already installed., Test initialization with default project root., Test initialization with dry run mode.

### Community 65 - ".check_shadcn_config"
Cohesion: 0.21
Nodes (6): Add all available shadcn/ui components. Args: overwrite: If True, overwrite…, List installed components. Returns: Tuple of (success, message with component…, Check if shadcn is initialized in project. Returns: True if components.json…, Get list of already installed components. Returns: List of installed component…, Read shadcn version from project package.json; fall back to a pinned default., Add shadcn/ui components. Args: components: List of component names to add…

### Community 66 - ".generate_config_string"
Cohesion: 0.20
Nodes (6): Generate configuration file content. Returns: Configuration file as string, Generate TypeScript configuration., Generate JavaScript configuration., Format plugins array for config. Validates each plugin name against a strict…, Add indentation to JSON string., Write configuration to file. Returns: Tuple of (success, message)

### Community 67 - "patch"
Cohesion: 0.17
Nodes (6): Test adding components with overwrite flag., Test successful component addition., Test component addition with subprocess error., Test component addition when npx is not found., Test successful addition of all components., patch

### Community 68 - "conversation-list.tsx"
Cohesion: 0.16
Nodes (15): SUGGESTED_TAGS, ConversationList(), filterLabels, formatTime(), initials(), CreateAppointmentShortcut(), ConversationDetail, ConversationListItem (+7 more)

### Community 69 - "inject-brand-context.cjs"
Cohesion: 0.31
Nodes (10): extractColorsFromTable(), extractCoreAttributes(), extractHexColors(), extractImageStyle(), extractTypography(), extractVoice(), fs, generatePromptAddition() (+2 more)

### Community 70 - "embed-tokens.cjs"
Cohesion: 0.18
Nodes (8): args, fs, minimal, MINIMAL_TOKENS, path, projectRoot, tokensPath, wrapStyle

### Community 71 - "test_tailwind_config_gen.py"
Cohesion: 0.22
Nodes (8): Tests for tailwind_config_gen.py, Reduce a generated TS/JS config to a bare assignable object so it can be handed…, Regression guard for the missing-comma bug between the ``theme`` block and…, The property preceding ``plugins`` must end with a comma (pure-Python check, so…, The emitted config parses as valid JS via ``node --check``., _strip_to_object(), TestGeneratedConfigIsValidJs, parametrize

### Community 72 - "generate_design_system"
Cohesion: 0.20
Nodes (7): format_markdown(), generate_design_system(), Format design system as markdown., Main entry point for design system generation. Args: query: Search query (e.g.,…, format_output(), Format results for Claude consumption (token-optimized), TestPersistence

### Community 73 - "chatbot.ts"
Cohesion: 0.27
Nodes (9): extractCpf(), extractProcedureKeyword(), processInboundChatbotTriage(), BusinessDayConfig, BusinessHoursMap, checkClinicBusinessHours(), DAY_KEYS, DEFAULT_BUSINESS_HOURS (+1 more)

### Community 74 - "logo/generate.py"
Cohesion: 0.29
Nodes (9): enhance_prompt(), generate_batch(), generate_logo(), load_env(), main(), Enhance the logo prompt with style and industry modifiers, Generate a logo using Gemini models with image generation Args: aspect_ratio:…, Generate multiple logo variants with different styles (+1 more)

### Community 75 - "generate-tokens.cjs"
Cohesion: 0.36
Nodes (9): flattenTokens(), fs, generateCSS(), generateTailwind(), main(), parseArgs(), path, resolveReference() (+1 more)

### Community 76 - "duration"
Cohesion: 0.20
Nodes (10): fast, normal, slow, $type, $value, $type, $value, duration (+2 more)

### Community 77 - "._base_config"
Cohesion: 0.22
Nodes (6): Path, Initialize generator. Args: typescript: If True, generate .ts config, else .js…, Determine default output path., Create base configuration structure., Get default content paths for framework., Any

### Community 78 - "parse_decision_rules"
Cohesion: 0.19
Nodes (8): Find matching reasoning rule for a category., Apply reasoning rules to search results., apply_decision_rules(), _object_without_duplicates(), parse_decision_rules(), Return deterministic mutations and an audit trail; never execute data., Parse the canonical condition -> action-array representation., _validate_action()

### Community 79 - "test_text_layout_resilience.py"
Cohesion: 0.22
Nodes (3): read_rows(), TestTextLayoutDataContracts, TestTextLayoutRetrieval

### Community 80 - "seed.ts"
Cohesion: 0.20
Nodes (8): clinicProceduresData, clinicsData, consultationProceduresData, defaultBusinessHours, otherProceduresData, prisma, specialtiesData, urolaserProceduresData

### Community 81 - "clinic/page.tsx"
Cohesion: 0.33
Nodes (8): getClinicOverview(), listClinicAppointments(), ClinicDashboardPage(), dynamic, revalidate, statusBadge, addUTCDays(), startOfUTCDay()

### Community 82 - "app/layout.tsx"
Cohesion: 0.24
Nodes (7): geistMono, geistSans, metadata, RootLayout(), SessionProvider(), Toaster(), TooltipProvider()

### Community 83 - "scroll-showcase.tsx"
Cohesion: 0.20
Nodes (5): PhoneShowcase(), ScreenLayer(), ScrollShowcase(), StepDefinition, steps

### Community 84 - "sync-brand-to-tokens.cjs"
Cohesion: 0.33
Nodes (8): adjustBrightness(), { execFileSync }, extractColorsFromMarkdown(), fs, generateColorScale(), main(), path, updateDesignTokens()

### Community 85 - "_run"
Cohesion: 0.28
Nodes (8): Path, Regression tests for validate-tokens.cjs. The validator used to skip any line…, A hardcoded hex on the same line as a var() token is still a violation., A line that references only tokens produces no false positives., _run(), test_flags_hardcoded_hex_sharing_line_with_token(), test_token_only_line_reports_no_violation(), CompletedProcess

### Community 86 - "(clinic)/layout.tsx"
Cohesion: 0.15
Nodes (11): dynamic, revalidate, handler, dynamic, revalidate, AdminNav(), navItems, ClinicNav() (+3 more)

### Community 87 - "_row_identities"
Cohesion: 0.25
Nodes (8): _exact_row_identity(), Suggest complete public identities so a retry can bypass score thresholds., Return non-empty public identities from ordinary and alias fields., Resolve an explicit style identity without opening generic variant ranking., Return one row whose stable public identity exactly matches the query., _row_identities(), _style_identity(), _suggest_identities()

### Community 88 - "whatsapp.ts"
Cohesion: 0.15
Nodes (11): AppointmentWithRelations, buildProviderRequest(), notifyAppointmentStatus(), ProviderRequest, SendAttemptResult, sleep(), AppointmentNotificationData, toNotificationData() (+3 more)

### Community 89 - "reminders.ts"
Cohesion: 0.43
Nodes (6): confirmAppointmentStatus(), formatDatePtBR(), sendAppointmentReminder(), sendBatchReminders(), BatchReminderButton(), handleBatchReminders()

### Community 90 - "entrar/page.tsx"
Cohesion: 0.36
Nodes (3): LoginForm(), LoginInput, loginSchema

### Community 91 - ".generate"
Cohesion: 0.16
Nodes (8): _filter_anti_patterns_for_mode(), Drop "avoid dark mode" advice once dark mode is the resolved answer., Execute searches across multiple domains., Extract results list from search result dict., Generate complete design system recommendation. variance/motion/density are…, Bucket a 1-10 dial value into its tier config. Returns None if value is None., _resolve_dial(), TestAntiPatternGating

### Community 92 - "Next.js project (create-next-app bootstrap)"
Cohesion: 0.29
Nodes (7): Next.js (App Router, React 18/19, TypeScript), app/page.tsx, create-next-app, Geist font, next/font, Next.js project (create-next-app bootstrap), Vercel Platform

### Community 93 - "appointment-actions.tsx"
Cohesion: 0.33
Nodes (6): updateAppointmentStatus(), actionStyles, AppointmentActions(), handleClick(), handleSendReminder(), transitions

### Community 94 - "logo-icon.svg"
Cohesion: 0.33
Nodes (5): Conecta Saude Brand, favicon.ico, conectaSaudeIconGradient (linear gradient #0284c7 to #0d9488), Conecta Saude Icon Mark (rounded square, pulse line, connection dots), src/app/icon.svg (Favicon Convention File)

### Community 95 - "ClinicProcedure model"
Cohesion: 0.47
Nodes (6): Appointment model, Clinic model, ClinicProcedure model, Procedure model, prisma/seed.ts, Specialty model

### Community 96 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 97 - "sm"
Cohesion: 0.60
Nodes (5): sm, sm, sm, $type, $value

### Community 98 - "conectasaudevc.com.br (domínio oficial de produção)"
Cohesion: 0.40
Nodes (5): conectasaudevc.com.br (domínio oficial de produção), getBaseUrl(), src/app/layout.tsx, src/lib/format.ts, VERCEL_ENV / VERCEL_URL

### Community 99 - "Conecta Saúde Brand Logo (public/logo.svg)"
Cohesion: 0.60
Nodes (5): Conecta Saúde Brand Logo (public/logo.svg), Brand Gradient (#0284c7 blue → #0d9488 teal), Logo Symbol (rounded square + pulse/connection path + 4 dots), "VITÓRIA DA CONQUISTA" Tagline, "Conecta Saúde" Wordmark Text

### Community 100 - "xl"
Cohesion: 0.67
Nodes (4): xl, xl, $type, $value

### Community 101 - "none"
Cohesion: 0.67
Nodes (4): $type, $value, none, none

### Community 102 - "extends"
Cohesion: 0.50
Nodes (3): extends, next/core-web-vitals, next/typescript

### Community 107 - "destructive-foreground"
Cohesion: 0.67
Nodes (3): destructive-foreground, $type, $value

### Community 108 - "primary"
Cohesion: 0.67
Nodes (3): primary, $type, $value

### Community 109 - "primary-foreground"
Cohesion: 0.67
Nodes (3): primary-foreground, $type, $value

### Community 110 - "whatsapp-templates.ts"
Cohesion: 0.56
Nodes (8): buildAppointmentMessage(), cancelledAppointmentMessage(), completedAppointmentMessage(), confirmedAppointmentMessage(), newAppointmentMessage(), noShowAppointmentMessage(), summaryLines(), trackingLine()

### Community 159 - "prisma.ts"
Cohesion: 0.39
Nodes (4): globalForPrisma, prisma, SubmitPartnerLeadInput, submitPartnerLeadSchema

### Community 160 - "whatsapp/route.ts"
Cohesion: 0.48
Nodes (6): extractIncomingMessage(), findOrCreateConversation(), IncomingMessage, logInbound(), POST(), resolveStatusFromReply()

### Community 161 - "site-footer.tsx"
Cohesion: 0.33
Nodes (5): coverageCities, legalLinks, partnerLinks, patientLinks, SiteFooter()

### Community 162 - "secondary-foreground"
Cohesion: 0.67
Nodes (3): secondary-foreground, $type, $value

## Ambiguous Edges - Review These
- `Clinic model` → `PartnerLead model`  [AMBIGUOUS]
  docs/obsidian/02 - Dicionário de Dados e Banco.md · relation: conceptually_related_to
- `Procedure model` → `Specialty model`  [AMBIGUOUS]
  Prompts.txt · relation: conceptually_related_to

## Knowledge Gaps
- **455 isolated node(s):** `AgendamentosPageProps`, `ProcedureSimulation`, `StepItem`, `SearchPageProps`, `SearchFilters` (+450 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Clinic model` and `PartnerLead model`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Procedure model` and `Specialty model`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `cn()` connect `cn` to `format.ts`, `conversation-list.tsx`, `logo.tsx`, `button.tsx`, `search.ts`, `procedimentos/[id]/page.tsx`, `partner-lead-status-form.tsx`, `leads/page.tsx`, `app/layout.tsx`, `scroll-showcase.tsx`, `booking-dialog.tsx`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `search()` connect `search` to `validate_data.py`, `BM25`, `design_system.py`, `generate_design_system`, `scripts/core.py`, `test_text_layout_resilience.py`, `detect_domain`, `_row_identities`, `.generate`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `DesignSystemGenerator` connect `DesignSystemGenerator` to `BM25`, `patch`, `design_system.py`, `generate_design_system`, `parse_decision_rules`, `read_rows`, `_palette_is_dark`, `.generate`, `_select_palette_for_mode`, `test_design_system_mode.py`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `TailwindConfigGenerator` (e.g. with `TestGeneratedConfigIsValidJs` and `TestTailwindConfigGenerator`) actually correct?**
  _`TailwindConfigGenerator` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AgendamentosPageProps`, `ProcedureSimulation`, `StepItem` to the rest of the system?**
  _455 weakly-connected nodes found - possible documentation gaps or missing edges._