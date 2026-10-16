---
target: /inbox
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\inbox\\page.tsx"
target_fingerprint: "sha256:e3f1091d5f1b1e413fdd874dcdca9676600f8b3518f400a761e810a244a94cf6"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\inbox\\page.tsx"
timestamp: 2026-10-06T03-24-25Z
slug: src-app-clinic-clinic-inbox-page-tsx
---
Method: dual-agent (A: design review, source-only — no live render due to prod DB · B: detector + browser overlays)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Loading/capacity/counters ok; conversation state (IA/humano/aguardando paciente) only inferable from which buttons appear |
| 2 | Match System / Real World | 3 | Natural pt-BR; "Transferir Atendente / Depto", "Etapa do atendimento" are CRM jargon |
| 3 | User Control and Freedom | 2 | "Devolver pra IA" and "Atribuir pra Mim" one-click, no undo |
| 4 | Consistency and Standards | 2 | Search rounded-xl / counters rounded-full vs DESIGN.md; "Novo Agendamento" vs "Criar Agendamento"; two menu implementations |
| 5 | Error Prevention | 2 | Enter sends to patient; internal-note vs patient mode distinction subtle |
| 6 | Recognition Rather Than Recall | 2 | Transfer lives in right panel; hint only in title tooltip |
| 7 | Flexibility and Efficiency | 1 | No queue keyboard shortcuts, no bulk selection |
| 8 | Aesthetic and Minimalist | 2 | 5–6 control bands before first conversation; ~6 header actions; ~8 composer tools |
| 9 | Error Recovery | 3 | Clear failure toasts |
| 10 | Help and Documentation | 1 | Guidance relies on title tooltips (no touch/SR) |
| Total | | 21/40 | Acceptable |

## Design Specificity Verdict
Partially authored: domain signals (Pendentes/Não Atribuídas with red counter, capacity 46/10, Devolver pra IA, phone-reply notice, finish-with-reason modal) are specific; visual structure is generic 3-column slate+emerald SaaS. SLA wait is a small badge with same weight as channel icons.
Detector CLI: 11 warnings — side-tab inbox-layout.tsx:321 (real: 4px status/selection left border on every row); gray-on-color ×10 (inbox-layout.tsx:2158 hover-only; message-bubble.tsx 522/648/819/867 outgoing bubble near-black on emerald-50) all false positives.
Browser overlays (3 states): nested-cards 358 (rows as cards); low-contrast ~400 (white initials on emerald gradient avatars, white on emerald-600 unread badge); flat type hierarchy (body/h2/h4 all 14px); skipped heading h2→h4; undersized 10px text in 28px buttons; mobile no horizontal scroll.

## Priority Issues
- [P1] SLA/wait doesn't structure the queue — sort by SLA urgency, wait as strongest per-row figure, replace 4px side border with SLA indicator (15/60 min bands). /impeccable bolder
- [P1] Mouse-only triage — ↑/↓, Enter, a (assign me), e (finish), ? (help); multi-select bulk assign. /impeccable harden
- [P1] Contrast + type hierarchy — solid avatar colors ≥4.5:1, darker counters, ≥1.25 heading scale, fix h2→h4 skip, min 12px. /impeccable typeset
- [P2] Transfer hidden + risky one-click actions — clickable attendant chip opening transfer in place; Undo toast ~5s for Devolver pra IA; amber composer frame in internal-note mode. /impeccable clarify
- [P2] Control overload before first patient — header to Atendente/Agendar/⋯; composer extras behind "+"; merge tab filter+settings. /impeccable distill

## Persona Red Flags
Alex: no queue shortcuts; no multi-select; finish = ⋯ → modal → confirm.
Sam: guidance in title tooltips; no aria-live for new messages; heading skip; white initials below AA.
Recepcionista Ana (40+ chats, notebook, interrupted): ~6 rows visible at 1366×768; no "what changed / unread divider" on return; queue doesn't say who's next.

## Minor Observations
rounded-xl search / rounded-full counters vs DESIGN.md; Novo vs Criar Agendamento; composer text-xs → iOS zoom on focus; truncated patient name without full-name affordance.

## Questions
1. Should the default view be "the next patient who needs you most" with one action?
2. If SLA is the product, why isn't wait time the largest number on screen?
3. What does the patient receive on "Devolver pra IA" — should the attendant see it first?
