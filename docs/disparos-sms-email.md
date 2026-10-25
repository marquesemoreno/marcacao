# Disparos por SMS e e-mail

Implementado em 25/10/2026. Provedores: **Comtele** (SMS) e **Resend** (e-mail).
Destinatários vêm de CSV (coluna `telefone` ou `email`). Consentimento **por canal**.

## Como funciona
- Painel "Disparos por SMS e e-mail" no fim de `/clinic/disparos`: (1) gestão registra os
  aceites de cada canal, com a origem; (2) cria o rascunho da campanha. O início passa pela
  mesma confirmação das campanhas de WhatsApp (que mostra a mensagem como sairá e quantos têm aceite).
- Só envia a quem tem `ChannelConsent` ativo da clínica e do canal. Os demais viram
  "Sem consentimento para este canal"; quem usou o link de sair vira "Pediu para não receber".
- Todo envio leva o responsável técnico (CFM) e um link `/api/u/<token>` para sair. O e-mail
  também leva `List-Unsubscribe` de um clique. O GET do link só confirma; o POST grava a saída.
- Despacho: o mesmo cron do WhatsApp (`/api/cron/broadcast-dispatch`) chama
  `dispatchNextChannelBatch` — seg–sex 9h–17h, `CHANNEL_BATCH_SIZE` por minuto. Sem o intervalo
  de 4–6 min do WhatsApp (que existe por risco de bloqueio de número). SMS/e-mail não entram nas
  contas de ritmo do WhatsApp (todas as consultas de pacing filtram `channel: "WHATSAPP"`).
- Em SMS/e-mail, `BroadcastRecipient.phone` guarda o **endereço** (número 55DDD9… ou e-mail).

## Para colocar no ar (ordem importa)
1. **Aplicar a migration `20261025140000_broadcast_channels` em produção ANTES do deploy do
   código.** Ela é só aditiva (enum, 2 colunas com default, 1 tabela). Se o código subir antes,
   toda leitura de campanhas quebra (o Prisma seleciona as colunas novas). Só `migrate deploy`;
   nunca `--shadow-database-url` contra produção.
2. Criar as variáveis no Vercel: `UNSUBSCRIBE_SECRET`, `RESEND_API_KEY`, `BROADCAST_EMAIL_FROM`,
   `COMTELE_API_KEY`, `COMTELE_ROUTE` (e opcional `CHANNEL_BATCH_SIZE`).
3. Resend: verificar o domínio de envio (SPF/DKIM) antes de usar um remetente do domínio.
4. Deploy do código.

## Ainda não validado (precisa de chave real)
- **Comtele:** a documentação pública é contraditória (tipo de `receivers`, significado de
  `route`, corpo de erro) e a resposta não traz id da mensagem. O adaptador segue o exemplo da
  documentação, mas **nunca foi chamado de verdade**. Testar com 1 número antes de qualquer campanha.
- **Resend:** idem, não chamado de verdade (formato conferido na documentação).
- A tela não foi aberta no navegador (precisa de login e banco).
- Despachante e ações testados com banco simulado, não com banco real.

## Limites a conhecer
- SMS: com RT + link de sair (~85 caracteres), sobra pouco dos 160; a maioria das mensagens
  consome 2 créditos. Um domínio curto para o link reduziria isso.
- Faltam: pedido de descadastro por resposta ao SMS, remetente por clínica no e-mail (hoje é um
  único `BROADCAST_EMAIL_FROM`), relatório de entrega (a Comtele e o Resend têm webhooks de status).
