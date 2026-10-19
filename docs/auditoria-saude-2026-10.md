# Auditoria com foco em saúde — o que está faltando (19/10/2026)

Feita lendo o código (sem consultar o banco nem testar nas telas). Ordem = prioridade.

## 🔴 Alto — corrigir primeiro

### 1. Cadastro do paciente compartilhado entre clínicas (LGPD)
- `Contact` é único por telefone para TODAS as clínicas (`prisma/schema.prisma:504`): CPF, RG, nascimento, endereço, carteirinha, convênio e **observações** ("atravessa qualquer clínica").
- Clínica A vê e edita o que a clínica B cadastrou sobre o mesmo paciente. Dado de saúde é sensível e cada clínica é controladora própria.
- **Fazer:** dados cadastrais e observações por clínica (telefone continua como chave); migração aditiva copiando os dados atuais para a clínica de cada conversa.

### 2. Alerta de urgência detectado mas invisível
- "dor forte, sangramento, falta de ar, desmaio, emergência" é detectado em todas as clínicas (`webhooks/whatsapp/route.ts:752`), mas o destaque na fila está comentado (`chat-crm-adapters.ts:136`).
- A IA só diz "vou te transferir"; fora do horário ninguém vê e o paciente não é orientado.
- **Fazer:** religar destaque só para sintoma grave (não para "urgente"); resposta automática fixa "Em caso de emergência ligue 192 (SAMU) ou procure o pronto-socorro"; aviso para a equipe.

### 3. Sem controle de acesso dentro da clínica
- Todo usuário da clínica vê tudo: ficha completa, relatórios, configurações, disparos. Não há papéis (recepção × gestão × médico).
- **Fazer:** papéis mínimos — Recepção (chat, agenda, pacientes), Gestão (+ relatórios, disparos, configurações). `isAttendant` já existe; falta `isManager`/permissões.

### 4. Sem registro de quem acessou dados do paciente
- Não existe log de acesso à ficha/conversas (LGPD pede rastreabilidade para dado sensível).
- **Fazer:** tabela `AccessLog` (usuário, paciente, ação, data) gravada ao abrir ficha, exportar CSV e editar cadastro; tela simples no admin.

## 🟠 Médio

### 5. Mensagem com dado de saúde pode ir para outra pessoa
- Fallback do 9º dígito grava o número trocado como correto (`src/lib/whatsapp.ts:240`); ele pode ser o WhatsApp de outra pessoa → lembrete com nome/médico/procedimento para estranho.
- **Fazer:** em lembretes/disparos, não gravar o número trocado automaticamente; marcar o contato "telefone a confirmar" para a recepção.

### 6. Sessão longa e login sem proteção
- Sessão JWT com validade padrão (30 dias) em computadores de recepção compartilhados; sem limite de tentativas de senha; sem 2FA.
- **Fazer:** sessão de 12 h (turno) + sair por inatividade; limite de tentativas no login; 2FA opcional para gestão/admin.

### 7. Mensagens dos pacientes guardadas para sempre nos logs técnicos
- `webhookLog` guarda o payload completo (texto das mensagens) sem prazo.
- **Fazer:** cron diário apagando/anonimizando logs > 60 dias.

### 8. Exclusão de dados só por e-mail
- Página pública pede e-mail; não há ação no sistema para cumprir.
- **Fazer:** botão no admin "Anonimizar paciente" (apaga mensagens, mantém só contagens), com registro do pedido.

### 9. Ações automáticas sobre agendamento
- Jev cancela/confirma com confiança ≥ 0,85 sem revisão humana. Erro aqui = paciente perde consulta.
- **Fazer:** cancelamento pela IA sempre vai para a recepção confirmar (confirmação pode continuar automática); relatório semanal das decisões do Jev para conferência.

## 🟡 Baixo / processo

10. **Menores de idade:** sem campo de responsável legal; lembrete vai para o número do próprio paciente. Adicionar "responsável" opcional.
11. **Consentimento:** existe para a IA; falta registrar consentimento/opt-in para marketing (campanhas) com data — obrigatório antes de voltar disparos frios, e exigido pela Meta na API oficial.
12. **Publicidade médica (CFM):** campanhas precisam identificar responsável técnico (nome + CRM) e não prometer resultado. Adicionar campo "responsável técnico" na clínica e rodapé automático nas campanhas.
13. **Backups:** confirmar política do Supabase (PITR) e testar restauração periodicamente — já houve perda em 27/09.
14. **Documentos:** política de privacidade e termos citam o tratamento de dados de saúde? Revisar com advogado; ter contrato de operador (DPA) com cada clínica.

## ✅ Já está bom
- IA proibida de diagnosticar/interpretar exame/prescrever; pede consentimento.
- Sintoma grave tira a conversa da IA na hora.
- Opt-out de disparos respeitado.
- Token da API oficial criptografado; webhooks com verificação.
- Intervalo de 4–6 min e desistência após 2 falhas nos envios automáticos.

## Sugestão de ordem
1. Item 2 (urgência + 192) — rápido, segurança do paciente.
2. Item 5 (número trocado) — rápido.
3. Itens 6 e 7 (sessão, login, retenção) — rápidos.
4. Item 9 (cancelamento pela IA com revisão).
5. Itens 1, 3, 4 (separação por clínica, papéis, log de acesso) — maiores, mudam o banco.
6. Itens 8, 10–14.
