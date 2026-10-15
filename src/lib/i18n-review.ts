/** Dicionário pt/en das telas da API oficial do WhatsApp (Connect, Send, Templates) — a
 * análise do app pela Meta pede a interface em inglês na gravação. Ativado por ?lang=en
 * (ou pelo seletor PT/EN no topo das telas). Puro: roda no servidor e no cliente. */

export type Lang = "pt" | "en";

export function langFrom(value: string | string[] | undefined | null): Lang {
  return (Array.isArray(value) ? value[0] : value) === "en" ? "en" : "pt";
}

const DICT = {
  "tabs.connect": ["Conectar", "Connect WhatsApp"],
  "tabs.send": ["Enviar mensagem", "Send message"],
  "tabs.templates": ["Modelos", "Message templates"],

  "connect.title": ["WhatsApp — API oficial", "WhatsApp — Cloud API"],
  "connect.subtitle": [
    "Conecta o número de uma clínica à API oficial da Meta pelo cadastro da Meta (Embedded Signup). A conexão fica desligada no Chat até ser testada.",
    "Connect a clinic's WhatsApp number to the official Cloud API through Meta's Embedded Signup. The connection stays off in the inbox until it is tested.",
  ],
  "connect.section": ["Conectar um número", "Connect a number"],
  "connect.clinic": ["Clínica", "Clinic (tenant)"],
  "connect.chooseClinic": ["Escolha a clínica", "Choose a clinic"],
  "connect.reconnect": ["já conectada — reconectar", "already connected — reconnect"],
  "connect.coexistence": [
    "O número já usa o app WhatsApp Business (coexistência — continua funcionando no celular)",
    "The number already uses the WhatsApp Business app (coexistence — keeps working on the phone)",
  ],
  "connect.coexistenceNote": [
    "A Meta vai pedir para abrir o app WhatsApp Business no celular e escanear um QR code. Nunca pede código por SMS — se pedir, pare.",
    "Meta will ask to open the WhatsApp Business app on the phone and scan a QR code. It never asks for an SMS code — if it does, stop.",
  ],
  "connect.newNumberNote": [
    "Número novo: a Meta envia um código por SMS ou ligação para confirmar o número. Depois o sistema registra o número na Cloud API.",
    "New number: Meta sends a code by SMS or voice call to verify it. The app then registers the number on the Cloud API.",
  ],
  "connect.button": ["Conectar WhatsApp", "Connect WhatsApp"],
  "connect.buttonTip": [
    "Abre o login da Meta: o cliente entra no Facebook, escolhe ou cria a conta do WhatsApp Business e o número, e autoriza o app.",
    "Opens Meta's login: the client signs in to Facebook, picks or creates the WhatsApp Business account and phone number, and grants the app access.",
  ],
  "connect.connecting": ["Conectando…", "Connecting…"],
  "connect.cancelled": ["Cadastro cancelado ou não concluído — nada foi alterado.", "Signup cancelled or not finished — nothing was changed."],
  "connect.sdkError": ["Não foi possível abrir o cadastro da Meta. Recarregue a página e tente de novo.", "Could not open Meta's signup. Reload the page and try again."],
  "connect.chooseFirst": ["Escolha a clínica antes de conectar.", "Choose a clinic before connecting."],
  "connect.connected": ["Conectado", "Connected"],
  "connect.list": ["Números conectados", "Connected numbers"],
  "connect.none": ["Nenhuma clínica conectada à API oficial ainda.", "No clinic connected to the Cloud API yet."],
  "connect.waba": ["Conta (WABA)", "Business account (WABA)"],
  "connect.phoneId": ["ID do número", "Phone number ID"],
  "connect.verifiedName": ["Nome verificado", "Verified name"],
  "connect.activeInbox": ["Ativa no Chat", "Live in inbox"],
  "connect.offInbox": ["Conectada (desligada no Chat)", "Connected (inbox off)"],
  "connect.test": ["Enviar teste (hello_world)", "Send test (hello_world)"],
  "connect.testTip": ["Envia o modelo padrão hello_world da Meta para o número informado.", "Sends Meta's default hello_world template to the number entered."],
  "connect.remove": ["Remover conexão", "Disconnect"],
  "connect.removeConfirm": ["Remover a conexão da API oficial desta clínica? A clínica continua na Evolution.", "Remove this clinic's Cloud API connection? The clinic keeps using its current provider."],

  "send.title": ["Enviar mensagem — API oficial", "Send a message — Cloud API"],
  "send.subtitle": [
    "Escolha a conta e o número que vão enviar, informe o destinatário e envie. O status (enviada, entregue, lida) chega pelo webhook da Meta.",
    "Pick the business account and phone number that will send, enter the recipient and send. Status (sent, delivered, read) arrives through Meta's webhook.",
  ],
  "send.asset": ["Conta e número que envia", "Sending business account and phone number"],
  "send.assetTip": ["A WABA (conta do WhatsApp Business) e o número conectados pelo cadastro da Meta.", "The WhatsApp Business Account (WABA) and phone number connected through Embedded Signup."],
  "send.to": ["Destinatário (DDI + DDD + número)", "Recipient (country code + number)"],
  "send.text": ["Mensagem", "Message"],
  "send.textHint": [
    "Texto livre só chega se o destinatário falou com este número nas últimas 24 h. Fora disso, use um modelo aprovado (aba Modelos).",
    "Free-form text is only delivered if the recipient messaged this number in the last 24 hours. Otherwise use an approved template (Templates tab).",
  ],
  "send.button": ["Enviar", "Send"],
  "send.buttonTip": ["Envia agora pela Cloud API (POST /{phone_number_id}/messages).", "Sends now through the Cloud API (POST /{phone_number_id}/messages)."],
  "send.sent": ["Enviada pela Cloud API.", "Sent through the Cloud API."],
  "send.history": ["Últimos envios", "Recent messages"],
  "send.historyTip": ["Atualiza sozinho a cada 3 segundos com o status vindo do webhook.", "Refreshes every 3 seconds with the status from the webhook."],
  "send.empty": ["Nenhum envio ainda.", "No messages yet."],
  "send.noAccount": ["Nenhuma clínica conectada. Conecte um número na aba Conectar.", "No clinic connected yet. Connect a number in the Connect tab."],

  "status.SENDING": ["Enviando", "Sending"],
  "status.SENT": ["Enviada", "Sent"],
  "status.DELIVERED": ["Entregue", "Delivered"],
  "status.READ": ["Lida", "Read"],
  "status.FAILED": ["Falhou", "Failed"],

  "tpl.title": ["Modelos de mensagem", "Message templates"],
  "tpl.subtitle": [
    "Modelos da conta do WhatsApp Business: criar, acompanhar a aprovação da Meta e enviar um modelo aprovado.",
    "Templates of the WhatsApp Business Account: create, follow Meta's approval and send an approved template.",
  ],
  "tpl.refresh": ["Atualizar status", "Refresh status"],
  "tpl.refreshTip": ["Busca a lista e o status dos modelos na Meta (GET /{waba_id}/message_templates).", "Fetches templates and their status from Meta (GET /{waba_id}/message_templates)."],
  "tpl.manager": ["Abrir no WhatsApp Manager", "Open in WhatsApp Manager"],
  "tpl.managerTip": ["Abre os modelos desta conta no WhatsApp Manager da Meta.", "Opens this account's templates in Meta's WhatsApp Manager."],
  "tpl.name": ["Nome", "Name"],
  "tpl.category": ["Categoria", "Category"],
  "tpl.language": ["Idioma", "Language"],
  "tpl.status": ["Status", "Status"],
  "tpl.body": ["Texto", "Body"],
  "tpl.empty": ["Nenhum modelo nesta conta.", "No templates in this account."],
  "tpl.create": ["Criar modelo", "Create template"],
  "tpl.createTip": ["Envia o modelo para análise da Meta (POST /{waba_id}/message_templates).", "Submits the template for Meta review (POST /{waba_id}/message_templates)."],
  "tpl.bodyHint": ["Use {{1}}, {{2}}… para as variáveis e preencha um exemplo de cada.", "Use {{1}}, {{2}}… for variables and fill one example for each."],
  "tpl.example": ["Exemplo de", "Example for"],
  "tpl.created": ["Modelo enviado para análise da Meta.", "Template submitted for Meta review."],
  "tpl.send": ["Enviar este modelo", "Send this template"],
  "tpl.sendTip": ["Envia o modelo aprovado preenchendo as variáveis.", "Sends the approved template filling in its variables."],
  "tpl.sendOnlyApproved": ["Só modelos aprovados podem ser enviados.", "Only approved templates can be sent."],
  "tpl.variable": ["Variável", "Variable"],

  "common.loading": ["Carregando…", "Loading…"],
  "common.error": ["Erro", "Error"],
} as const;

export type I18nKey = keyof typeof DICT;

export function t(lang: Lang, key: I18nKey): string {
  return DICT[key][lang === "en" ? 1 : 0];
}
