---
target: pacientes (contatos)
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\contatos\\page.tsx"
target_fingerprint: "sha256:f045f837b35385b8d55a39d352340b6e068ebeb3a1935c73166e365dc32c215f"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\contatos\\page.tsx"
timestamp: 2026-10-15T10-21-56Z
slug: src-app-clinic-clinic-contatos-page-tsx
---
Method: dual-agent (A: a48955504421cae92 · B: ae87bf8bf34e7f2e1). Browser skipped (login).
Score 21/40. H1 2, H2 2, H3 2, H4 2, H5 2, H6 3, H7 2, H8 3, H9 1, H10 2.
Detector: 0 findings.
Priority:
- [P0] Load error shown as empty list ("Nenhum paciente cadastrado ainda") — errors swallowed -> harden
- [P1] Bulk "Atribuir a…" applies on select change, no confirm/undo, opaque partial failures -> harden
- [P1] Selection limited to current page (50); no "select all N results"; no-phone count only after -> clarify/layout
- [P2] Naming: Pacientes vs /contatos vs "Novo Contato" vs "Novo" -> clarify
- [P2] List doesn't answer "who is waiting?" (no waiting indicator, no stage/owner filter, no sort, no bridge origin) -> shape
Minor: truncated names without title; admin table shows full CPF (LGPD); loading not aria-busy; select onChange risk with keyboard.
