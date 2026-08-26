---
target: src/app/(public)/page.tsx
total_score: 26
max_score: 36
na_heuristics: 7
p0_count: 2
p1_count: 2
timestamp: 2026-08-26T22-19-10Z
slug: src-app-public-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3/4 | No loading/skeleton state for the async clinic/price fetches |
| 2 | Match System / Real World | 4/4 | WhatsApp mockup is pixel-faithful; copy uses natural PT-BR regional language |
| 3 | User Control and Freedom | 3/4 | No "clear/reset" once a specialty is typed; quick filters silently overwrite city with no undo |
| 4 | Consistency and Standards | 3/4 | "Valor sob consulta" repeats 3x per card in different spots/colors |
| 5 | Error Prevention | 2/4 | Free-text specialty field has no autocomplete - a typo likely dead-ends |
| 6 | Recognition Rather Than Recall | 3/4 | Quick filters don't show current city selection state |
| 7 | Flexibility and Efficiency | n/a | No returning-user shortcuts exist to evaluate on a first-touch marketing page |
| 8 | Aesthetic and Minimalist Design | 3/4 | Hero stacks badge+H1+subhead+search+3 trust badges - dense before scroll |
| 9 | Error Recovery | 1/4 | No zero-results / no-coverage empty state defined anywhere |
| 10 | Help and Documentation | 4/4 | FAQ directly answers the top real objections (cost, PIX, jejum, LGPD) |
| **Total** | | **26/36 (heuristic 7 n/a)** | **72% - Good** |

## Design Specificity Verdict

**LLM assessment**: Grounded, not a generic template. Real Sudoeste Baiano cities in the city selector, a pixel-faithful WhatsApp booking mockup, FAQ copy referencing LGPD/PIX/jejum, and a real accredited-clinics carousel.

**Deterministic scan**: 7 raw hits - gradient-text x2, gray-on-color x4, ai-color-palette x1. 3 of the 4 gray-on-color hits are false positives (hover-gated, never coexist). The ai-color-palette hit is a false positive (one pastel icon-chip out of six color-coded categories). The 2 gradient-text hits are genuine: hero-section.tsx:45 and whatsapp-showcase.tsx:41, both static (always-on) bg-clip-text gradient headings.

## Overall Impression

Strong bones - the WhatsApp mockup is a genuinely smart trust device - but the page promises what it doesn't deliver (transparent pricing that's hidden everywhere) and has no fallback when things don't go perfectly (no empty state, no autocomplete safety net). On mobile, a floating button covers real content.

## What's Working

1. WhatsApp showcase mockup - turns an abstract "how booking works" into something the visitor already trusts.
2. Quick-filter pills - collapse the search decision to one tap for the most common intent.
3. FAQ copy - answers real regional/logistics objections instead of boilerplate filler.

## Priority Issues

**[P0] "Valores transparentes" is promised in the hero subhead, but every card says "Valor sob consulta" - price never appears anywhere.**
Fix: surface the already-fetched getSpecialtyStartingPrices data as "a partir de R$X".
Suggested command: /impeccable clarify

**[P0] No zero-results / no-coverage empty state exists anywhere in the search flow.**
Fix: design an explicit empty state with a WhatsApp fallback CTA.
Suggested command: /impeccable harden

**[P1] On mobile, the floating WhatsApp CTA button overlaps body copy in the WhatsApp-showcase section, obscuring real text.** Verified live at 375px width.
Suggested command: /impeccable adapt

**[P1] Hero exceeds the working-memory budget** - confirmed on live mobile: quick-filter pill row truncates text, trust badges stack into 3 full-width rows, pushing the specialty grid below the fold.
Suggested command: /impeccable distill

**[P2] Two static gradient-text headings** (hero-section.tsx:45, whatsapp-showcase.tsx:41) - the most recognizable "AI slop" tell.
Suggested command: /impeccable quieter

## Persona Red Flags

**Jordan (Confused First-Timer)**: free-text search field, no visible price anywhere despite a "precos acessiveis" headline.

**Riley (Stress Tester)**: small city + specific specialty combo with zero coverage - no way to know if that's a bug or just no clinics there.

**Casey (Distracted Mobile User)**: scrolls past ~150px of stacked trust-badge pills before reaching the specialty grid; floating WhatsApp button covers real copy mid-scroll.

## Minor Observations

- hero-search.tsx quick filters silently overwrite the selected city with no visible undo.
- specialty-grid.tsx:133 falls back to a clinic count of 1 when there's no real data.
- Redundant "live" signal: animated dot + literal green-circle emoji say the same thing twice.
- featured-clinics.tsx uses stock Unsplash photos next to a "Verificada" badge.

## Questions to Consider

1. If "transparent pricing" is core to the pitch, is hiding price everywhere a business constraint or a design oversight?
2. Why does the WhatsApp mockup sit third instead of right after the hero, to de-risk the unfamiliar "pay at counter" model before asking for a search commitment?
3. Is there a genuine empty-result state anywhere in the search flow?
