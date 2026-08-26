---
target: src/app/(public)/page.tsx
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-26T23-37-02Z
slug: src-app-public-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3/4 | "Buscar" button has no loading state on submit |
| 2 | Match System / Real World | 4/4 | WhatsApp mockup, PIX, "balcao" language match patient reality precisely |
| 3 | User Control and Freedom | 3/4 | Quick filters silently overwrite a typed query with no undo |
| 4 | Consistency and Standards | 3/4 | Badge messaging repeats itself across the hero |
| 5 | Error Prevention | 2/4 | The featured "Oftalmo" quick filter routes to a specialty with zero live clinics |
| 6 | Recognition Rather Than Recall | 4/4 | Icon-labeled fields, contextual placeholders per category |
| 7 | Flexibility and Efficiency | 3/4 | Quick-filter chips help, but no memory of last city/search across visits |
| 8 | Aesthetic and Minimalist Design | 3/4 | Hero stacks pill badge + 3 trust badges + "sob consulta" tag - redundant signals |
| 9 | Error Recovery | 2/4 | Honest empty states are good, but AI-widget fetch failures give no retry |
| 10 | Help and Documentation | 3/4 | FAQ + WhatsApp footer + AI widget give layered, appropriate help |
| **Total** | | **30/40** | **75% - Good** |

## Verification of prior fixes
- Pricing states confirmed correct via DOM check (no R$0,00 anywhere).
- Gradient text confirmed removed (solid colors verified via computed style).
- FAB overlap: hero quick-filter overlap now negligible. WhatsApp-showcase "Passo 02" overlap still reproducible at one scroll position (confirmed via DOM intersection test).

## Priority Issues

**[P0] Featured "Oftalmo" quick-filter routes to a specialty with zero live clinics.**
Fix: filter quickFilters by live clinic counts before rendering.

**[P1] WhatsApp-showcase FAB overlap still reproducible at one scroll position.**

**[P1] featured-clinics.tsx truncates clinic tradeName even on desktop, hiding identity next to the "Verificada" badge.**

**[P2] Hero still stacks 4+ redundant trust signals.**

**[P3] Specialty cards render unsorted, mixing priced/unpriced/zero-clinic states.**

## Minor Observations
- Pill badge and trust-badge row both say "sem mensalidade" - redundant.
- featured-clinics.tsx cycles generic stock photos by index.
