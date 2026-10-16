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
timestamp: 2026-10-15T03-28-50Z
slug: src-app-clinic-clinic-disparos-page-tsx
---
Method: dual-agent (A: a5a91145bbbe4958c · B: a5a5a45155a7cf367). Browser skipped (login).
Score 27/40 (up from 19). H1 3, H2 4, H3 2, H4 3, H5 2, H6 3, H7 2, H8 3, H9 2, H10 3.
Detector: 4 gray-on-color, all false positives.
Priority:
- [P0] Start dialog warns about unknown {{var}} but "Iniciar envio" stays enabled -> harden (disable; also block literal [PLACEHOLDER])
- [P1] Situation/ETA misleading under contention: only low-priority computes yielding; normal campaigns in rotation always show "Enviando 1 a cada 4–6 min"; ETA ignores holidays/rotation -> clarify
- [P1] "Aviso de remarcação" bypasses safe pacing with same weight as normal tool -> harden (label "sai na hora", warning, cap)
- [P2] Failure reasons only in title -> harden (details list + retry failures)
- [P3] Flat list: running campaigns not highlighted; inline form pushes list; no live preview -> layout
Minor: Feminino default in bridge picker; name not required client-side; aria-live on every card; radiogroup without arrows; link label vs /clinic/precos.
