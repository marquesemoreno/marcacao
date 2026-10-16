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
timestamp: 2026-10-15T04-01-19Z
slug: src-app-clinic-clinic-disparos-page-tsx
---
Method: dual-agent (A: ad0e819e07722bec6 · B: ac5e9bbdef279bff8). Browser skipped (login).
Score 27/40 (19 → 27 → 27). H1 3, H2 4, H3 2, H4 2, H5 3, H6 3, H7 2, H8 3, H9 3, H10 2.
Detector: 6 gray-on-color, all false positives.
Priority:
- [P0] Urgent notice ETA (count*5/60 h) ignores the 08–18h window, sharing with reminders/campaigns and the appointment date — patients may get the notice after their appointment -> harden (real finish time; red warning + list who won't be reached before the appointment: call them)
- [P1] Campaign ETA ignores reminders sharing the gap -> clarify (range + "lembretes têm a vez")
- [P1] Urgent modal says "não pode ser desfeito" though the campaign can be paused from the list (A's claim that it can't be paused is wrong; copy is the issue) -> clarify
- [P2] Three confirmation patterns (window.confirm, Dialog, inline alert); low-priority toggle without undo on every card -> polish
- [P3] No single view of the clinic's send queue (next automated send) -> onboard/distill
