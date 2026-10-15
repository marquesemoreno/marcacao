---
target: relatorio
score: 25
max: 40
detector: 0
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\relatorio\\page.tsx"
target_fingerprint: "sha256:b831562e1682e9eddd2524f358c42f13829b845c0a404d07a3396d95a6a4b785"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\app\\(clinic)\\clinic\\relatorio\\page.tsx"
timestamp: 2026-10-15T12-08-59Z
slug: src-app-clinic-clinic-relatorio-page-tsx
---
# Crítica — /clinic/relatorio (2026-10-15)

Nota Nielsen: 25/40. Detector: 0 achados. Especificidade: parcial.

## P0
- Motivos de perda (PERDA_*) e INATIVIDADE não aparecem; conversão = agendados/RESOLVED inclui auto-close por inatividade → conversão cai sem mudança real.

## P1
- Audits (SLA, medianas, sentimento) não aplicam NOT_ADMINISTRATIVE (actions/clinic.ts:114-117).
- Filtros ativos invisíveis; escopo inconsistente (Demanda/Pico/Campanhas ignoram tag/canal; Agendamentos ignora canal).

## P2
- 9 seções de mesmo peso; SLA duplicado; "Tempo médio" (média) na equipe vs mediana no resto.

## P3
- Números sem drill-down; sem mês-calendário; CSV sem procedimento; delta só por cor para leitor de tela; ícones sem aria-hidden; conversão 0% quando não há base; "Maior conversão" sem volume mínimo; Title Case misturado.
