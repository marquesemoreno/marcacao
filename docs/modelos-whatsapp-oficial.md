# Modelos da API oficial do WhatsApp (pt_BR)

Enviados à Meta na TIVDC em 07/11/2026 (PENDING). Cada clínica tem sua própria conta na Meta, então os modelos são
criados uma vez por clínica (primeiro TIVDC, depois Urolaser e Santa Clara).
O nome da clínica não entra no texto: o paciente já vê o nome verificado do número.

| # | Nome na Meta | Categoria | Uso no sistema | Variáveis |
|---|---|---|---|---|
| 1 | `lembrete_consulta` | Utilidade | Lembrete da véspera (ponte) | {{1}} nome · {{2}} data · {{3}} hora · {{4}} médico ou procedimento |
| 2 | `pos_consulta` | Utilidade | Régua: 1 dia depois | {{1}} nome |
| 3 | `pesquisa_satisfacao` | Marketing | Régua: NPS, 2 dias depois | {{1}} nome · {{2}} link |
| 4 | `retorno_consulta` | Marketing | Régua: retorno (6 meses) | {{1}} nome |
| 5 | `reativacao_paciente` | Marketing | Régua: 1 ano sem vir | {{1}} nome |
| 6 | `aniversario_paciente` | Marketing | Régua: aniversário | {{1}} nome |

## 1. lembrete_consulta (Utilidade)

> Olá, {{1}}! 👋 Lembrando da sua consulta/exame em *{{2}}* às *{{3}}* com {{4}}.
>
> Responda com o número da opção:
> 1️⃣ Confirmar presença
> 2️⃣ Remarcar
> 3️⃣ Cancelar
>
> Se este número não for do paciente, responda *NÚMERO ERRADO*.

Exemplo: Olá, Maria! 👋 Lembrando da sua consulta/exame em *10/11/2026* às *15:00* com Dr. Ademir Magalhães.

## 2. pos_consulta (Utilidade)

> Olá, {{1}}! Como você está depois do seu atendimento de ontem? Se ficou qualquer dúvida sobre as orientações, é só responder por aqui.

## 3. pesquisa_satisfacao (Marketing)

> Olá, {{1}}! De 0 a 10, quanto você recomendaria a nossa clínica a um amigo ou familiar? Leva 10 segundos: {{2}}
>
> Obrigado pela confiança!

## 4. retorno_consulta (Marketing)

> Olá, {{1}}! Já faz 6 meses do seu último atendimento. Que tal agendar seu retorno? Responda esta mensagem que a gente marca para você.

## 5. reativacao_paciente (Marketing)

> Olá, {{1}}! Sentimos sua falta por aqui. Já faz um tempo desde o seu último atendimento. Quer agendar um horário? É só responder esta mensagem.

## 6. aniversario_paciente (Marketing)

> Feliz aniversário, {{1}}! 🎉 A equipe deseja um novo ano com muita saúde e alegria. Conte sempre com a gente!

## Observações

- Utilidade ≈ R$ 0,035 por mensagem; Marketing ≈ R$ 0,32. Marketing só sai para quem deu consentimento.
- Marketing precisa do rodapé do responsável técnico (CFM) — já é exigido pelo sistema nas campanhas.
- O link da ficha prévia ainda não vai no lembrete oficial: precisa de um 5º campo e de ajuste no código (fica para depois do lembrete aprovado).
