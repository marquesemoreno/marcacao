---
target: pagina Disparos
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\broadcast-management.tsx"
target_fingerprint: "sha256:ddb41d5565b10751000839e5cc3cba4595e7fd1b63242a8b700e949f2809ef87"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\broadcast-management.tsx"
timestamp: 2026-11-02T13-32-43Z
slug: src-components-clinic-broadcast-management-tsx
---
Crítica Disparos (6ª rodada, após 8227692) — 28/40

Heurísticas: 1=3 2=3 3=3 4=2 5=3 6=3 7=3 8=2 9=3 10=3.
Detector: 3 gray-on-color — falsos positivos.

Priority issues:
- [P1] HIGH_VOLUME_7D=250 não pega o padrão de outubro (~115 em 4 dias ≈ 200/7d) — harden
- [P1] "Mais seguro: baixa prioridade" no diálogo marca lowPriority mesmo se o servidor falhar; sem estado ocupado — harden
- [P2] Chip de saúde discreto demais (recolhido, 12px); em perigo merece faixa — clarify
- [P2] Anel de foco faltando em vários botões (Continuar, Criar, Cancelar, Iniciar do card…) — polish
- [P3] "Saíram da lista"/"Sem aceite" sem explicação — clarify
