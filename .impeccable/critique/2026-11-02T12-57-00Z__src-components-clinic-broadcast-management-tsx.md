---
target: pagina Disparos
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\broadcast-management.tsx"
target_fingerprint: "sha256:e2e4a750dda79a1b695a42674d9f841bcdc631f25f7416a89b7cca6670ac61f0"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\broadcast-management.tsx"
timestamp: 2026-11-02T12-57-00Z
slug: src-components-clinic-broadcast-management-tsx
---
Crítica Disparos (3ª rodada, após f694292) — 26/40

Heurísticas: 1=3 2=3 3=3 4=2 5=3 6=3 7=2 8=2 9=3 10=2.
Detector: 3 gray-on-color — falsos positivos (mesmos de sempre).

Priority issues:
- [P1] Saúde só olha "hoje"; campanha de vários dias / volume de 7 dias ignorado — harden
- [P1] Texto "até 100 por dia" × constante 80 em number-health (teto real do dispatcher = 100; 80 era estimativa) — clarify
- [P2] "Entendo o risco" genérico; não diz o que está em jogo nem oferece alternativa (baixa prioridade) — clarify
- [P2] Diálogo de início ainda denso (parágrafo de ritmo longo) — distill
- [P3] Ajuda só em title tooltip ("Médico desmarcou"); Régua escondida para recepção — onboard
