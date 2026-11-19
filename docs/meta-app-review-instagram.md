# Meta App Review — Instagram Direct (app "Conecta Saúde", ID 1854106501874471)

> 19/11/2026. Hoje o Instagram só funciona com contas **testadoras** do app (ex.: @ti.vdc). Para
> pacientes de verdade escreverem para o Instagram de uma clínica, o app precisa de **acesso avançado**
> nas permissões abaixo.

Permissões a pedir (caso de uso **Instagram › API com login do Instagram**):

| Permissão | Para quê |
|---|---|
| `instagram_business_basic` | ler o perfil da conta profissional conectada (nome, @, foto) |
| `instagram_business_manage_messages` | receber e responder as mensagens do Direct no Chat |

## 1. O que já está pronto (conferir, não refazer)

- Verificação da empresa (TIVDC) — feita para o WhatsApp, vale para o app todo.
- Configurações do app › Básico: ícone 1024×1024, categoria, e-mail de contato,
  **Política de privacidade** `https://www.conectasaudevc.com.br/privacidade` e
  **Exclusão de dados** `https://www.conectasaudevc.com.br/exclusao-de-dados`.
- Webhook do Instagram (`/api/webhooks/instagram`) assinando o campo **messages**.
- Teste ponta a ponta com @ti.vdc em 30/10 (receber e responder pelo Chat).

## 2. Botão "Conectar Instagram" (feito 19/11) — falta configurar (você)

A Meta reprova revisão que não mostra o **login do Instagram dentro do nosso app** (mesmo motivo da 1ª
reprovação do WhatsApp). Agora existe **Configurações › Instagram** (`/clinic/instagram`, só gestão):
botão **Conectar Instagram** → login do Instagram → volta com a conta ligada (token de 60 dias, webhook
assinado, renovação automática). `?lang=en` deixa a tela em inglês para a gravação. O cadastro manual do
Admin (botão rosa) continua funcionando.

Para o botão funcionar:

1. Painel da Meta › app Conecta Saúde › **Instagram › API com login do Instagram** › **3. Configurar o
   login comercial do Instagram** → em **URLs de redirecionamento** colar
   `https://www.conectasaudevc.com.br/api/instagram/callback` e salvar.
2. Na mesma tela, copiar o **ID do app do Instagram** (é diferente do ID do app do Facebook).
3. Vercel › Settings › Environment Variables (Production): criar **`INSTAGRAM_APP_ID`** com esse ID.
   `INSTAGRAM_APP_SECRET` já existe. Fazer **Redeploy**.
4. Testar: entrar como gestão da **TIVDC Tecnologia** › Configurações › Instagram › Conectar Instagram com
   a @ti.vdc (que é testadora do app) → deve voltar com "Instagram conectado". Mandar uma DM de teste.

Se der erro, a tela mostra o motivo; o detalhe técnico fica em webhook_logs (evento `instagram.oauth`).

## 3. Pedir o acesso (você faz, no painel da Meta)

1. developers.facebook.com › Meus apps › **Conecta Saúde** › **Revisão do app › Permissões e recursos**.
2. Em `instagram_business_basic` e `instagram_business_manage_messages`: **Solicitar acesso avançado**.
3. Para cada uma: colar o texto de uso (abaixo, em inglês) e enviar o vídeo (seção 4).
4. Fazer pelo menos **1 chamada de teste** de cada permissão nos últimos 30 dias (o teste com @ti.vdc
   conta; se o painel disser que falta, mande e responda uma DM para a @ti.vdc antes de enviar).
5. **Enviar para revisão.** Costuma levar de alguns dias a 2 semanas; a resposta chega no painel e por e-mail.

**Texto de uso (cole no campo de cada permissão):**

> Conecta Saúde is a patient-communication platform for medical clinics in Brazil. Each clinic connects its own
> Instagram professional account through Instagram Business Login inside our web app. We use
> instagram_business_basic to show which account is connected (username and profile picture), and
> instagram_business_manage_messages to receive Direct messages from patients through webhooks and let the
> clinic's front desk reply from our shared inbox, within the 24-hour messaging window. We do not post content,
> read followers or send unsolicited messages. The screencast shows: (1) the clinic manager clicking
> "Connect Instagram" and granting access on Instagram's login screen; (2) the connected account shown in our app;
> (3) a Direct message sent from the native Instagram app arriving in our inbox; and (4) a reply sent from our
> inbox delivered in the native Instagram app.

## 4. Vídeo da revisão (você grava, depois do teste da seção 2)

Abrir a tela com `https://www.conectasaudevc.com.br/clinic/instagram?lang=en`. Antes de gravar, se a
@ti.vdc já estiver conectada, tudo bem: o botão vira "Reconnect" e o fluxo é o mesmo.

Mesmo jeito do vídeo do WhatsApp: tela do navegador + celular espelhado ao lado, sem áudio, legendas em inglês.
Usar a clínica **TIVDC Tecnologia** e a conta **@ti.vdc**; o "paciente" é seu Instagram pessoal.

| # | O que fazer | Legenda (inglês) |
|---|---|---|
| 1 | Entrar no painel da clínica TIVDC e abrir Configurações › Instagram. | "Clinic panel — the manager connects the clinic's Instagram professional account." |
| 2 | Clicar **Conectar Instagram**. Na tela do Instagram: entrar com @ti.vdc, revisar as permissões e **Permitir**. | "Instagram Business Login: the account owner grants instagram_business_basic and instagram_business_manage_messages." |
| 3 | De volta ao painel: card com @ti.vdc, foto e "Conectado". Parar 3 s. | "Connected account shown in our app (instagram_business_basic)." |
| 4 | No celular, com o Instagram pessoal, mandar uma DM para @ti.vdc: "Hi, do you have appointments on Friday?". | "A patient sends a Direct message from the native Instagram app." |
| 5 | No Chat do painel: a conversa aparece com o selo do Instagram. Abrir. | "The message arrives in our shared inbox via webhook." |
| 6 | Responder: "Yes! We have 9:00 and 14:00. Which one works for you?" e enviar. | "The front desk replies from our app (POST /me/messages)." |
| 7 | Mostrar o celular: a resposta chegou no Direct. | "The reply is delivered in the native Instagram app." |

## Depois de aprovado

- Ligar o Instagram das clínicas (Urolaser primeiro) pelo botão — sem token manual.
- Respostas depois de 24 h: hoje o sistema usa a etiqueta de atendimento humano (até 7 dias). Se a Meta
  recusar envios com essa etiqueta, pedir também o recurso **Human Agent** na revisão.
