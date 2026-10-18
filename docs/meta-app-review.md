# Meta App Review — WhatsApp Cloud API (app "Conecta Saúde", ID 1854106501874471)

Permissões a reenviar: `whatsapp_business_messaging` e `whatsapp_business_management`.
Motivo da rejeição: o screencast não mostrou o fluxo completo (seleção do ativo, envio ao
vivo e a mensagem chegando no WhatsApp; criação/gestão de modelo e envio com modelo).

Telas usadas (todas no painel Admin, só equipe TIVDC) — abra sempre com `?lang=en`:

| Tela | URL |
|---|---|
| Connect WhatsApp (Embedded Signup) | `https://www.conectasaudevc.com.br/admin/whatsapp?lang=en` |
| Send message | `https://www.conectasaudevc.com.br/admin/whatsapp/enviar?lang=en` |
| Message templates | `https://www.conectasaudevc.com.br/admin/whatsapp/templates?lang=en` |

Cada ação tem um texto de ajuda em inglês visível na própria tela (abaixo do botão).

---

## Antes de gravar

1. Chip novo, **sem WhatsApp instalado**, num celular à mão (vai receber o código por SMS ou ligação).
2. Um segundo celular com WhatsApp (o "native client") — é nele que as mensagens chegam na gravação. Pode ser o seu número pessoal.
3. No navegador: Facebook logado com o usuário admin do portfólio TIVDC; idioma do Facebook em **English (US)** (Settings › Language) para o popup da Meta sair em inglês.
4. Gravação de tela com áudio desligado; resolução 1920×1080; mostrar o celular em uma câmera ou espelhar a tela (scrcpy / AirPlay) ao lado do navegador.
5. Variáveis na Vercel conferidas (ver "Configuração" no fim).

Legendas: use o texto da coluna **Caption** como legenda queimada no vídeo (ou anotação no editor).

---

## Vídeo 1 — `whatsapp_business_messaging`

| # | O que fazer | Caption (em inglês) |
|---|---|---|
| 1 | Abrir `/admin/whatsapp?lang=en`. Mostrar o título "WhatsApp — Cloud API". | "Conecta Saúde admin panel — the clinic connects its WhatsApp number to our app." |
| 2 | Escolher a clínica em **Clinic** (o botão só libera depois disso). Em "How is this number used today?", deixar selecionado **New number**. Mostrar o texto de ajuda abaixo de **Connect WhatsApp**. | "The business admin starts Meta's Embedded Signup from our app." |
| 3 | Clicar **Connect WhatsApp**. No popup da Meta: login do Facebook (se pedir), **Continue**, escolher o portfólio **TIVDC**, criar/selecionar a **WhatsApp Business Account**, informar nome de exibição, **adicionar o número do chip novo**, receber e digitar o código, revisar as permissões e clicar **Confirm/Finish**. | "Meta login: the client selects the business portfolio, the WhatsApp Business Account and the phone number, and grants access to Conecta Saúde." |
| 4 | De volta ao painel: o botão mostra "Finishing setup with Meta…", depois aparece o aviso verde fixo e a tela rola até o card com o selo **Just connected**, mostrando **Verified name, Phone number, WABA ID e Phone number ID**. Deixar parado uns 3 s nesse card. Clicar em **Send a message →** no aviso. | "Asset connected: WhatsApp Business Account and phone number now visible in our app." |
| 5 | No celular de teste (native client), mandar um "Hi" **para o número do chip** (abre a janela de 24 h para texto livre). | "The customer messages the business first (opens the 24-hour window)." |
| 6 | Aba **Send message**. Mostrar o bloco "Sending business account and phone number" com **WABA** e **número** selecionados. | "Asset selection: the sending WABA and phone number are shown and selectable." |
| 7 | Digitar o número de destino (o do celular de teste), o texto, por exemplo: `Hi Maria, your exam results are ready. Reply here if you have questions.` Passar o mouse em **Send** e clicar. | "Live send from our app UI via the Cloud API (POST /{phone-number-id}/messages)." |
| 8 | Em "Recent messages", o status muda **Sent → Delivered → Read** (atualiza a cada 3 s). | "Delivery status updates in real time through the webhook." |
| 9 | Mostrar o celular de teste: a **mesma mensagem** chegou no WhatsApp, vinda do número da clínica. Abrir a conversa (vira "Read" no painel). | "The same message delivered in the native WhatsApp client." |

**Use case notes (cole no campo da permissão):**

> Conecta Saúde is a patient-communication platform for medical clinics in Brazil. TIVDC is the Tech Provider: each clinic connects its own WhatsApp number to our app through Embedded Signup. We use whatsapp_business_messaging to send and receive messages on behalf of the clinic from our web app — replies to patients who contacted the clinic, appointment reminders and confirmations using approved templates — and to receive delivery/read status through webhooks so the front desk knows each message reached the patient. The screencast shows: (1) the clinic admin granting access through Meta login and selecting the WhatsApp Business Account and phone number, with the selected WABA and number visible in our UI; (2) a live message sent from our app's "Send message" screen; and (3) the same message delivered in the native WhatsApp client, with the status updating to delivered/read in our app.

---

## Vídeo 2 — `whatsapp_business_management`

(Pode ser o mesmo vídeo, logo em seguida. Se gravar separado, repita as cenas 1–4 rapidamente para mostrar o login.)

| # | O que fazer | Caption (em inglês) |
|---|---|---|
| 1 | Aba **Message templates** (`?lang=en`). Mostrar o seletor com a clínica e o **WABA ID**. | "Template management for the connected WhatsApp Business Account." |
| 2 | Passar o mouse em **Refresh status** e clicar: a tabela mostra **Name, Category, Language, Status** (APPROVED / PENDING / REJECTED). | "Templates listed from the WABA (GET /{waba-id}/message_templates)." |
| 3 | Em **Create template**: name `appointment_reminder`, category **UTILITY**, language **en_US**, body `Hello {{1}}, this is a reminder of your appointment on {{2}}. Reply here if you need to reschedule.`, examples "Maria" e "Oct 20 at 2:00 PM". Clicar **Create template** → toast "Template submitted for Meta review". | "Creating a template in our app (POST /{waba-id}/message_templates)." |
| 4 | Clicar **Refresh status**: o modelo aparece **PENDING**. Clicar **Open in WhatsApp Manager**: mostrar o mesmo modelo no WhatsApp Manager da Meta. | "The template is reviewed by Meta and can also be managed in WhatsApp Manager." |
| 5 | Quando estiver **APPROVED** (UTILITY costuma levar de minutos a poucas horas — pode cortar o vídeo aqui e continuar depois), clicar **Refresh status** e mostrar **APPROVED**. | "Template approved — status shown in our interface." |
| 6 | Na linha do modelo aprovado, clicar **Send this template**: preencher o destinatário (número de teste) e as variáveis `{{1}}` e `{{2}}`; a prévia mostra o texto final. Clicar **Send**. | "Sending a message with the approved template, filling its variables, to a test number." |
| 7 | Status muda para **Sent → Delivered** e o celular de teste mostra a mensagem do modelo. | "Template message delivered in the native WhatsApp client." |

**Use case notes:**

> Clinics using Conecta Saúde need to message patients outside the 24-hour window — appointment reminders (D-1), confirmations and reschedule notices — which requires message templates. We use whatsapp_business_management to list the templates of each clinic's WhatsApp Business Account with their category, language and approval status, to create new templates (UTILITY for reminders, MARKETING only with patient opt-in) and submit them for Meta review, and to read the phone numbers of the WABA. The screencast shows: (1) a template being created in our interface; (2) its review status managed in our app (PENDING → APPROVED, with a link to WhatsApp Manager); and (3) a message sent with that approved template, with its variables filled in, to a test number, delivered in the native WhatsApp client.

---

## Chamadas de API (0 registradas hoje)

Depois de conectar o chip, rode **uma vez** (registra uso das duas permissões):

```bash
npx tsx scripts/meta-api-smoke-test.ts 5577999998888
```

Ele usa a última conta conectada (ou `--clinic <id>`) e faz: GET WABA, GET phone_numbers,
GET message_templates e envio do modelo `hello_world` (ou `--template nome --lang pt_BR
--param valor`). Imprime o resultado de cada chamada, nunca o token. O painel do app na Meta
pode levar até 24 h para mostrar as chamadas.

---

## Checklist pré-envio

- [ ] Variáveis na Vercel: `META_APP_SECRET`, `WHATSAPP_CLOUD_VERIFY_TOKEN`, `WHATSAPP_TOKEN_ENCRYPTION_KEY` (nova), `META_APP_ID`, `META_ES_CONFIG_ID`, `META_GRAPH_VERSION`, `NEXT_PUBLIC_META_*`.
- [ ] Webhook do app: URL `https://www.conectasaudevc.com.br/api/webhooks/whatsapp-cloud`, token = `WHATSAPP_CLOUD_VERIFY_TOKEN`, campos inscritos: **messages**, **message_template_status_update** (e, para coexistência, `smb_message_echoes`, `history`, `smb_app_state_sync`, `account_update`).
- [ ] Facebook Login for Business: domínio `www.conectasaudevc.com.br` em Allowed Domains e "Login with JavaScript SDK" = Yes.
- [ ] Chip conectado em `/admin/whatsapp` e o smoke test rodado com sucesso (4 × OK).
- [ ] Vídeo 1 mostra: login da Meta concedendo acesso, WABA e número visíveis, envio ao vivo, a mensagem no WhatsApp do celular.
- [ ] Vídeo 2 mostra: criação do modelo, status (PENDING/APPROVED) no app e/ou WhatsApp Manager, envio com o modelo aprovado chegando no celular.
- [ ] Interface em inglês (`?lang=en`) e captions em inglês em todas as cenas.
- [ ] Notas de uso coladas em cada permissão (textos acima), coerentes com o vídeo.
- [ ] Vídeo com até ~5 min por permissão, sem trechos cortados entre clicar e o resultado.
