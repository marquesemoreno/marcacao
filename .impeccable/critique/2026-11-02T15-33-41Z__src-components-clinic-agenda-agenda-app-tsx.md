---
target: pagina Agenda
score: 29
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\agenda\\agenda-app.tsx"
target_fingerprint: "sha256:34c64452005f72d80dee1eb05b95039f9e338d8ae0845df0052403166c6af802"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\agenda\\agenda-app.tsx"
timestamp: 2026-11-02T15-33-41Z
slug: src-components-clinic-agenda-agenda-app-tsx
---
# Crítica Agenda 02/11 (4ª) — 29/40
P1 sem sinal de "já devia ter chegado" (confirmado com horário passado igual aos futuros); pendências presas ao período carregado. P2 Faltou do sistema não entra nas pendências (toast manda ajustar); busca só no período; aviso "sem telefone não aparece" só em tooltip. P3 "Sem resposta" conta "Sem lembrete"; rejeição não tratada no menu da ficha; auto-refresh roda com o menu do cartão aberto; foco invisível no nome da fila; "Livre" slate-400.
Detector: só falso positivo agenda-grid.tsx:95.
