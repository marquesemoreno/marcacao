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
  isRead?: boolean;
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
