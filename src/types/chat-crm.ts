export type Department = 'recepcao' | 'agendamento' | 'financeiro';

export type InboxFilter = 'minhas' | 'nao_atribuidas' | 'todas' | 'finalizadas';

export type Channel = 'whatsapp' | 'instagram' | 'webchat';

export type FunnelStage = 'novos' | 'triagem' | 'orcamento' | 'agendado';

export interface ConsultationRecord {
  id: string;
  specialty: string;
  doctor: string;
  date: string;
  status: 'concluida' | 'cancelada' | 'agendada';
  price?: string;
}

export interface Message {
  id: string;
  sender: 'contact' | 'agent' | 'system';
  senderName?: string;
  text?: string;
  timestamp: string;
  type: 'text' | 'audio' | 'internal_note' | 'attachment';
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
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  cpf: string;
  neighborhood: string;
  avatar?: string;
  responsibleAgent: string;
  department: Department;
  channel: Channel;
  /** Só preenchido na visão do Admin (que enxerga conversas de todas as clínicas) */
  clinicId?: string;
  clinicName?: string;
  unreadCount: number;
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
}

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: string;
}
