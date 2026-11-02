---
target: pagina Agenda
score: 29
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\agenda\\agenda-app.tsx"
target_fingerprint: "sha256:7c2e7b6cb03be8a3d0fae848b0f9534bfa642ab5de79c509b8e8be9ab772c038"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\agenda\\agenda-app.tsx"
timestamp: 2026-11-02T15-22-45Z
slug: src-components-clinic-agenda-agenda-app-tsx
---
# Crítica Agenda 02/11 (3ª) — 29/40
P0 nenhum. P1 deslocamento da grade (fila/pendências crescem acima); atalhos disparam com o menu de status aberto. P2 falha da atualização automática silenciosa; cancelar antigo na remarcação sem desfazer, LOCAL sem 2º toque; convênio/fim ausentes. P3 rótulos âmbar longos; diálogo "?" sem focus trap; rejeição não tratada em pick.
Detector: só falso positivo agenda-grid.tsx:95.
