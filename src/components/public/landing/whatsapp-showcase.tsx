import {
  QrCode,
  Signal,
  Wifi,
  Battery,
  ChevronLeft,
  Video,
  Phone,
  CheckCheck,
  Zap,
  Smartphone,
  ShieldCheck,
  ExternalLink,
  MessageCircle,
  Clock,
  Sparkles,
  Paperclip,
  Smile,
  Mic,
  Camera
} from "lucide-react";

export function WhatsAppShowcase() {
  return (
    <section id="whatsapp-demo" className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 py-20 lg:py-28">
      {/* Decorative subtle background elements */}
      <div className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-teal-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          
          {/* Left Column: Copy & Value Proposition */}
          <div className="flex flex-col gap-6 lg:col-span-6 xl:col-span-7">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/80 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm backdrop-blur-sm">
                <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                Experiência 100% no WhatsApp
              </div>

              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-4xl">
                Tudo direto no seu WhatsApp,{" "}
                <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 bg-clip-text text-transparent">
                  sem baixar nenhum aplicativo
                </span>
              </h2>

              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                Esqueça filas, senhas perdidas ou apps pesados. Você escolhe sua consulta ou exame no site e nossa inteligência médica envia a confirmação, preparo de exames e a guia com QR Code direto na conversa.
              </p>
            </div>

            {/* Feature List */}
            <div className="flex flex-col gap-3.5">
              <div className="group flex items-start gap-3.5 rounded-2xl border border-slate-200/70 bg-white/90 p-3.5 shadow-sm transition-all hover:border-teal-200 hover:shadow-md">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Confirmação e Lembretes Automáticos</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Notificações em tempo real com data, horário exato, endereço da clínica e botão para confirmação rápida de presença.
                  </p>
                </div>
              </div>

              <div className="group flex items-start gap-3.5 rounded-2xl border border-slate-200/70 bg-white/90 p-3.5 shadow-sm transition-all hover:border-teal-200 hover:shadow-md">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-600 text-white shadow-sm">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Orientações Claras de Preparo</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Instruções completas para exames que exigem jejum, bexiga cheia ou suspensão temporária de medicamentos.
                  </p>
                </div>
              </div>

              <div className="group flex items-start gap-3.5 rounded-2xl border border-slate-200/70 bg-white/90 p-3.5 shadow-sm transition-all hover:border-teal-200 hover:shadow-md">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
                  <QrCode className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Guia de Encaminhamento com QR Code</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Apresente a guia digital diretamente na recepção da clínica para validar seu atendimento e garantir o preço reduzido.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick trust metrics */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Dados protegidos pela LGPD</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-sky-600" />
                <span>Atendimento 24 horas por dia</span>
              </div>
            </div>
          </div>

          {/* Right Column: Realistic Smartphone Mockup & Floating Badges */}
          <div className="relative flex justify-center lg:col-span-6 xl:col-span-5">
            
            {/* Floating Badge 1: Confirmação instantânea */}
            <div className="absolute -top-3 -left-4 z-20 hidden sm:flex items-center gap-2 rounded-2xl border border-emerald-100 bg-white/95 px-3.5 py-2 shadow-lg shadow-emerald-500/10 backdrop-blur-md transition-transform hover:scale-105">
              <span className="flex size-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <Zap className="h-4 w-4" />
              </span>
              <div className="text-left">
                <p className="text-[11px] font-bold text-slate-900 leading-tight">Confirmação instantânea</p>
                <p className="text-[10px] text-slate-500">Em menos de 10 segundos</p>
              </div>
            </div>

            {/* Floating Badge 2: 100% no seu WhatsApp */}
            <div className="absolute top-1/2 -right-6 z-20 hidden sm:flex items-center gap-2.5 rounded-2xl border border-teal-100 bg-white/95 px-3.5 py-2.5 shadow-lg shadow-teal-500/10 backdrop-blur-md transition-transform hover:scale-105">
              <span className="flex size-7 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
                <Smartphone className="h-4 w-4" />
              </span>
              <div className="text-left">
                <p className="text-[11px] font-bold text-slate-900 leading-tight">100% no seu WhatsApp</p>
                <p className="text-[10px] text-slate-500">Sem download de apps</p>
              </div>
            </div>

            {/* Floating Badge 3: Dados protegidos */}
            <div className="absolute -bottom-4 left-2 z-20 hidden sm:flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2 shadow-lg shadow-slate-900/5 backdrop-blur-md transition-transform hover:scale-105">
              <span className="flex size-7 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </span>
              <div className="text-left">
                <p className="text-[11px] font-bold text-slate-900 leading-tight">Segurança Total LGPD</p>
                <p className="text-[10px] text-slate-500">Criptografia de ponta</p>
              </div>
            </div>

            {/* Smartphone Case Frame */}
            <div className="relative w-[320px] sm:w-[340px] rounded-[44px] p-3 bg-slate-900 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)] ring-1 ring-slate-800">
              {/* Speaker / Dynamic Island pill */}
              <div className="absolute left-1/2 top-4.5 z-30 h-4 w-24 -translate-x-1/2 rounded-full bg-black flex items-center justify-end pr-2">
                <span className="size-2 rounded-full bg-slate-800" />
              </div>

              {/* Phone Screen */}
              <div className="relative flex h-[580px] flex-col overflow-hidden rounded-[36px] bg-[#EFEAE2]">
                
                {/* Status Bar */}
                <div className="flex items-center justify-between bg-[#075E54] px-5 pt-3 pb-1 text-white">
                  <span className="text-[11px] font-semibold tracking-tight">09:41</span>
                  <div className="flex items-center gap-1.5">
                    <Signal className="h-3 w-3 text-white/90" />
                    <Wifi className="h-3 w-3 text-white/90" />
                    <Battery className="h-3.5 w-3.5 text-white/90" />
                  </div>
                </div>

                {/* WhatsApp Chat Header */}
                <div className="flex items-center justify-between bg-[#075E54] px-3 py-2.5 text-white shadow-md">
                  <div className="flex items-center gap-2">
                    <ChevronLeft className="h-5 w-5 text-white/90 cursor-pointer" />
                    <div className="relative">
                      <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white font-black text-xs ring-2 ring-white/30">
                        CS
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-white ring-1 ring-white">
                        <span className="size-2 rounded-full bg-emerald-500" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-xs font-bold text-white">Conecta Saúde</p>
                        <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-400 text-[9px] font-bold text-[#075E54]">
                          ✓
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-100/90 font-medium">Conta Comercial Oficial • Online</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-white/90">
                    <Video className="h-4 w-4 cursor-pointer hover:text-white" />
                    <Phone className="h-3.5 w-3.5 cursor-pointer hover:text-white" />
                  </div>
                </div>

                {/* WhatsApp Chat Message Area with custom pattern */}
                <div 
                  className="flex-1 overflow-y-auto px-3 py-3.5 flex flex-col gap-2.5 text-[12px] leading-relaxed"
                  style={{
                    backgroundImage: `radial-gradient(#cbd5e1 0.75px, transparent 0.75px)`,
                    backgroundSize: '12px 12px'
                  }}
                >
                  {/* Encryption Notice */}
                  <div className="mx-auto my-1 max-w-[85%] rounded-lg bg-[#FFEECD]/90 px-3 py-1.5 text-center text-[10px] text-amber-900 shadow-sm">
                    🔒 As mensagens e chamadas são protegidas com a criptografia de ponta a ponta.
                  </div>

                  {/* Day Divider */}
                  <div className="mx-auto my-0.5 rounded-full bg-white/80 px-2.5 py-0.5 text-[10px] font-medium text-slate-500 shadow-xs">
                    Hoje
                  </div>

                  {/* Balloon 1: Recebido - Agendamento */}
                  <div className="relative max-w-[88%] self-start rounded-2xl rounded-tl-none bg-white p-3 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
                    <p className="text-[11.5px] leading-relaxed">
                      Olá, Lucas! 👋 Seu agendamento para <strong className="text-slate-900 font-bold">Consulta com Clínico Geral</strong> na <strong className="text-teal-700 font-bold">Clínica Cirúrgica Santa Clara</strong> foi confirmado para amanhã às <strong className="text-slate-900 font-bold">14:00</strong>.
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-slate-400">
                      <span>14:00</span>
                    </div>
                  </div>

                  {/* Balloon 2: Recebido - Orientações */}
                  <div className="relative max-w-[88%] self-start rounded-2xl rounded-tl-none bg-white p-3 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
                    <p className="font-semibold text-slate-900 text-[11.5px] mb-1">
                      📋 Orientações para a Consulta:
                    </p>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      • Comparecer com 20 min de antecedência<br />
                      • Trazer documento oficial com foto<br />
                      • Endereço: Praça Hercílio Lima, Centro
                    </p>
                    <div className="mt-2 rounded-xl bg-slate-50 p-2 border border-slate-100">
                      <p className="text-[10.5px] font-semibold text-slate-700">Responda para confirmar:</p>
                      <p className="text-[10.5px] text-slate-600 mt-0.5">
                        <strong className="text-emerald-700">1</strong> - Confirmar presença<br />
                        <strong className="text-rose-700">2</strong> - Cancelar ou reagendar
                      </p>
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-slate-400">
                      <span>14:00</span>
                    </div>
                  </div>

                  {/* Balloon 3: Enviado pelo Paciente */}
                  <div className="relative max-w-[40%] self-end rounded-2xl rounded-tr-none bg-[#DCF8C6] p-2.5 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
                    <p className="text-[13px] font-bold text-slate-900 px-1">1</p>
                    <div className="mt-0.5 flex items-center justify-end gap-1 text-[9px] text-emerald-800">
                      <span>14:01</span>
                      <CheckCheck className="h-3.5 w-3.5 text-sky-600" />
                    </div>
                  </div>

                  {/* Balloon 4: Guia Oficial com QR Code anexada */}
                  <div className="relative max-w-[92%] self-start rounded-2xl rounded-tl-none bg-white p-3 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)] border border-emerald-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                      <span>🎟️</span>
                      <span>Guia Oficial de Encaminhamento</span>
                    </div>
                    
                    <div className="mt-2 rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm border border-slate-200">
                          <QrCode className="h-10 w-10 text-slate-800" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-slate-900">#VDC-2026-84920</p>
                          <p className="text-[9.5px] text-slate-600 truncate">Paciente: Lucas S.</p>
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                            ✓ Confirmado
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[9.5px] font-bold text-teal-700">Valor com desconto: R$ 140</span>
                        <span className="flex items-center gap-1 text-[9.5px] font-bold text-sky-600">
                          Ver Guia <ExternalLink className="h-2.5 w-2.5" />
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 flex items-center justify-end gap-1 text-[9px] text-slate-400">
                      <span>14:01</span>
                    </div>
                  </div>

                </div>

                {/* WhatsApp Chat Footer Input Bar */}
                <div className="flex items-center gap-1.5 bg-[#F0F2F5] px-2 py-2 border-t border-slate-200/60">
                  <Smile className="h-5 w-5 text-slate-500 cursor-pointer hover:text-slate-700 ml-1" />
                  <Paperclip className="h-4 w-4 text-slate-500 cursor-pointer hover:text-slate-700" />
                  <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-[11px] text-slate-400 shadow-inner">
                    Digite uma mensagem...
                  </div>
                  <Camera className="h-4 w-4 text-slate-500 cursor-pointer hover:text-slate-700" />
                  <div className="flex size-7 items-center justify-center rounded-full bg-[#00A884] text-white shadow-sm cursor-pointer">
                    <Mic className="h-3.5 w-3.5" />
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
