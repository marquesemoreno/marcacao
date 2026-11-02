---
target: pagina Disparos
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\broadcast-management.tsx"
target_fingerprint: "sha256:040449d2cd57a950b8bd95d2453c55401478131bc15ba09af3c055d339e57f1a"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\broadcast-management.tsx"
timestamp: 2026-11-02T12-41-31Z
slug: src-components-clinic-broadcast-management-tsx
---
Crítica Disparos (re-run após e1f8a8f, 6c1fe82, 8ce49df) — 26/40

Heurísticas: 1=3 2=3 3=3 4=2 5=3 6=3 7=2 8=2 9=3 10=2.
Detector: 3 gray-on-color (reschedule-broadcast-modal.tsx:246 x2, broadcast-preview.tsx:10) — falsos positivos.
Descartado: "régua ignora saúde do número" — régua só roda com API oficial, onde numberHealth é sempre ok.

Priority issues:
- [P1] numberHealth ignora o volume da própria campanha (flat 80/dia) — harden
- [P2] Diálogo de início: risco vem depois da prévia; botão verde mesmo em alerta; pílula mostra só reasons[0] — clarify
- [P2] Cabeçalho com 4 botões de mesmo peso; remarcação × nova campanha confundíveis — distill
- [P3] Card: "Puladas" duplicado (célula + parágrafo) — distill
- [P3] Janela 9h–17h vs 8h–18h sem explicar; fuso America/Bahia vs Sao_Paulo; erro de carga vira estado vazio
