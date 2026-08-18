"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Search,
  MapPin,
  Star,
  CheckCircle2,
  Signal,
  Wifi,
  Battery,
  ChevronLeft,
  CheckCheck,
  Sparkles,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StepDefinition = {
  tabLabel: string;
  badge: string;
  title: string;
  description: string;
};

const steps: StepDefinition[] = [
  {
    tabLabel: "1. Busca",
    badge: "PASSO 01",
    title: "Escolha o Procedimento na sua Cidade",
    description:
      "Pesquise por especialidade, exame ou clínica, compare preços reais e avaliações de clínicas verificadas antes de agendar.",
  },
  {
    tabLabel: "2. WhatsApp",
    badge: "PASSO 02",
    title: "Confirmação e Orientações no WhatsApp",
    description:
      "Receba a confirmação da consulta e o preparo necessário, e responda com um clique — tudo direto na sua conversa, sem instalar nada.",
  },
  {
    tabLabel: "3. Guia QR Code",
    badge: "PASSO 03",
    title: "Guia Digital com QR Code no Celular",
    description:
      "Apresente o QR Code da guia na recepção e faça seu check-in em segundos — sem fila, sem papel, sem burocracia.",
  },
];

export function ScrollShowcase() {
  const [activeStep, setActiveStep] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const cards = cardRefs.current.filter((el): el is HTMLDivElement => el !== null);
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = cardRefs.current.findIndex((el) => el === entry.target);
          if (index !== -1) setActiveStep(index);
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
    );

    cards.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function goToStep(index: number) {
    setActiveStep(index);
    cardRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section
      id="fluxo-paciente"
      className="relative overflow-hidden bg-slate-50/70 py-20 lg:py-28 border-t border-b border-slate-200/70"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-full max-w-6xl -translate-x-1/2 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.08),rgba(255,255,255,0))]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/70 bg-teal-50/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-teal-700">
            <Sparkles className="h-3.5 w-3.5 text-teal-600" />
            <span>Jornada do Paciente</span>
          </div>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Do agendamento ao atendimento em{" "}
            <span className="text-teal-600">3 passos simples</span>
          </h2>

          <p className="mt-3 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            Uma experiência digital completa pensada para você economizar tempo e dinheiro.
          </p>
        </div>

        {/* Mobile: Pill Tabs */}
        <div className="mt-10 flex items-center justify-center gap-2 overflow-x-auto pb-1 lg:hidden">
          {steps.map((step, index) => (
            <button
              key={step.tabLabel}
              type="button"
              onClick={() => goToStep(index)}
              className={cn(
                "flex min-h-11 shrink-0 items-center rounded-full px-4 py-2 text-xs font-bold tracking-tight transition-all duration-300",
                activeStep === index
                  ? "bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-500"
              )}
            >
              {step.tabLabel}
            </button>
          ))}
        </div>

        {/* Mobile: Active step copy */}
        <div className="mt-6 text-center lg:hidden">
          <h3 className="text-lg font-bold text-slate-900">{steps[activeStep].title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{steps[activeStep].description}</p>
        </div>

        {/* Mobile: Preview */}
        <div className="mt-6 flex justify-center lg:hidden">
          <PhoneShowcase activeStep={activeStep} />
        </div>

        {/* Desktop: Sticky Scroll Layout */}
        <div className="mt-16 hidden lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="flex flex-col gap-6 lg:col-span-6">
            {steps.map((step, index) => (
              <div
                key={step.tabLabel}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                onClick={() => goToStep(index)}
                className={cn(
                  "cursor-pointer rounded-3xl border p-7 transition-all duration-300",
                  activeStep === index
                    ? "border-teal-300/80 bg-white shadow-xl shadow-teal-900/5"
                    : "border-slate-200/80 bg-white/60 hover:border-teal-200 hover:bg-white"
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center rounded-xl px-3 py-1 text-[11px] font-black tracking-wider text-white shadow-sm transition-colors duration-300",
                    activeStep === index
                      ? "bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600"
                      : "bg-slate-300"
                  )}
                >
                  {step.badge}
                </span>

                <h3 className="mt-4 text-xl font-bold tracking-tight text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>

                <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 transition-all duration-500 ease-out",
                      activeStep >= index ? "w-full" : "w-0"
                    )}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-6">
            <div className="sticky top-28 flex justify-center">
              <PhoneShowcase activeStep={activeStep} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneShowcase({ activeStep }: { activeStep: number }) {
  return (
    <div className="relative w-[300px] rounded-[44px] bg-slate-900 p-3 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)] ring-1 ring-slate-800 sm:w-[320px]">
      <div className="absolute left-1/2 top-4.5 z-30 h-4 w-24 -translate-x-1/2 rounded-full bg-black" />

      <div className="relative flex h-[560px] flex-col overflow-hidden rounded-[36px] bg-white">
        <div
          className={cn(
            "flex shrink-0 items-center justify-between px-5 pt-3 pb-1.5 text-white transition-colors duration-500",
            activeStep === 1 ? "bg-[#075E54]" : "bg-slate-900"
          )}
        >
          <span className="text-[11px] font-semibold tracking-tight">09:41</span>
          <div className="flex items-center gap-1.5">
            <Signal className="h-3 w-3 text-white/90" />
            <Wifi className="h-3 w-3 text-white/90" />
            <Battery className="h-3.5 w-3.5 text-white/90" />
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <ScreenLayer active={activeStep === 0}>
            <SearchScreen />
          </ScreenLayer>
          <ScreenLayer active={activeStep === 1}>
            <WhatsAppScreen />
          </ScreenLayer>
          <ScreenLayer active={activeStep === 2}>
            <VoucherScreen />
          </ScreenLayer>
        </div>
      </div>
    </div>
  );
}

function ScreenLayer({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col transition-all duration-500 ease-out",
        active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      )}
    >
      {children}
    </div>
  );
}

function SearchScreen() {
  return (
    <div className="flex h-full flex-col gap-3 bg-gradient-to-b from-sky-50/60 to-white px-4 py-4">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <MapPin className="h-4 w-4 shrink-0 text-sky-600" />
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Cidade</p>
          <p className="text-xs font-semibold text-slate-900">Vitória da Conquista</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <Search className="h-4 w-4 shrink-0 text-emerald-600" />
        <p className="text-xs font-semibold text-slate-900">Urologista</p>
      </div>

      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Resultados encontrados</p>

      <div className="rounded-2xl border border-teal-200/70 bg-white p-3 shadow-md shadow-teal-900/5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-900">Urolaser - Clínica de Urologia</p>
            <p className="text-[10px] text-slate-500">Recreio, Vitória da Conquista</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Verificado
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-slate-900">4.9</span>
            <span className="text-[10px] text-slate-400">(156)</span>
          </div>
          <span className="rounded-full border border-teal-200/60 bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">
            A partir de R$ 130
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3">
        <p className="truncate text-xs font-bold text-slate-800">Clínica Cirúrgica Santa Clara</p>
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-[11px] font-semibold text-slate-700">4.8</span>
          </div>
          <span className="text-[10px] font-bold text-teal-700">A partir de R$ 140</span>
        </div>
      </div>
    </div>
  );
}

function WhatsAppScreen() {
  return (
    <div className="flex h-full flex-col bg-[#EFEAE2]">
      <div className="flex items-center gap-2 bg-[#075E54] px-3 py-2.5 text-white shadow-md">
        <ChevronLeft className="h-4 w-4 text-white/80" />
        <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-[10px] font-black text-white">
          CS
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold leading-tight">Conecta Saúde</p>
          <p className="text-[9px] text-emerald-100/90">online</p>
        </div>
      </div>

      <div
        className="flex flex-1 flex-col gap-2 overflow-hidden px-3 py-3 text-[11px]"
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 0.75px, transparent 0.75px)",
          backgroundSize: "12px 12px",
        }}
      >
        <div className="max-w-[85%] self-start rounded-2xl rounded-tl-none bg-white p-2.5 shadow-sm">
          <p className="text-[10.5px] leading-snug text-slate-800">
            Olá! Sua <strong className="font-bold text-slate-900">Consulta - Urologia</strong> na{" "}
            <strong className="font-bold text-teal-700">Urolaser</strong> foi confirmada para amanhã às{" "}
            <strong className="font-bold text-slate-900">14:00</strong>.
          </p>
        </div>

        <div className="max-w-[85%] self-start rounded-2xl rounded-tl-none bg-white p-2.5 shadow-sm">
          <p className="text-[10.5px] font-semibold text-slate-900">📋 Preparo:</p>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-600">
            • Jejum de 8 horas
            <br />• Trazer documento com foto
          </p>
          <div className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50 p-1.5 text-[9.5px] font-semibold text-slate-600">
            Responda 1 para confirmar
          </div>
        </div>

        <div className="max-w-[55%] self-end rounded-2xl rounded-tr-none bg-[#DCF8C6] p-2 shadow-sm">
          <p className="text-[11px] font-bold text-slate-900">1 - Confirmado</p>
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[8.5px] text-emerald-800">
            <span>14:01</span>
            <CheckCheck className="h-3 w-3 text-sky-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

function VoucherScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-emerald-50/50 to-white px-5 py-6">
      <div className="w-full rounded-2xl border-2 border-dashed border-teal-300 bg-white p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Guia Oficial</p>
            <p className="font-mono text-sm font-bold text-sky-700">#VDC-2026-84920</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
            ✓ Confirmado
          </span>
        </div>

        <div className="mt-3 flex justify-center rounded-xl border border-slate-100 bg-white p-2">
          <QRCodeSVG value="https://conectasaudevc.com.br/comprovante/demo" size={120} level="M" />
        </div>

        <div className="mt-3 border-t border-dashed border-slate-200 pt-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Clínica</p>
          <p className="text-xs font-bold text-slate-900">Urolaser - Clínica de Urologia</p>
          <p className="text-[10px] text-slate-500">Recreio, Vitória da Conquista</p>
        </div>
      </div>

      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-sm">
        <ScanLine className="h-3.5 w-3.5" />
        Check-in Express sem fila
      </div>
    </div>
  );
}
