---
target: clinic/inbox (src/components/chat/inbox-layout.tsx)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 5
timestamp: 2026-08-26T02-02-41Z
slug: src-components-chat-inbox-layout-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Marcar como Não Lida" fires a success toast with zero wiring behind it — actively lies about system state. |
| 2 | Match System / Real World | 4 | CPF mask, PIX/parcelamento quick-reply, real Bahia neighborhoods, funnel vocabulary matching an actual reception pipeline. |
| 3 | User Control and Freedom | 2 | No undo-send, no retry on failed messages, draft silently discarded on contact switch with zero warning. |
| 4 | Consistency and Standards | 3 | Solid semantic color system, but a `DollarSign` icon labels the CPF field (schedule-modal.tsx:239). |
| 5 | Error Prevention | 3 | Mandatory resolution-reason gate before finishing an attendance; client-side file validation with clear toasts. |
| 6 | Recognition Rather Than Recall | 3 | Quick replies via `/`, always-visible funnel stepper; free-text tags have no autocomplete, inviting typo-forked duplicates. |
| 7 | Flexibility and Efficiency | 2 | No keyboard nav between queue items, no bulk actions, no SLA/oldest-first sort, no shortcut to advance funnel stage. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean card system, but queue rows carry 8 data points each and the header can host 3 buttons + 2 badges at once. |
| 9 | Error Recovery | 2 | Failed sends show only a small red icon, no explanatory text, no retry action anywhere in the codebase. |
| 10 | Help and Documentation | 1 | No in-app help, no shortcut list, no onboarding — only per-icon `title` tooltips. |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: High specificity — genuinely authored for this workflow, not a reskinned support-chat template. Evidence: live Brazilian CPF mask, PIX/parcelamento quick-reply, real Bahia neighborhoods hardcoded into a canned reply, a funnel vocabulary mapping to an actual reception pipeline (Novo → Em Atendimento → Orçamento Enviado → Agendado), an attendant-capacity limiter modeling real staffing constraints, a hospital-bridge doctor list for Santa Clara distinct from local clinics, and an avatar component that explicitly avoids an external gravatar-style service for LGPD reasons (with the reasoning spelled out in a code comment). This reads as built by people who understand the domain.

**Deterministic scan**: 4 findings across 3 rules in 2 of the 5 files (`chat-crm-app.tsx`, `page.tsx`, `message-bubble.tsx` came back clean). Two are false positives from variant-bucket concatenation (a selected-row accent border misread as static decoration; a hover-only background paired with a base/dark text color that never co-renders with it). One (`animate-bounce` on the scheduling-success icon) is a real, if minor, hit — a dated easing choice on an otherwise well-placed celebratory moment.

## Overall Impression

This is a competent, domain-aware Operate tool sitting at 26/40 — well above a generic template, held back mostly by silent failures (a menu item that lies about doing something, a casing bug that can make a real conversation invisible, drafts vanishing without a word) rather than by weak visual design. The biggest opportunity isn't a redesign; it's closing the gap between what the UI *claims* happens and what actually happens, and giving screen-reader/keyboard users a way to actually complete the primary loop this screen exists for.

## What's Working

1. **Domain-aware guardrails, not decoration** — the attendant-capacity limiter (disabled claim button + explicit tooltip at max concurrent conversations) reflects real staffing limits a generic template would never model.
2. **LGPD-conscious avatar design** — initials-only avatars generated locally instead of an external gravatar-style call, with the privacy reasoning written directly into the code comment.
3. **Composer-mode color coding** (emerald WhatsApp vs. amber Internal Note) is a real safety net against a private note leaking to a patient — high-stakes, high-frequency action, well mitigated.

## Priority Issues

**[P1] Modals are not screen-reader or keyboard accessible**
- **Why it matters**: None of the five modals (Novo Contato, Nova Resposta Rápida, Finalizar Atendimento, ScheduleModal, image lightbox) declare `role="dialog"`/`aria-modal`, trap focus, or close on Escape — a keyboard/screen-reader user can tab straight back into the queue behind an open modal. On top of that, 7 close/remove buttons across these files (CRM panel close, tag-remove, and 4 of the 5 modal close buttons, plus the lightbox close) are bare icon buttons with no `aria-label`, no `title`, no visible text — a screen-reader user gets an unlabeled button, full stop.
- **Fix**: Add `role="dialog"` + `aria-modal="true"` + focus trap + Escape-to-close to all five modals; add `aria-label` to every icon-only close/remove button (the codebase already uses `title` consistently elsewhere, e.g. lines 392/458/648/671/713/747/758/985/993/1090 in inbox-layout.tsx — extend that pattern to the 7 missing spots).
- **Suggested command**: `/impeccable audit`

**[P1] "Marcar como Não Lida" fires a success toast with no actual effect**
- **Why it matters**: `inbox-layout.tsx:775-784` calls `toast.success("Conversa marcada como não lida!")` and closes the menu, but there is no prop, handler, or state change wired to it anywhere in `chat-crm-app.tsx`. The tool tells the attendant an action succeeded when nothing happened — a direct violation of "visibility of system status," and the kind of thing that erodes trust in every other status the UI reports once someone notices.
- **Fix**: Either wire it to a real `markConversationUnread` action, or remove the menu item until it exists.
- **Suggested command**: `/impeccable harden`

**[P1] "Não Atribuído" casing mismatch can hide a genuinely unassigned conversation**
- **Why it matters**: `inbox-layout.tsx:582` and `:710` check `responsibleAgent !== "Não Atribuído"` (capital A) only. The sibling Kanban view (`crm-kanban.tsx:91`, `:243`) defensively checks *both* `'Não Atribuído'` and `'Não atribuído'` — strong evidence the lowercase variant really occurs. If it does, `inbox-layout.tsx` silently skips the "Atribuir pra Mim" / unassigned badge logic for that contact, and an attendant can lose track of a real patient conversation with no error, no visual sign anything is wrong — this is exactly the kind of bug that turns into a support ticket nobody can reproduce.
- **Fix**: Normalize the comparison the same way `crm-kanban.tsx` already does, or fix the value at the source in `chat-crm-adapters.ts` so only one casing ever exists.
- **Suggested command**: `/impeccable harden`

**[P1] No retry or explanation when a WhatsApp send fails**
- **Why it matters**: A failed message renders only a small red `AlertCircle` (`message-bubble.tsx:15`) with no text and no way to resend — there is no retry/reenviar logic anywhere in the chat directory. In a tool whose entire job is getting a message to a patient, a failed send is a real operational failure with no recovery path short of retyping it.
- **Fix**: Show the failure reason inline and add a one-tap "Reenviar" action on the failed bubble.
- **Suggested command**: `/impeccable clarify`

**[P1] Draft text is silently discarded when switching conversations**
- **Why it matters**: `inbox-layout.tsx:240-246` clears `inputText` on contact switch with zero confirmation or warning — a deliberate fix for a worse bug (stale drafts leaking into the wrong conversation), but it trades one silent failure for another. An attendant interrupted mid-reply who taps another conversation loses unsent work without a trace.
- **Fix**: At minimum, a brief "rascunho descartado" toast on switch; ideally persist per-conversation drafts in memory instead of discarding them.
- **Suggested command**: `/impeccable harden`

## Persona Red Flags

**Alex (Power User)**: Reply path is fast (`/` quick replies, Enter to send), but advancing the funnel stage means shifting focus entirely across the screen to the right-hand CRM column and clicking a vertical stepper — no shortcut, no inline affordance near the composer. No keyboard way to move to the next queue item, no bulk actions, no SLA/oldest-first sort beyond three static tabs. Every step after "select conversation" costs Alex a fresh mouse trip.

**Sam (Accessibility-Dependent User)**: Icon-only actions rely solely on `title` as fallback accessible name where present at all (7 controls have neither, see P1 above). The funnel stepper Sam needs for the exact task under review — four plain `<button>`s distinguished only by color and a checkmark, no `aria-current="step"` — linearizes for a screen reader as four undifferentiated buttons with no indication which one is current. Popover menus (tag filter, "...", clinic reassignment) lack `aria-haspopup`/`aria-expanded`/`role="menu"` and don't close on Escape or outside click, so a screen-reader user who opens one by mistake has no standard way out.

## Minor Observations

- **Dropdown/popover menus never close on outside click or Escape** (`isTagFilterOpen`, `isClinicMenuOpen`, `isMoreMenuOpen`, `isQuickReplyOpen`) — only close via one of their own options, breaking a standard expectation.
- **Finish-attendance reason grid shows 6 ungrouped options at once** (`inbox-layout.tsx:1438-1445`), over the 4-item working-memory guideline, in a modal used many times a day.
- **"Gerar Conversas Demo" is exposed in the live empty-queue state** (`inbox-layout.tsx:505-515`) — a real receptionist on a quiet day could inject fake conversations into their real queue by mistake.
- **Recurring low-contrast `text-slate-400`/`text-slate-500`-on-light pattern**, not a one-off: inbox-layout.tsx lines 556, 741, 1099, 1108, 1127, 1132, 1141, 1268; schedule-modal.tsx lines 129, 200; message-bubble.tsx line 319 — mostly 10-11px secondary text likely under the 4.5:1 AA threshold.
- **Touch targets under ~36px on primary (non-decorative) controls**: new-contact button (24px), attach-file (28px), tag-remove (~12px, no padding at all — the smallest in the file), several modal close buttons (~20-22px, no padding). Notably, `schedule-modal.tsx` gives its Cancelar/Confirmar buttons an explicit `min-h-[44px]`, but the accessibility-conscious sizing isn't applied anywhere else in the same file or its siblings.
- **Funnel-stepper icon and label classes duplicate the same 3-way isActive/isCompleted/default ternary** 8 lines apart (`inbox-layout.tsx:1163-1170` and `:1174-1181`) — a future edit to one is likely to miss the other, producing visual drift between the step dot and its label.
- **Peak-end asymmetry**: scheduling (occasional) gets a celebratory bounce-animated success screen with a 1.2s hold; finishing an attendance (many times a day, per-attendant) gets only a toast.
- **Icon/label mismatch**: `DollarSign` icon labels the CPF field (`schedule-modal.tsx:239`) — should read as an ID/document icon, not currency.
- **Naming drift**: composer labels the private-note action "Nota Interna" / "Salvar Nota", while the rendered bubble calls it "🔒 Nota Privada (Equipe)" — likely fine as compose-time vs. rendered-badge language, but worth a consistency pass.

## Questions to Consider

- If "Marcar como Não Lida" has no wiring behind it, was it cut mid-implementation — and how many other menu items in this codebase are decorative?
- The scheduling flow gets a full celebratory animation for a once-in-a-while action; finishing an attendance — performed far more often — gets a toast. Was that prioritization deliberate?
- Given the attendant-capacity system already models real staffing limits, why does the queue have no urgency/SLA signal (oldest unanswered, time-since-claim) instead of three static filter tabs?
