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
  Search,
  CheckCircle2,
  Paperclip,
  Smile,
  Mic,
  Camera,
} from "lucide-react";

export function WhatsAppShowcase() {
  return (
    <section id="whatsapp-demo" className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 py-16 lg:py-24">
      {/* Decorative background glows */}
      <div className="pointer-events-none absolute -left-40 top-1/4 size-96 rounded-full bg-teal-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-1/4 size-96 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header Title */}
        <div className="mx-auto max-w-3xl text-center mb-12 lg:mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-4 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs backdrop-blur-xs">
            <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
            <MessageCircle className="size-3.5 text-emerald-600" />
            Experiência 100% no WhatsApp
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-4xl leading-tight">
            Do agendamento ao atendimento <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">direto no seu WhatsApp</span>
          </h2>

          <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
            Esqueça filas, senhas ou aplicativos pesados. Você escolhe sua consulta ou exame no site e recebe a confirmação, o preparo e a Guia com QR Code direto na conversa.
          </p>
        </div>

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          
          {/* Left Column: 3 Essential Steps */}
          <div className="flex flex-col gap-6 lg:col-span-6 xl:col-span-7">
            <div className="flex flex-col gap-4">
              
              {/* Step 01 */}
              <div className="group flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-2xs transition-all hover:border-teal-300 hover:shadow-md">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
                  <Search className="size-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                      Passo 01
                    </span>
                    <h3 className="text-base font-bold text-slate-900">Escolha a Cidade e o Procedimento</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Compare clínicas credenciadas, veja valores transparentes e escolha o melhor horário.
                  </p>
                </div>
              </div>

              {/* Step 02 */}
              <div className="group flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-2xs transition-all hover:border-teal-300 hover:shadow-md">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-teal-600 text-white shadow-xs">
                  <Clock className="size-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60">
                      Passo 02
                    </span>
                    <h3 className="text-base font-bold text-slate-900">Orientações e Confirmação no WhatsApp</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Receba o lembrete com data, horário e instruções detalhadas de preparo (como jejum), confirmando em 1 clique.
                  </p>
                </div>
              </div>

              {/* Step 03 */}
              <div className="group flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-2xs transition-all hover:border-teal-300 hover:shadow-md">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-xs">
                  <QrCode className="size-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                      Passo 03
                    </span>
                    <h3 className="text-base font-bold text-slate-900">Guia Digital com QR Code no Balcão</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Apresente o comprovante digital direto na recepção da clínica para fazer check-in sem fila e com o preço reduzido garantido.
                  </p>
                </div>
              </div>

            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span>🔒 Dados protegidos pela LGPD</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <Smartphone className="size-4 text-sky-600" />
                <span>📱 100% no seu WhatsApp, sem baixar nada</span>
              </div>
            </div>
          </div>

          {/* Right Column: Realistic Smartphone Mockup */}
          <div className="relative flex justify-center lg:col-span-6 xl:col-span-5">
            
            {/* Floating Badge 1: Confirmação instantânea */}
            <div className="absolute -top-3 -left-4 z-20 hidden sm:flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-white/95 px-3.5 py-2.5 shadow-lg shadow-emerald-500/10 backdrop-blur-md transition-transform hover:scale-105">
              <span className="flex size-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold">
                <Zap className="size-4" />
              </span>
              <div className="text-left">
                <p className="text-[11px] font-bold text-slate-900 leading-tight">Confirmação Instantânea</p>
                <p className="text-[10px] text-slate-500">Em poucos segundos</p>
              </div>
            </div>

            {/* Floating Badge 2: Preço reduzido garantido */}
            <div className="absolute -bottom-4 right-2 z-20 hidden sm:flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-lg shadow-slate-900/10 backdrop-blur-md transition-transform hover:scale-105">
              <span className="flex size-7 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                <CheckCircle2 className="size-4 text-emerald-600" />
              </span>
              <div className="text-left">
                <p className="text-[11px] font-bold text-slate-900 leading-tight">Check-in Express</p>
                <p className="text-[10px] text-slate-500">Preço com desconto garantido</p>
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
                    <Signal className="size-3 text-white/90" />
                    <Wifi className="size-3 text-white/90" />
                    <Battery className="size-3.5 text-white/90" />
                  </div>
                </div>

                {/* WhatsApp Chat Header */}
                <div className="flex items-center justify-between bg-[#075E54] px-3 py-2.5 text-white shadow-md">
                  <div className="flex items-center gap-2">
                    <ChevronLeft className="size-5 text-white/90 cursor-pointer" />
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
                    <Video className="size-4 cursor-pointer hover:text-white" />
                    <Phone className="size-3.5 cursor-pointer hover:text-white" />
                  </div>
                </div>

                {/* WhatsApp Chat Message Area */}
                <div 
                  className="flex-1 overflow-y-auto px-3 py-3.5 flex flex-col gap-2.5 text-[12px] leading-relaxed"
                  style={{
                    backgroundImage: `radial-gradient(#cbd5e1 0.75px, transparent 0.75px)`,
                    backgroundSize: '12px 12px'
                  }}
                >
                  {/* Encryption Notice */}
                  <div className="mx-auto my-1 max-w-[85%] rounded-lg bg-[#FFEECD]/90 px-3 py-1.5 text-center text-[10px] text-amber-900 shadow-2xs">
                    🔒 As mensagens e chamadas são protegidas com a criptografia de ponta a ponta.
                  </div>

                  {/* Day Divider */}
                  <div className="mx-auto my-0.5 rounded-full bg-white/80 px-2.5 py-0.5 text-[10px] font-medium text-slate-500 shadow-2xs">
                    Hoje
                  </div>

                  {/* Message 1: Confirmation */}
                  <div className="relative max-w-[88%] self-start rounded-2xl rounded-tl-none bg-white p-3 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
                    <p className="text-[11.5px] leading-relaxed">
                      Olá, Lucas! 👋 Seu agendamento para <strong className="text-slate-900 font-bold">Consulta com Clínico Geral</strong> na <strong className="text-teal-700 font-bold">Clínica Cirúrgica Santa Clara</strong> foi confirmado para amanhã às <strong className="text-slate-900 font-bold">14:00</strong>.
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-slate-400">
                      <span>14:00</span>
                    </div>
                  </div>

                  {/* Message 2: Instructions */}
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
                        <strong className="text-emerald-700 font-bold">1</strong> - Confirmar presença<br />
                        <strong className="text-rose-700 font-bold">2</strong> - Cancelar ou reagendar
                      </p>
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-slate-400">
                      <span>14:00</span>
                    </div>
                  </div>

                  {/* Message 3: Patient Reply */}
                  <div className="relative max-w-[40%] self-end rounded-2xl rounded-tr-none bg-[#DCF8C6] p-2.5 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
                    <p className="text-[13px] font-bold text-slate-900 px-1">1</p>
                    <div className="mt-0.5 flex items-center justify-end gap-1 text-[9px] text-emerald-800">
                      <span>14:01</span>
                      <CheckCheck className="size-3.5 text-sky-600" />
                    </div>
                  </div>

                  {/* Message 4: Voucher QR Code Attachment */}
                  <div className="relative max-w-[92%] self-start rounded-2xl rounded-tl-none bg-white p-3 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)] border border-emerald-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                      <span>🎟️</span>
                      <span>Guia Oficial de Encaminhamento</span>
                    </div>
                    
                    <div className="mt-2 rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-2xs border border-slate-200">
                          <QrCode className="size-10 text-slate-800" />
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
                        <span className="text-[9.5px] font-bold text-teal-700">Valor reduzido: R$ 140</span>
                        <span className="flex items-center gap-1 text-[9.5px] font-bold text-sky-600">
                          Ver Guia <ExternalLink className="size-2.5" />
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
                  <Smile className="size-5 text-slate-500 cursor-pointer hover:text-slate-700 ml-1" />
                  <Paperclip className="size-4 text-slate-500 cursor-pointer hover:text-slate-700" />
                  <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-[11px] text-slate-400 shadow-inner">
                    Digite uma mensagem...
                  </div>
                  <Camera className="size-4 text-slate-500 cursor-pointer hover:text-slate-700" />
                  <div className="flex size-7 items-center justify-center rounded-full bg-[#00A884] text-white shadow-2xs cursor-pointer">
                    <Mic className="size-3.5" />
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
