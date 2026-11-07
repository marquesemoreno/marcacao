# Roteiro por prioridade — Conecta Saúde

Atualizado em 07/11/2026. Tudo que está pendente, as melhorias combinadas e a ordem para resolver.
Regra geral: primeiro destravar o que já está pronto, depois o que tira horas da recepção
(argumento da jornada menor / fim da 6x1), depois o que traz receita, e só então o ERP.

Legenda: 🔴 bloqueia outros itens · 🟡 depende de terceiros · ✅ código pronto, falta ligar/testar

---

## Etapa 0 — Conferências rápidas (pendências de teste)

| # | Item | Situação | Como resolver |
|---|------|----------|---------------|
| 0.1 | ✔️ WhatsApp oficial — teste ponta a ponta pelo número da TIVDC | **FEITO 07/11**: texto recebido e respondido pelo Chat; áudio, PDF e imagem recebidos e salvos; resposta pelo celular (coexistência) apareceu no Chat; histórico sincronizado na conexão | Falta só o modelo `appointment_reminder` → vai na Etapa 1 |
| 0.2 | ✔️ Calculadora de preços do site | **FEITO 07/11**: totais conferidos (padrão R$ 899,50; Essencial R$ 649,50; franquias e negativos OK) | — |
| 0.3 | ✔️ Fila de orçamentos 3/7/15 dias + card de conversão | **FEITO 07/11** na clínica demo (fila, Pular, cartão do Relatório OK). Nenhuma clínica real usa a etapa Orçamento ainda | Etapa 2: marcar Orçamento sozinho quando a IA detectar valor enviado |
| 0.4 | ✅ Marcação fora do horário | Desligada em todas | Ligar na TIVDC, testar à noite, depois Urolaser |
| 0.5 | ✅ Jornada do paciente (ficha prévia, Cheguei, TV, senhas, QR, NPS, vaga automática) | Nada ligado em clínica real | Piloto na Urolaser seguindo docs/piloto-jornada-urolaser.md |

## Etapa 1 — WhatsApp oficial em produção (destrava metade do roteiro)

1. Concluir 0.1 na TIVDC.
2. Criar e aprovar os modelos: lembrete, pós-consulta, retorno, aniversário, reativação, link da ficha.
3. Migrar **Urolaser** (coexistência, nunca SMS); desconectar a Evolution antes de ligar no Chat.
4. Ligar lembretes pela API, régua automática e Disparos por modelo.
5. Migrar **Santa Clara** quando a Urolaser estiver estável.
6. 🟡 Enviar App Review do Instagram para pacientes.

## Etapa 2 — Automação do atendimento (argumento da jornada menor)

Base: análise de 60 dias (Urolaser ~210 e Santa Clara ~170 mensagens digitadas por dia útil;
~35% repetidas). Construir com TDD, nesta ordem:

1. ~~Recusa automática de ligação~~ — revisado 07/11: só 4 em 60 dias; as outras 64 eram telefones de médicos de fora (vai no item 5).
2. ✔️ **FEITO 07/11 (d4885e7)**: despedida automática ao finalizar (Ações da IA, desligada por padrão; caixa no modal). Falta a gestão ligar em cada clínica.
3. ✔️ **FEITO 07/11 (93acc7b)**: saudação no 1º contato e na volta após atendimento finalizado ({{saudacao}}, {{nome}}) + endereço com Google Maps quando perguntam "onde fica". Ações da IA, desligados por padrão.
4. ✔️ **FEITO 07/11 (4da8acb)**: agendar pela ponte manda confirmação ao paciente (caixa marcada no modal). Pela grade da Agenda também ✔️ 07/11. Falta: instruções de cirurgia por procedimento (Santa Clara, depende da validação).
5. IA de preços e regras por procedimento, lendo Configurações (~440 conversas), **incluindo médicos que só operam na clínica e o telefone da secretária deles** (Santa Clara ~64x). Textos validados com as clínicas.
6. Triagem automática (idade, sonda/cadeirante, comorbidades, exames pré-op) com respostas na ficha (~180x).
7. Lista de convênios aceitos para a IA responder (Santa Clara 168 conversas).
8. ~~**Relatório "horas poupadas"**~~ ✅ 07/11 79e45ec — cartão no Relatório (Urolaser 30 dias: 1.073 msgs ≈ 13,4 h).
9. ✔️ **FEITO 07/11 (93e11dd)**: encerramento automático agora reconhece "Agendado(a)…" da recepção (→ Agendamento concluído) e informação entregue (Jev → Dúvida esclarecida). Urolaser tinha 374/766 (49%) como inatividade em 30 dias. Retroativo não aplicado.

## Etapa 3 — Marketing e rastreamento (módulo novo)

1. 🟡 Pedir já à Meta a permissão de anúncios (`ads_read`/`ads_management`) e ao Google o token do Google Ads (demoram semanas).
2. Fase 1 — rastreamento: ✔️ 07/11 147104b referral da API oficial → canal/anúncio da conversa (igual à Evolution). Falta: UTMs no site, funil conversa → agendou → compareceu → faturou, custo por paciente atendido. Antes: origem do anúncio de clique para WhatsApp (referral da API oficial), UTMs, funil conversa → agendou → compareceu → faturou, custo por paciente atendido.
3. Fase 2 — gasto automático das contas Meta/Google + painel de ROI por campanha.
4. Fase 3 — API de Conversões (Meta) e conversões offline (Google): só evento + dados criptografados, **nunca** procedimento/dado de saúde (LGPD).
5. Fase 4 — regras automáticas (pausar/reforçar verba, campanha quando a agenda esvazia) em modo "propor e confirmar"; sugestões da IA.

## Etapa 4 — Receita sem ERP

1. 🟡 **Nível 1 FEITO 07/11 (7c2b54b)**: IA adianta o pedido de marcação também no horário comercial (5 min sem resposta, cron booking-assist). Nível 2 (IA marca sozinha) espera a grade de dias/turnos de cada médico.
2. 🟡 07/11 00aa7f5: cartão "Vagas recuperadas" no Relatório pronto. Falta a gestão ligar a vaga automática e usar a lista de espera (nenhuma clínica usa ainda).
3. Envio automático da cobrança de orçamento pelo WhatsApp oficial.
4. ✔️ **FEITO 07/11 (cda228c)**: NPS 9–10 → botão "Avaliar no Google" (link em Configurações > Parâmetros). Falta cada clínica colar o link.
5. ✔️ **FEITO 07/11**: cartão "O que a régua trouxe" no Relatório (enviados/responderam/agendaram em 30 dias, × ticket médio). Só aparece quando a régua rodar (API oficial).

## Etapa 5 — BI antes do ERP

1. 🟡 **Santa Clara mapeada 07/11** (docs/mapeamento-firebird-santa-clara.md, local): FINANCEIRO (CPR1/2/3, MOVIMEN, CUSTOS) e ALMOXA (PRODUTOS, PRODSTOK, ENTRA/SAIDA). Falta a clínica explicar por que não há baixas desde 10/10/2026; estoque mínimo não cadastrado. Urolaser depois.
2. Painel do dono: faturamento estimado, faltas, conversão por canal/campanha, ocupação por médico, horas poupadas.
3. Se o Firebird tiver dados: financeiro real (receber/pagar, caixa, ticket por médico/procedimento, inadimplência) e estoque (consumo, mínimo, validade) via bridge. Acesso só gestão, registrado em Acessos.
4. ✔️ 07/11: Previsão da semana no Relatório (agenda da ponte 7 dias × resposta ao lembrete por médico nas últimas 3 semanas; falta real não medível).

## Etapa 6 — Fundação para vender

1. Login mais seguro: 2FA, redefinir senha, revogar sessão, log; corrigir bug do e-mail com maiúscula.
2. Cadastro de clínica nova só pela tela de admin (procedimentos, médicos, textos, WhatsApp).
3. Site no ar: domínio, prints, privacidade e termos.
4. Materiais de venda e conteúdo sobre a jornada menor (números das clínicas só com autorização ou anonimizados).
5. API pública v1 — só quando surgir integração real.

## Etapa 7 — ERP

Agenda → prontuário → financeiro → estoque, guiado pelo que o mapeamento da Etapa 5 mostrar que falta.

---

## Pendências de terceiros (acompanhar em paralelo)

| Quem | O que |
|------|-------|
| Urolaser | Instalar novo `index.js` (retorno, médico, STATUS) e checar duplicados no pm2; significado dos STATUS; piloto da jornada; backup FBK para análise de retorno |
| Santa Clara | Responsável técnico (nome + CRM) — sem isso campanhas de marketing não iniciam; `index.js` com medicoUltima |
| Meta | Permissão de anúncios; App Review do Instagram (após WhatsApp) |
| Google | Token de desenvolvedor do Google Ads |
| Advogado | Revisão LGPD, termos e contrato (incluir regra de dados para anúncios) |
| Você (decisões) | Imagem da Lara no lembrete automático; franquia de IA por plano; desconto de fundador; conferir preços Comtele/Resend |
| Rotina | Próximo teste de restauração do backup: fev/2027 |

## Melhorias de design pendentes

- ✔️ 07/11: widgets internos do painel lateral do Chat e ficha do paciente no estilo novo (conferir na tela).
- Modo claro só conferido no Chat.
