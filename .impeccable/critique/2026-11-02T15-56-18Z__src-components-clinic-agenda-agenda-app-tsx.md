---
target: pagina Agenda
score: 30
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\agenda\\agenda-app.tsx"
target_fingerprint: "sha256:875374977228f53320e7c649543df14200666090e2ba5d2d2536126f2c9b9649"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\clinic\\agenda\\agenda-app.tsx"
timestamp: 2026-11-02T15-56-18Z
slug: src-components-clinic-agenda-agenda-app-tsx
---
# Crítica Agenda 02/11 (5ª) — 30/40
P1 filtros persistem ao navegar sem aviso (dia vazio parece sem paciente; médico some da lista); pendências/busca (wide) atrasam até 90 s após marcar. P2 wide de 42 dias recarrega a cada 90 s (carga no PC da clínica); toque em célula vazia abre agendamento; mini-calendário navega a agenda ao trocar mês. P3 fila misturando médicos; fila só com date===today; foco não volta ao fechar atalhos. Detector: border-l-4 (side-stripe) em appointment-card.tsx:70 — real; resto falso positivo.
