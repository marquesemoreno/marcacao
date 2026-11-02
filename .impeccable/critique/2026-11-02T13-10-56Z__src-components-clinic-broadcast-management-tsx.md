---
target: pagina Disparos
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\broadcast-management.tsx"
target_fingerprint: "sha256:df9ff85fe27a34927781f1da1ba859af89fbb553973bb1002c410b63a7ddfd23"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\broadcast-management.tsx"
timestamp: 2026-11-02T13-10-56Z
slug: src-components-clinic-broadcast-management-tsx
---
Crítica Disparos (4ª rodada, após 65bdac0) — 29/40

Heurísticas: 1=3 2=4 3=3 4=3 5=3 6=3 7=2 8=3 9=3 10=2.
Detector: 3 gray-on-color — falsos positivos.

Priority issues:
- [P1] "Criar rascunho" desabilitado explica só por title (:1092) — clarify
- [P1] "Pausar todos" sem Desfazer; pausa também avisos urgentes de remarcação (:614) — harden
- [P2] Chip de saúde com todos os motivos em linha vira parágrafo (:609) — distill
- [P2] Interruptor da régua desabilitado sem motivo visível (automation-rules-sheet:100) — clarify
- [P3] Falhas mostram telefone cru, sem nome/link pro Chat (:1596) — polish
