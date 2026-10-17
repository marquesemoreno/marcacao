---
target: admin-whatsapp
score: 23
max: 40
detector: 0
target_identity: "file:C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\admin\\whatsapp-cloud-connect.tsx"
target_fingerprint: "sha256:120cbfc61444cca8123a377c7b4bc6bee59a9031e4ab96ad9766ab3f3af5dbc4"
target_path: "C:\\Users\\lucas\\Documents\\TIVDC\\MARCACAO\\src\\components\\admin\\whatsapp-cloud-connect.tsx"
timestamp: 2026-10-17T23-46-59Z
slug: src-components-admin-whatsapp-cloud-connect-tsx
---
# Crítica — /admin/whatsapp (2026-10-17) — 23/40, detector 0
P0: ativo (WABA/número/IDs) pequeno e cinza pós-conexão, sucesso só em toast; erros do servidor em pt no modo EN.
P1: setTimeout 1,5s pode perder ids (+ filtro de origem fraco, FINISH_ONLY_WABA); desconectar via confirm() sem pending; teste sem label/loading/feedback.
P2: cancelamento mostra step cru; coexistência como checkbox (deveria ser radiogroup); botão ativo sem clínica.
P3: copy EN ("Clinic (tenant)", "inbox off", "hello_world ✓"), metadata title pt, "· coexistence" fixo.
