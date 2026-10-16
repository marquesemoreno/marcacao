---
target: /inbox
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\inbox\\page.tsx"
target_fingerprint: "sha256:e3f1091d5f1b1e413fdd874dcdca9676600f8b3518f400a761e810a244a94cf6"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\inbox\\page.tsx"
timestamp: 2026-10-06T04-41-01Z
slug: src-app-clinic-clinic-inbox-page-tsx
---
Method: dual-agent (A: design review, source-only · B: detector + browser overlays, read-only, one conversation opened)

## Design Health Score (previous run 21/40)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Decorative pulsing dot by "Fila de Atendimento" implies live status regardless of realtime connection |
| 2 | Match System / Real World | 3 | Wait shown ambiguous wall-clock vs business minutes (SLA counts business) |
| 3 | User Control and Freedom | 3 | Undo + transfer confirm; opening a row silently marks read |
| 4 | Consistency and Standards | 2 | rounded-full counters/badges, rounded-xl search/menu vs DESIGN.md |
| 5 | Error Prevention | 3 | Confirm, capacity lock, Undo; bulk-assign bar adjacent to filters |
| 6 | Recognition Rather Than Recall | 2 | Icon-only tag filter/tab settings; shortcuts only via "?" |
| 7 | Flexibility and Efficiency | 3 | Shortcuts + bulk; no "next critical" |
| 8 | Aesthetic and Minimalist | 2 | Up to 11 signals per row; 7–8 controls in header/composer |
| 9 | Error Recovery | 3 | Undo; failed-send recovery not assessed |
| 10 | Help and Documentation | 3 | "?" dialog; capacity rule only in title tooltips |
| Total | | 27/40 | Acceptable (near Good) |

## Design Specificity Verdict
Mostly authored now: SLA wait is the sort key and the strongest row signal; capacity, Transferida pra você, Remarcação pendente, IA/human owner, amber internal note are domain-specific. Generic 3-column shell; row shows who/how long but not intent (Jev already classifies).
CLI: 10 gray-on-color, all false positives (hover-only on Melhorar com IA; outgoing bubbles). side-tab gone.
Browser overlays: list 8 (from ~820), conversation 10, mobile 3. Avatar contrast fixed; nested-cards 358→1–3. Remaining: 5 positioned-child-clipped (likely checkbox/menus), undersized text on sidebar avatar button, flat hierarchy (row h3 = body 14px). No horizontal scroll on mobile.
Correction: "Novo Agendamento" duplicate in ⋯ is mobile-only (sm:hidden) — not a duplicate.

## Priority Issues
- [P1] SLA severity is color-only; rules in tooltips — critical-level filled chip/"!"; queue dividers "Hoje" / "Esquecidas há mais de 48 h"; capacity explanation in clickable popover. /impeccable clarify
- [P1] Header/composer overload — composer "+" for emoji/contact/audio; channel badge only for Instagram; fewer row signals. /impeccable distill
- [P2] Radius/pill drift vs DESIGN.md — normalize to rounded-md/lg or document exception. /impeccable polish
- [P2] Keyboard flow ends at selection — "n" next waiting, auto-advance on finish, Nota Interna shortcut, bulk bar separated from filters. /impeccable harden
- [P3] Decorative pulsing dot — bind to realtime state or remove. /impeccable quieter

## Persona Red Flags
Alex: no jump to most critical; no internal-note shortcut; shortcuts hidden behind "?".
Sam: checkbox invisible until focus; new-contact and só-favoritas buttons title-only; critical SLA color-only.
Recepcionista Ana: ~7–8 rows visible, no compact density; no "where was I"/draft marker; >48h backlog invisible as a group.

## Minor Observations
Search text smaller than rows; 8px channel glyph; owner vs "Transferida" share a line; ⋯ menu zoom animation; 157 console 403/404 (expired WhatsApp media/avatars, falls back to initials).

## Questions
1. Show Jev-classified intent instead of raw last message?
2. Should the queue hand over the next conversation ("Próximo") instead of the attendant choosing?
3. Should Perfil & CRM open only on demand?
