---
target: pagina Agenda
score: 27
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\agenda\\agenda-app.tsx"
target_fingerprint: "sha256:99c57ac6026a2498de6aadcf4846eb473942fbe24c963c9fa0f041e2a245d3bc"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\agenda\\agenda-app.tsx"
timestamp: 2026-11-02T13-58-58Z
slug: src-components-clinic-agenda-agenda-app-tsx
---
# Crítica Agenda 02/11 (2ª) — 27/40
P0 desfazer "Atendido" zera chegada (agenda-app.tsx:179; AgendaMark.updatedAt). P1 remarcar deixa horário antigo ativo; scrollIntoView a cada 15 min pula a página; "atrasado" conta da chegada, não do horário marcado. P2 faixas acima da grade + altura fixa; Faltou/Cancelado sem confirmação; vocabulário (Sem lembrete × Sem confirmação, ponto rosa × cancelado escuro). P3 dica de atalhos da barra lateral; lista de espera marca "Oferecido" antes de enviar.
Detector: só o falso positivo de agenda-grid.tsx:87.
