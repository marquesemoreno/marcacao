---
target: src/components/chat/inbox-layout.tsx
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-26T20-53-10Z
slug: src-components-chat-inbox-layout-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | "Finalizar Atendimento" gives no success confirmation, unlike every other save action |
| 2 | Match System / Real World | 4 | WhatsApp iconography, PT-BR clinical terms, PIX/CPF — reads as native to the domain |
| 3 | User Control and Freedom | 2 | Transfer Agent is one click, irreversible, no confirm/undo |
| 4 | Consistency and Standards | 3 | Custom tag colors are keyed by exact label string — renaming a tag silently breaks its styling |
| 5 | Error Prevention | 2 | Finish-attendance requires a reason (good); transfer and stage-jump have zero guardrails |
| 6 | Recognition Rather Than Recall | 2 | Transfer control lives in the sidebar CRM panel now, not the header — staff must recall where it moved to |
| 7 | Flexibility and Efficiency | 3 | `/` shortcuts, Enter-to-send, AI draft assist are real wins; no keyboard path for stage/tag/transfer changes |
| 8 | Aesthetic and Minimalist Design | 3 | Clean slate/emerald system, but the sidebar stacks 4 dense cards competing for attention |
| 9 | Error Recovery | 3 | Failed-send bubble has an explicit "Reenviar"; media validation gives specific, actionable copy |
| 10 | Help and Documentation | 1 | No inline explanation of funnel stages or finish-reasons for new staff; guidance is hover-only tooltips |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: Strongly product-specific, not a generic chat shell. The CPF mask, jejum/exam-prep quick replies, PIX payment reply, the 4-stage medical funnel (Novo -> Em Atendimento -> Orcamento -> Agendado), doctor/CRM gating tied to the hospital integration, and per-attendant conversation caps all root this firmly in Conecta Saude's actual operation.

**Deterministic scan**: detect.mjs found 3 raw hits, all previously-known patterns: the border-l-4 selected-row accent (line 540) and two gray-on-emerald hits on the "Melhorar com IA" button (line 1009). Assessment B independently re-verified both are false positives. Net new findings: zero.

**Visual overlays**: injection into the live production page was blocked by the permission classifier (DOM mutation on a live third-party page) — expected given this is real patient data. Fell back to a plain screenshot; no additional visible defects found.

## Overall Impression

The inbox is functionally mature and visibly specific to this product. The biggest gap isn't visual polish but asymmetric friction on high-stakes actions: ending a patient relationship is gated and confirmed; handing that same patient to another human is one unguarded click.

## What's Working

1. WhatsApp-authentic delivery ticks (clock -> check -> double-check-gray -> double-check-blue) — mirrors staff's existing mental model.
2. Internal Note vs. WhatsApp toggle with an explicit "Visivel so para a equipe" label — guards against a private note leaking to a patient.
3. Draft-loss warning on conversation switch — an edge case most inboxes never handle.

## Priority Issues

**[P0] Finish-attendance modal shows 6 reasons at once, with no completion feedback.**
Why it matters: highest-stakes, terminal action on a patient record; violates the <=4-choice guideline and gives no peak-end reassurance.
Fix: keep the two labeled groups, add a lightweight confirmation toast on close.
Suggested command: /impeccable clarify

**[P0] Transferring a conversation is one click, irreversible, with zero confirmation.**
Why it matters: reassigning a live patient to another human should not have less friction than finishing it.
Fix: add a confirm step or a toast-based undo window.
Suggested command: /impeccable harden

**[P1] Race condition in the AI-draft insertion.** Switching conversations mid-generation can land the old patient's AI draft in the new conversation's textbox.
Fix: guard the async callback with a check that selectedContactId hasn't changed before inserting.
Suggested command: /impeccable harden

**[P1] Several critical icon-only controls rely solely on title tooltips**, which never surface on touch, despite mobileView confirming tablet/phone usage.
Fix: add visible labels or aria-label + always-visible affordance for touch.
Suggested command: /impeccable adapt

**[P2] Typography is uniformly 10-13px** across statuses, agent names, and tags — fatigue risk over long shifts.
Suggested command: /impeccable typeset

## Persona Red Flags

**Alex (Power User)**: No keyboard path to change funnel stage, tags, or transfer target. "Melhorar com IA" silently overwrites an in-progress typed draft with no undo.

**Sam (Accessibility-Dependent)**: Finish-modal reason selection conveyed mostly by border/background color shift; icon-only header buttons have no visible label for screen-magnifier users.

**Riley (Stress Tester)**: Attendant capacity cap disables "Atribuir pra Mim" with "Limite Atingido" but offers no next step. The AI-draft race condition is exactly the interrupt-heavy scenario Riley would trigger on purpose.

## Minor Observations

- tagClasses() keys color by exact string match — renaming any tag orphans its styling.
- Attendant-capacity amber/red thresholds can overlap oddly when maxLimit is very small (e.g., 1).

## Questions to Consider

1. Why does finalizing a conversation require a mandatory reason and modal, while transferring a live patient requires neither?
2. The funnel stepper lets staff jump directly from "Novo" to "Agendado" — is skipping stages intentional, or does it corrupt funnel reporting?
3. If a receptionist is interrupted mid-reply, does anything survive besides the discard-toast?
