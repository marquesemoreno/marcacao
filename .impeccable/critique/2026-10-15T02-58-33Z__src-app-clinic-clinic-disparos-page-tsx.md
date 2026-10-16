---
target: disparos
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\disparos\\page.tsx"
target_fingerprint: "sha256:677a133633d4a99a4b8f0939064b0c6cd0b5ee36ddacb15deae5dbefaa6db368"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\disparos\\page.tsx"
timestamp: 2026-10-15T02-58-33Z
slug: src-app-clinic-clinic-disparos-page-tsx
---
Method: dual-agent (A: ab054e075cfcbc1a8 · B: a96ae64589ddba9c8). Browser skipped (login).
Score 19/40. H1 1, H2 3, H3 2, H4 2, H5 1, H6 2, H7 2, H8 2, H9 2, H10 2.
Detector: 2 gray-on-color, both false positives (hover-only). Detector missed the rounded-full status badge (broadcast-management ~408), which violates DESIGN.md.
Priority:
- [P0] "Iniciar" starts mass send with no confirmation/preview (reschedule has one) -> harden
- [P1] Sending engine state invisible (window closed, yielding, daily cap, ETA, no polling) -> clarify
- [P1] ETA wrong (uses 5–10 min vs 4–6, ignores window/cap) and only for Marcadores -> clarify
- [P2] Form IA: message before audience; global exclusions inside picker; create+monitor in one scroll -> layout/distill
- [P3] DS deviations: pill badge, text-[11px], input sizes, amber reschedule CTA competing -> polish
Minor: no edit/delete/duplicate draft; "Tente editar" message without edit; spinner reload on toggle; full phones in preview (LGPD); keyboard: hidden file inputs, no aria on audience selector.
