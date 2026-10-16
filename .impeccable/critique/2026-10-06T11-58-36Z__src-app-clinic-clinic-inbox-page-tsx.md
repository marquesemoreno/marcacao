---
target: /clinic/inbox
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\inbox\\page.tsx"
target_fingerprint: "sha256:e3f1091d5f1b1e413fdd874dcdca9676600f8b3518f400a761e810a244a94cf6"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\inbox\\page.tsx"
timestamp: 2026-10-06T11-58-36Z
slug: src-app-clinic-clinic-inbox-page-tsx
---
Method: dual-agent (A: design review, source-only · B: detector + browser; conversation opened fine this time — bubbles took 40–75s on a fresh dev server)

## Design Health Score (history 21 → 27 → 29 → 27; stricter evaluator, new real issues found)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Auto-advance state only visible in "?" dialog |
| 2 | Match System / Real World | 3 | "e = Finalizar" not a pt-BR mnemonic |
| 3 | User Control and Freedom | 3 | "a" only claims unassigned (server refuses owned) — no Undo though. Parent corrected A (claimed it takes colleagues' patients) |
| 4 | Consistency and Standards | 2 | "n" says "mais urgente" but jumps to first non-open row; j/k undocumented |
| 5 | Error Prevention | 3 | Finish modal, transfer confirm, bulk Undo, shortcuts skip inputs/dialogs |
| 6 | Recognition Rather Than Recall | 3 | Row ⋯ and checkbox hover-only |
| 7 | Flexibility and Efficiency | 3 | No jump-between-groups / next unread |
| 8 | Aesthetic and Minimalist | 3 | Max 3 lines, one color per row; CRM panel/composer still dense |
| 9 | Error Recovery | 2 | Undo only for bulk assign and Devolver pra IA |
| 10 | Help and Documentation | 2 | "?" dialog is the only in-product help |
| Total | | 27/40 | Acceptable (border of Good) |

## Design Specificity Verdict
Moderately specific: row information is front-desk specific (SLA wait, AI intent, Transferida, remarcação); 3-pane shell is Front/Intercom-like.
CLI: 10 gray-on-color, all false positives (same as before).
Browser: list 7 overlays (5 clipped-container, 1 undersized button text, 1 search nested-card); conversation 12 (2 gray-on-color on bubble text, likely same false positive); mobile 113 all 0×0 (unverifiable), no horizontal scroll. Page-level: IMAGE HOVER TRANSFORM ×26 (avatars hover:scale), LAYOUT PROPERTY ANIMATION ×1 (transition: height), FLAT TYPE HIERARCHY (16 vs 14px).

## Priority Issues
- [P1] Queue rows not reachable with Tab — rows are div onClick without role/tabIndex; row ⋯ trigger invisible on focus. Fix: listbox/option or button rows with roving tabindex, aria-selected; focus-visible:opacity-100 on ⋯. /impeccable harden
- [P2] "n" doesn't do what the dialog says — compute truly most urgent (critical, longest wait, excluding current); document j/k. /impeccable clarify
- [P2] Critical state saturates — filled rose only in "Aguardando resposta"; muted treatment in "+48 h" group. /impeccable quieter
- [P3] Auto-advance invisible — toast "Abrindo a próxima: {nome}". /impeccable clarify
- [P3] "a" has no Undo (low risk: only unassigned) — 8s Undo toast. /impeccable harden

## Persona Red Flags
Alex: no keys for groups/transfer/Devolver; j/k undocumented; ⋯ menus need mouse.
Sam: rows not tabbable; ⋯ invisible on focus; Instagram badge title-only; owner/IA icons not aria-hidden.
Ana: ~9–10 rows visible; no "where I was" beyond selection ring; stray a/e outside inputs acts (e still asks confirmation).

## Minor Observations
Pin/mute svg aria-label without role=img; row ⋯ Popover lacks arrow-key menu; audio hidden in "+" (watch adoption); DESIGN.md light-only vs dark default; 156 console 403/404 unconfirmed source; avatar hover zoom unnecessary.

## Questions
1. Is 15/60 SLA still the right measure when most of the queue is late?
2. Should state-changing keys (a, e) require a modifier?
3. One-click row actions from Jev intent (Confirmar/Remarcar)?
