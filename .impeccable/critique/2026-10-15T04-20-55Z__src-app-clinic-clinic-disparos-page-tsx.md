---
target: disparos
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\disparos\\page.tsx"
target_fingerprint: "sha256:677a133633d4a99a4b8f0939064b0c6cd0b5ee36ddacb15deae5dbefaa6db368"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\disparos\\page.tsx"
timestamp: 2026-10-15T04-20-55Z
slug: src-app-clinic-clinic-disparos-page-tsx
---
Method: dual-agent (A: a744343b8d08fd926 · B: a04fc5573699e6e10). Browser skipped (login).
Score 27/40 (19→27→27→27). H1 3, H2 3, H3 3, H4 2, H5 3, H6 3, H7 2, H8 3, H9 3, H10 2.
Detector: 6 gray-on-color, all false positives.
Priority:
- [P0] Resuming a paused urgent notice goes through the campaign start dialog: copy says Mon–Fri 9–17h/100 per day and ETA uses campaign math; dispatcher sends 08–18h daily -> clarify (isReschedule in preview; urgentSendTimes + recompute call list)
- [P1] Toast "Aviso disparado para N" implies already sent; they were only queued -> clarify
- [P1] "Ligue para eles" list disappears when modal closes -> harden (persist on urgent campaign card with "liguei" checkbox)
- [P2] Card actions flat (up to 5 equal buttons) -> distill (primary stands out; rest in "Mais")
- [P3] Urgent modal off-DS (text-xs, amber focus, nested alertdialog, internal scroll) -> polish
Minor: stale comment broadcast-schedule.ts:5; 07:00 default deadline for no-time patients; disabled-create reason only in title; role=alert fires per keystroke.
