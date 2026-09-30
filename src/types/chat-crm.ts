import type { InvoiceData } from "@/lib/chat-messages";
import type { SlaInfo } from "@/lib/sla-calculator";

export type Department = 'recepcao' | 'agendamento' | 'financeiro';

export type InboxFilter = 'minhas' | 'nao_atribuidas' | 'todas' | 'pendentes' | 'finalizadas' | 'arquivadas';

export type Channel = 'whatsapp' | 'instagram' | 'webchat';

export type FunnelStage = 'novos' | 'triagem' | 'orcamento' | 'agendado';

/** Estado único da conversa pra fila do inbox — calculado na hora (ver computeQueueState
 * em chat-crm-adapters.ts), nunca persistido. Prioridade decrescente na fila: urgência >
 * sem dono > resto (humano/IA/aguardando paciente mantêm ordem cronológica entre si). */
export type ConversationQueueState =
  | "URGENCIA_CLINICA"
  | "REMARCACAO_PENDENTE"
  | "SEM_DONO"
  | "HUMANO_ATENDENDO"
  | "IA_ATENDENDO"
  | "AGUARDANDO_PACIENTE";

export interface ConsultationRecord {
  id: string;
  specialty: string;
  doctor: string;
  date: string;
  status: 'confirmada' | 'concluida' | 'cancelada' | 'no_show' | 'agendada';
  price?: string;
  /** Preparo de exame já cadastrado pra esse procedimento (ver Procedure.preparationInstructions)
   * — mesmo texto que já é enviado por WhatsApp na confirmação/lembrete. */
  preparationInstructions?: string;
  /** true = data igual ou depois de hoje e ainda "agendada" — usado pra separar "Próximos
   * Agendamentos" de "Histórico" na tela (pedido original: as duas coisas são listas
   * distintas, não uma única lista ordenada por data mais recente). */
  isUpcoming?: boolean;
}

export interface Message {
  id: string;
  sender: 'contact' | 'agent' | 'system';
  senderName?: string;
  text?: string;
  timestamp: string;
  /** Data real (ISO) — `timestamp` é só o texto formatado. Usado pro aviso da janela de 24h do Instagram. */
  sentAt?: string;
  type: 'text' | 'audio' | 'internal_note' | 'attachment' | 'contact';
  audioDuration?: string;
  audioWaveform?: number[];
  attachmentName?: string;
  attachmentSize?: string;
  /** URL assinada e temporária do Supabase Storage — gerada a cada leitura, não persiste. */
  mediaUrl?: string;
  mimeType?: string;
  isRead?: boolean;
  /** Status real de entrega no WhatsApp (só relevante pra mensagens enviadas pelo agente). */
  deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  /** true quando o WhatsApp avisou que essa mensagem foi apagada (evento messages.delete). */
  deleted?: boolean;
  /** true pro aviso automático de mídia recebida que não foi possível baixar — vira um badge discreto em vez de bolha de texto normal. */
  mediaDownloadFailed?: boolean;
  /** true pra mensagem automática do sistema (ex: confirmação de agendamento) — vira um aviso compacto em vez de bolha de texto normal. */
  isSystemNotice?: boolean;
  /** true quando o atendente editou o texto depois de enviado — mostra o selo "editada". */
  isEdited?: boolean;
  /** true quando ainda dá pra editar essa mensagem (ver canEditMessage em message-edit.ts). */
  canEdit?: boolean;
  /** Texto transcrito do áudio (ver botão "Transcrever" em message-bubble.tsx) — undefined até a atendente pedir. */
  transcription?: string;
  /** Dados de nota fiscal extraídos sob demanda (ver botão "Extrair dados" em message-bubble.tsx) — undefined até a atendente pedir. */
  extractedInvoiceData?: InvoiceData;
  /** Mensagem que esta responde/cita (botão "Responder", ou citação feita direto no
   * WhatsApp) — undefined quando não é uma resposta, ou quando a citada nunca existiu
   * no nosso banco. */
  quotedMessage?: {
    id: string;
    text?: string;
    sender: 'contact' | 'agent' | 'system';
    senderName?: string;
    deleted?: boolean;
  };
  /** Emoji com que o paciente reagiu via WhatsApp — undefined quando não reagiu. */
  contactReaction?: string;
  /** Emoji com que o atendente reagiu (sincroniza pro WhatsApp) — undefined quando não reagiu. */
  agentReaction?: string;
  /** Marcação pessoal do atendente pra achar mensagens depois — só interno, nunca sincroniza. */
  starred?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  cpf: string;
  /** Texto livre, sem cadastro/FK — mesmo padrão do doctorName em Appointment.
   * Editável na aba "Resumo" da ficha do paciente (ver patient-record-sheet.tsx). */
  convenio?: string;
  preferredDoctor?: string;
  /** Todos texto livre, sem validação de formato — cadastro rápido pela recepção.
   * Editáveis na aba "Resumo Cadastral" da ficha do paciente. */
  rg?: string;
  /** ISO date (yyyy-mm-dd) — Contact.birthDate é @db.Date, sem hora/fuso envolvido. */
  birthDate?: string;
  address?: string;
  insuranceCardNumber?: string;
  /** Observação permanente de texto livre sobre o paciente (ex: "idoso, precisa de
   * ajuda pra locomoção") — por PACIENTE, atravessa qualquer conversa/clínica.
   * Diferente de `tags` (rótulos curtos, por atendimento). */
  notes?: string;
  neighborhood: string;
  /** Entidade (empresa cliente) do GLPI vinculada a este contato — só relevante pro
   * TIVDC, que usa isso pra abrir chamado na empresa certa (ver Contact.glpiEntityId). */
  glpiEntityId?: number | null;
  queueState: ConversationQueueState;
  avatar?: string;
  responsibleAgent: string;
  department: Department;
  channel: Channel;
  /** Só preenchido na visão do Admin (que enxerga conversas de todas as clínicas) */
  clinicId?: string;
  clinicName?: string;
  unreadCount: number;
  /** true quando a conversa foi transferida/atribuída a mim (por outro atendente ou
   * por um admin) e eu ainda não abri pra ver — vira selo na lista, some ao abrir. */
  hasUnseenAssignment: boolean;
  /** Conversa tem dono e não sou eu — mostra o banner "Esta conversa está com X" +
   * botão "Assumir Conversa" no header do chat (ver inbox-layout.tsx). */
  assignedToOther: boolean;
  /** Tempo de espera útil (dentro do expediente da clínica) desde a última mensagem do
   * paciente ainda sem resposta — sla.shouldDisplay é false quando já foi respondida
   * ou a conversa está finalizada (ver <SLABadge>). Calculado a partir da mensagem
   * mais recente já buscada em listConversations, sem query extra (ver toChatContact
   * e src/lib/sla-calculator.ts). */
  sla: SlaInfo;
  lastMessage: string;
  lastMessageTime: string;
  statusTag: {
    label: string;
    variant: 'emerald' | 'amber' | 'blue' | 'purple' | 'slate';
  };
  funnelStage: FunnelStage;
  tags: string[];
  consultationHistory: ConsultationRecord[];
  estimatedValue?: string;
  /** Canal de aquisição detectado na 1ª mensagem (ver src/lib/acquisition.ts) — ausente
   * em conversa anterior ao rastreamento ou aberta por lembrete/disparo nosso. */
  /** @username do lead de Instagram Direct — substitui o telefone no cabeçalho. */
  instagramUsername?: string;
  acquisitionChannel?: string;
  acquisitionDetail?: string;
  /** Fixada no topo da fila (menu do card) — ver QUEUE_STATE_PRIORITY em inbox-layout.tsx. */
  pinned: boolean;
  /** Notificação de mensagem nova suprimida (som/desktop) — não esconde unreadCount. */
  isMuted: boolean;
  /** Fora da fila ativa (aba "Arquivadas" só) — desarquiva sozinha quando chega mensagem nova. */
  isArchived: boolean;
}

/** Campos que <PatientRecordSheet> de fato usa — deixa o componente utilizável tanto
 * pelo Contact "rico" do Inbox (queueState, tags de fila, etc.) quanto por um objeto
 * mais enxuto montado em /clinic/contatos (ver contacts-app.tsx), sem precisar forjar
 * os outros 20+ campos do Contact completo que não fazem sentido fora de uma conversa
 * ativa. Mesma ideia do Pick já usado em ScheduleModalProps.contact. */
export type PatientRecordData = Pick<
  Contact,
  | "id"
  | "name"
  | "phone"
  | "cpf"
  | "convenio"
  | "preferredDoctor"
  | "rg"
  | "birthDate"
  | "address"
  | "insuranceCardNumber"
  | "notes"
  | "tags"
  | "consultationHistory"
>;

/** Payload de onUpdatePatient/updateContactInfo — mesmos campos editáveis da aba
 * "Resumo Cadastral" da ficha do paciente. Campo ausente (undefined) = não mexe nesse
 * campo nesse submit; string vazia = limpa. Um tipo só, reusado nos 3 pontos que
 * repassam isso (chat-crm-app.tsx, inbox-layout.tsx, patient-record-sheet.tsx). */
export interface UpdatePatientData {
  name: string;
  cpf?: string;
  phone?: string;
  convenio?: string;
  preferredDoctor?: string;
  rg?: string;
  birthDate?: string;
  address?: string;
  insuranceCardNumber?: string;
  notes?: string;
}

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: string;
}
