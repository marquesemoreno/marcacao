---
target: pagina Disparos
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\broadcast-management.tsx"
target_fingerprint: "sha256:c294cc968e865fe95d3053b903e1af7f7f2e671fe62c68be2086bbd2388e3246"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\broadcast-management.tsx"
timestamp: 2026-11-02T11-53-27Z
slug: src-components-clinic-broadcast-management-tsx
---
Crítica Disparos (broadcast-management.tsx + automation-rules-sheet.tsx) — 28/40

Heurísticas: 1=3 2=3 3=3 4=2 5=3 6=3 7=2 8=3 9=3 10=3.
Detector: 3 gray-on-color (reschedule-broadcast-modal.tsx:246 x2, broadcast-preview.tsx:10) — todos falsos positivos (dark:/hover misturados).

Priority issues:
- [P1] Saúde do número (estado, volume automático hoje, último bloqueio) ausente no diálogo de início e no header — harden
- [P1] Régua: Ligar sem prévia de impacto; botões Salvar/Desligar/Ligar ambíguos (automation-rules-sheet:106-123); daysAfter e {{n}} sem validação; erro de load vira lista vazia (:143) — harden
- [P2] Sheet Nova campanha sobrecarregado, {{n}} longe do modelo, fechar descarta sem confirmar — distill
- [P2] Linha de stats do card com até 8 cláusulas (:1305-1317) — layout
- [P3] 3 idiomas de seleção, nome cru do modelo Meta, link "Configurações" → /clinic/precos (:1101) — polish

Personas: Alex (sem busca/filtro, Duplicar escondido); Sam (csvError sem aria-live, svg aria-label sem role, sem focus ring na régua, {{1}} lido literal); Recepcionista (sem "Pausar todos", Pausar fraco, remarcação = peso secundário).
