---
target: admin-whatsapp
score: 27
max: 40
detector: 0
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\admin\\whatsapp-cloud-connect.tsx"
target_fingerprint: "sha256:0d5cbd0daf7173032ceeba427de4d68595b40300bad63613c852fe7c5717f6c7"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\admin\\whatsapp-cloud-connect.tsx"
timestamp: 2026-10-17T23-59-09Z
slug: src-components-admin-whatsapp-cloud-connect-tsx
---
# Crítica 2 — /admin/whatsapp (2026-10-18) — 27/40 (antes 23), detector 0
P1: botão Connect ativo sem clínica; coexistência como checkbox.
P2: espera de até 10s muda (sem texto de fase/aria-live); idioma vaza (· coexistence, metadata title pt); teste desabilitado sem motivo.
P3: tooltip duplicado; copy "Clinic (tenant)"/"inbox off"/step cru no cancelamento; retorno do disconnect ignorado.
