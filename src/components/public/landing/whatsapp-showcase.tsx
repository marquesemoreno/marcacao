import { QrCode, Signal, Wifi, Battery, ChevronLeft, Video, Phone } from "lucide-react";

export function WhatsAppShowcase() {
  return (
    <section className="bg-slate-50/50">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8">
        <div className="order-2 flex flex-col gap-4 lg:order-1">
          <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Confirmação automática
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Do agendamento à guia de encaminhamento, tudo no seu WhatsApp
          </h2>
          <p className="text-slate-600">
            Sem aplicativo para baixar, sem senha para lembrar. Você agenda pelo site e
            recebe confirmação, orientações de preparo e a guia oficial com QR Code
            direto na conversa — como se estivesse falando com a clínica.
          </p>
          <ul className="mt-2 flex flex-col gap-3 text-sm text-slate-700">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                1
              </span>
              Confirmação da consulta ou exame em segundos
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                2
              </span>
              Orientações de preparo e documentos necessários
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                3
              </span>
              Guia de encaminhamento com QR Code anexada no chat
            </li>
          </ul>
        </div>

        <div className="order-1 flex justify-center lg:order-2">
          <div className="relative w-[300px] rounded-[2.5rem] border-8 border-slate-900 bg-slate-900 shadow-2xl">
            <div className="absolute left-1/2 top-0 z-10 h-5 w-32 -translate-x-1/2 rounded-b-2xl bg-slate-900" />
            <div className="flex h-[600px] flex-col overflow-hidden rounded-[2rem] bg-[#e5ddd5]">
              <div className="flex items-center justify-between bg-emerald-600 px-3 pb-2 pt-3 text-white">
                <div className="flex items-center gap-1 text-[10px] font-medium">
                  <span>9:41</span>
                </div>
                <div className="flex items-center gap-1">
                  <Signal className="h-3 w-3" />
                  <Wifi className="h-3 w-3" />
                  <Battery className="h-3 w-3" />
                </div>
              </div>

              <div className="flex items-center gap-2 bg-emerald-600 px-3 pb-3 text-white">
                <ChevronLeft className="h-5 w-5" />
                <span className="flex size-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                  CS
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">Conecta Saúde</p>
                  <p className="text-[10px] text-emerald-50">online</p>
                </div>
                <Video className="h-4 w-4" />
                <Phone className="h-4 w-4" />
              </div>

              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-4">
                <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[12.5px] leading-snug text-slate-800 shadow-sm">
                  Olá Lucas! Sua consulta com Clínico Geral na Clínica Santa Clara foi
                  agendada para amanhã às 14h.
                  <span className="mt-1 block text-right text-[9px] text-slate-400">14:02</span>
                </div>

                <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[12.5px] leading-snug text-slate-800 shadow-sm">
                  📋 Orientações: Comparecer com 20 min de antecedência e documento com
                  foto. Digite 1 para Confirmar ou 2 para Cancelar.
                  <span className="mt-1 block text-right text-[9px] text-slate-400">14:02</span>
                </div>

                <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2.5 text-[12.5px] leading-snug text-slate-800 shadow-sm">
                  <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-slate-200">
                      <QrCode className="h-6 w-6 text-slate-700" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        Guia de Encaminhamento
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        #VDC-2026-XXXXX.pdf
                      </p>
                    </div>
                  </div>
                  <span className="mt-1 block text-right text-[9px] text-slate-400">14:03</span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 px-3 py-2.5">
                <div className="flex-1 rounded-full bg-white px-3 py-2 text-[11px] text-slate-400">
                  Mensagem
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
