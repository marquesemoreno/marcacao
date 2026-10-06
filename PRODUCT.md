# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the clinic's front desk (recepção).** Attendants who spend the whole working day in the clinic panel (`/clinic/*`): answering patients on WhatsApp (and Instagram Direct), scheduling, confirming D-1 appointments, rescheduling, and moving patients through the CRM. They juggle many simultaneous conversations under a per-attendant capacity limit, with response-time SLAs (15 min warning / 60 min critical, in business minutes).

Secondary, confirmed by existing features rather than this interview: the clinic manager reading reports (team performance, confirmations, revenue estimates, campaigns), and TIVDC staff operating every clinic from the admin panel (`/admin/*`). Patients use the public marketplace site and talk to the clinic through WhatsApp; they never see the panel.

## Product Purpose

Conecta Saúde runs a clinic's patient communication and front-desk operation in one place: a shared WhatsApp inbox, CRM funnel, scheduling, D-1 reminders and confirmations, mass campaigns, and reports — so no patient message is lost or left unanswered and empty appointment slots are reduced. Success means fast first responses, confirmations recorded, fewer no-shows, and campaigns that bring patients back.

## Positioning

Two things a generic WhatsApp CRM or scheduling tool cannot truthfully claim:

1. **Direct integration with the clinic's own management system.** A bridge running on the clinic's PC (Firebird database) feeds the panel with the real schedule, D-1 reminders and campaign audiences — no CSV exports, no double entry.
2. **AI that serves and decides, with a human in the loop.** An attendant bot, the "Copiloto da Recepção" (proposes actions, the attendant confirms), and typed classifiers (Jev, OpenAI fallback) that act only above a confidence threshold and otherwise hand the case to the front desk.

## Operating Context

- Clinics live today: Urolaser (urology) and Clínica Cirúrgica Santa Clara, both in Vitória da Conquista, BA. Both are WhatsApp-only clinics (dedicated Evolution API instance); marketplace clinics also have in-panel appointments.
- The front desk often answers from the phone's WhatsApp too; those messages sync into the panel.
- Campaigns follow safe pacing (Mon–Fri 09–17h, one message every 4–6 min, max 100/day) to protect the clinic's number.
- Product is built and operated by TIVDC for each clinic; clinic panel UI and all copy are in Brazilian Portuguese.

## Capabilities and Constraints

- Clinic panel: Chat (inbox), CRM kanban, Agenda (marketplace clinics only), Pacientes (list + patient page), Disparos (campaigns), Relatórios, Configurações (prices, hours, parameters; Minha conta).
- Inside a clinic every user has the same permissions (no per-user roles); all can edit prices — confirmed decision.
- Users: ADMIN (TIVDC), CLINIC, PATIENT. Admins cannot open the clinic panel.
- Stack in place: Next.js (App Router) on Vercel Pro, Prisma + Supabase Postgres, Tailwind + shadcn on Base UI, Evolution API for WhatsApp.
- Undecided: tela de Médicos; clinical-data fields (would need a medical-role profile); clinic-set default ticket for WhatsApp-only clinics.

## Brand Commitments

- Name: **Conecta Saúde** (public marketplace tagline: "Consultas e Exames Perto de Você").
- All interface text in Brazilian Portuguese.
- The clinic panel opens in **dark theme by default** and must work fully in light theme.
- Urolaser's virtual attendant persona "Lara" (image/mascot) is a client-owned asset used in its reminders.
- The existing visual system is recorded in `DESIGN.md`.

## Evidence on Hand

- Real operating data in production (conversation volumes, confirmation rates, campaign results) visible in Relatórios — use it, never invent figures.
- No testimonials, case studies, pricing tables or press exist for marketing use; do not fabricate them.

## Product Principles

1. **No patient left unanswered.** Every screen should make what is waiting, and for how long, obvious to the front desk.
2. **The clinic's system is the source of truth.** Integrate with it instead of asking staff to re-type or export data.
3. **AI proposes, people decide when it matters.** Automate only with high confidence; uncertain cases go to a person, with the reason visible.
4. **Never mislead about state.** Loading, empty, failed and "sent" must be distinguishable — a wrong "nothing here" costs a patient.
5. **Protect the clinic's channel.** Pacing and opt-outs come before reach.

## Accessibility & Inclusion

- Patient data is health data under **LGPD**: show only what the task needs, mind exports and screenshots, record consent where the product does.
