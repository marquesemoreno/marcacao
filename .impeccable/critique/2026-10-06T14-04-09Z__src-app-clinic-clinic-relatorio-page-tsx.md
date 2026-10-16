---
target: /clinic/relatorio
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\relatorio\\page.tsx"
target_fingerprint: "sha256:0973de43e6c84cd3b169a34c6138dd8bb7987bb2b8e5d74de6b566af1d6f0c7f"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\relatorio\\page.tsx"
timestamp: 2026-10-06T14-04-09Z
slug: src-app-clinic-clinic-relatorio-page-tsx
---
Method: dual-agent (A: design review, source-only · B: detector + browser, dark/light/mobile, Urolaser user)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | No "updated at"; no chip when tag/channel filter active |
| 2 | Match System / Real World | 3 | "Mediana", "Sentimento auditado" are analyst terms |
| 3 | User Control and Freedom | 2 | No clear-filters, no custom range |
| 4 | Consistency and Standards | 2 | Three revenue concepts; 60-min critical SLA never shown |
| 5 | Error Prevention | 3 | Read-only page |
| 6 | Recognition Rather Than Recall | 2 | Remarcar folded into Cancelados/Liberados; shares don't visibly add up |
| 7 | Flexibility and Efficiency | 2 | No previous-period comparison; CSV without period/filters |
| 8 | Aesthetic and Minimalist | 2 | ~9 equal-weight sections; sentiment as heavy as SLA |
| 9 | Error Recovery | 2 | Unexplained "—"; campaigns section vanishes when empty |
| 10 | Help and Documentation | 3 | Good inline base notes |
| Total | | 24/40 | Acceptable |

## Design Specificity Verdict
Copy is product-specific (Receita Protegida, 1ª resposta em horário comercial, "ficaram de fora", base notes); structure is a generic KPI dashboard of equal cards; nothing says if a number is good or bad.
CLI: 0 findings. Browser: dark 45, light 35, mobile 43 overlays — 22 text-[10px] chart labels (peak hours), ~9 text-[11px] helper captions (several slate-400 low contrast), 2 long lines, 2 cramped tables, height transition; 9 "ai color palette" on revenue card icons (dark only, questionable). No horizontal overflow anywhere; no console errors.

## Priority Issues
- [P0] Estimates presented as facts and first — move R$ cards to the end with "Estimativa" badge + visible formula; rename "Receita Protegida" to "Valor das consultas confirmadas". /impeccable clarify
- [P1] No verdict or comparison — delta vs previous period per KPI; SLA colored vs 15/60; 3-line "Resumo do período" on top. /impeccable layout
- [P1] Order doesn't follow the manager's questions — Atendimento → Confirmações → Canais → Campanhas → Demanda/Pico → estimated values; sentiment down/collapsed. /impeccable distill
- [P2] Flat hierarchy + tiny text — larger section headings, one primary KPI per section, min 12px, helper text contrast. /impeccable typeset
- [P3] Export loses context — period/filters/generated-at in CSV header rows and filename. /impeccable harden

## Persona Red Flags
Gestor(a) weekly on phone: reads estimated revenue and leaves; 3 filters + button before data; 9 sections, no summary or week-over-week.
Sam: bar charts are divs with title, no list/table semantics; icons not aria-hidden; KPI labels not headings; 11px low-contrast captions.
Alex: fixed 7/30/90 only; single-column CSV without context.

## Minor Observations
"Base: N lembretes" shows under empty confirmation state; conversion denominator = resolved conversations (only in small text); response medians exclude never-answered conversations (small text only); sentiment may show 0/0/0% with no audits (unverified); height transition unnecessary.

## Questions
1. One number per week — which, and why isn't it first?
2. Should "Receita Protegida" exist without a pre-reminder no-show baseline?
3. Page vs weekly WhatsApp digest to the manager with this page as drill-down?
