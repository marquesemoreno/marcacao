# O que a clínica faz e o ERP não entrega

> Levantamento de 11/11/2026, base para a etapa 7 (ERP) do `docs/roteiro-prioridades.md`.
> "ERP" aqui significa o sistema de agenda e prontuário da clínica (ex.: os de Firebird da Urolaser e da Santa Clara).

Legenda: ✅ o Conecta já faz · 🟡 faz em parte · ⬜ não faz (oportunidade)

## 1. Fiscal e tributário

| Atividade | Por que costuma ficar fora do ERP | Conecta |
|---|---|---|
| Nota fiscal de serviço (NFS-e) por consulta ou procedimento | Cada prefeitura tinha seu sistema, então muitos ERPs nunca integraram. A NFS-e nacional, obrigatória para os municípios desde 2026, facilita uma integração única. | ⬜ |
| Recibo pelo Receita Saúde (profissional pessoa física) | Obrigatório desde 2025, emitido num app à parte da Receita | ⬜ |
| DMED, declaração anual dos pagamentos de pacientes (clínica PJ) | O contador monta com planilhas tiradas do sistema | ⬜ |
| Nota dos médicos PJ para a clínica (repasse) | Cobrança e conferência manuais | ⬜ |
| Reforma tributária (CBS/IBS na nota) | Os ERPs antigos vão demorar a atualizar | ⬜ |

## 2. Financeiro

| Atividade | Conecta |
|---|---|
| Repasse ou produção médica (percentual, valor fixo, por procedimento ou convênio) | ⬜ (dado parcial no BI de Faturamento) |
| Conciliação da maquininha e do PIX (taxas, antecipação, o que caiu) | ⬜ |
| Cobrança antes da consulta: link de pagamento, PIX cobrança, boleto, sinal para reservar vaga, cobrança de falta | ⬜ |
| Inadimplência e parcelamento de procedimento | ⬜ |
| Faturamento de convênio TISS (lote XML, protocolo, prazo de envio) | 🟡 o ERP costuma gerar o XML; o acompanhamento é manual |
| Glosas: conferência, recurso, prazo | ⬜, dor grande |
| Contas a pagar, fluxo de caixa, DRE por unidade | 🟡 aba Financeiro no BI, só leitura |
| Rentabilidade por procedimento, médico ou convênio | 🟡 |

## 3. Convênio, antes e depois do atendimento

| Atividade | Conecta |
|---|---|
| Autorização prévia no portal de cada operadora (guia SP/SADT, senha) | ⬜ |
| Conferir a carteirinha (elegibilidade) antes da consulta | ⬜ |
| Avisar o paciente quando a autorização sai ou é negada | ⬜ (dá para fazer com mensagem por etapa) |
| Tabela de preços e reajuste por convênio | ⬜ |

## 4. Relacionamento com o paciente

| Atividade | Conecta |
|---|---|
| Atender pelo WhatsApp e pelo Instagram | ✅ |
| Lembrete e confirmação, remarcação em massa | ✅ |
| Pós-consulta, retorno, aniversário, reativação | ✅ régua automática |
| Pesquisa de satisfação (NPS) e pedido de avaliação no Google | 🟡 NPS sim; o pedido de avaliação pode entrar na régua |
| Cobrar resposta de orçamento | ✅ |
| Lista de espera, vaga liberada | ✅ |
| Entrega de resultado de exame ou laudo com link seguro | ⬜, pedido comum |
| Termo de consentimento assinado digitalmente antes do procedimento | ⬜ (a ficha prévia cobre em parte) |
| Preparo do exame (jejum, suspender medicação) enviado no dia certo | 🟡 dá para fazer com mensagem por procedimento |
| Indicação e marcadores | ✅ |

## 5. Operação da recepção

| Atividade | Conecta |
|---|---|
| Senhas, painel da TV, fila de chegada | ✅ |
| Ficha prévia ou pré-cadastro | ✅ |
| Receita, atestado e pedido de exame digitais com assinatura ICP-Brasil (tipo Memed) | ⬜ |
| Teleconsulta com link e cobrança | ⬜ |
| Agendamento online pelo próprio paciente | ⬜ (a IA hoje só pré-agenda) |

## 6. Regulatório e sanitário (hoje é planilha e papel)

São lembretes e registros com prazo:
- Alvará sanitário, alvará de funcionamento, licença do bombeiro: data de renovação.
- CNES atualizado (profissionais entrando e saindo).
- Responsável técnico registrado no CRM. 🟡 Já é exigido nos disparos de marketing.
- PGRSS (lixo hospitalar): contrato de coleta, manifestos, comprovantes.
- Manutenção preventiva e calibração de equipamentos, com laudo e data.
- Esterilização: ciclos de autoclave e teste biológico.
- Validade de medicamentos e materiais (alerta de vencimento).
- Documentos dos médicos: CRM ativo, RQE, seguro de responsabilidade civil, contrato.
- LGPD: registro de acessos, pedidos do titular, RIPD. 🟡 Acessos e exclusão já existem.

Ideia: um "calendário de obrigações" com alertas por e-mail ou WhatsApp para a gestão.

## 7. Equipe

- Escala de médicos e recepção, troca de plantão.
- Ponto e banco de horas (geralmente outro app ou o contador).
- Metas e comissão da recepção ou do comercial. 🟡 O Relatório já mede conversão por atendente.

## Prioridade sugerida

Critério: dor alta + ninguém resolve bem + combina com o que o Conecta já tem.

1. **Cobrança e PIX antes da consulta, com sinal para reservar vaga:** reduz falta e usa o WhatsApp que já existe.
2. **NFS-e automática ao marcar "Atendida"** (NFS-e nacional, via um emissor como Focus NFe, NFE.io ou PlugNotas).
3. **Repasse médico:** fechamento do mês por médico, a partir do faturamento que a ponte já lê.
4. **Calendário de obrigações sanitárias e regulatórias:** barato de fazer, nenhum concorrente tem.
5. **Glosas de convênio:** a dor é enorme, mas é mais complexo; fica depois.

> Datas e obrigações fiscais (NFS-e nacional, Receita Saúde, DMED) devem ser conferidas com o contador antes de construir.
