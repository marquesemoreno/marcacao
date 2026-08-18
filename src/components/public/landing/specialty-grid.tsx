import Link from "next/link";
import {
  Stethoscope,
  HeartPulse,
  Eye,
  Waves,
  Droplet,
  Venus,
  Bone,
  Sparkles,
  ArrowRight,
  Building2,
  type LucideIcon,
} from "lucide-react";

type SpecialtyItem = {
  label: string;
  query: string;
  category: "consulta" | "exame";
  icon: LucideIcon;
  iconBgGradient: string;
  iconColor: string;
  borderHover: string;
};

const specialties: SpecialtyItem[] = [
  {
    label: "Clínico Geral",
    query: "Clínica Geral",
    category: "consulta",
    icon: Stethoscope,
    iconBgGradient: "from-sky-50 to-sky-100/90",
    iconColor: "text-sky-600",
    borderHover: "hover:border-sky-400/60",
  },
  {
    label: "Cardiologia",
    query: "Cardiologia",
    category: "consulta",
    icon: HeartPulse,
    iconBgGradient: "from-rose-50 to-rose-100/90",
    iconColor: "text-rose-600",
    borderHover: "hover:border-rose-400/60",
  },
  {
    label: "Ultrassonografia",
    query: "Ultrassonografia Abdominal",
    category: "exame",
    icon: Waves,
    iconBgGradient: "from-teal-50 to-teal-100/90",
    iconColor: "text-teal-600",
    borderHover: "hover:border-teal-400/60",
  },
  {
    label: "Oftalmologia",
    query: "Oftalmologia",
    category: "consulta",
    icon: Eye,
    iconBgGradient: "from-violet-50 to-violet-100/90",
    iconColor: "text-violet-600",
    borderHover: "hover:border-violet-400/60",
  },
  {
    label: "Exames de Sangue",
    query: "Hemograma",
    category: "exame",
    icon: Droplet,
    iconBgGradient: "from-red-50 to-red-100/90",
    iconColor: "text-red-600",
    borderHover: "hover:border-red-400/60",
  },
  {
    label: "Ginecologia",
    query: "Ginecologia",
    category: "consulta",
    icon: Venus,
    iconBgGradient: "from-pink-50 to-pink-100/90",
    iconColor: "text-pink-600",
    borderHover: "hover:border-pink-400/60",
  },
  {
    label: "Ortopedia",
    query: "Ortopedia",
    category: "consulta",
    icon: Bone,
    iconBgGradient: "from-amber-50 to-amber-100/90",
    iconColor: "text-amber-600",
    borderHover: "hover:border-amber-400/60",
  },
  {
    label: "Dermatologia",
    query: "Dermatologia",
    category: "consulta",
    icon: Sparkles,
    iconBgGradient: "from-emerald-50 to-emerald-100/90",
    iconColor: "text-emerald-600",
    borderHover: "hover:border-emerald-400/60",
  },
];

export function SpecialtyGrid({ prices }: { prices: Record<string, number> }) {
  return (
    <section id="especialidades" className="relative bg-white py-16 sm:py-24">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-teal-800 font-mono">
            <Building2 className="size-3.5 text-teal-600" />
            <span>Catálogo Geral de Saúde</span>
          </div>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Especialidades e exames mais buscados
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            Navegue pelas áreas médicas credenciadas na sua região e solicite horários com agilidade.
          </p>
        </div>

        {/* Specialty Cards Grid */}
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
          {specialties.map(
            ({
              label,
              query,
              category,
              icon: Icon,
              iconBgGradient,
              iconColor,
              borderHover,
            }) => {
              const clinicCount = prices[query] ?? prices[label] ?? 1;

              return (
                <Link
                  key={label}
                  href={`/buscar?q=${encodeURIComponent(query)}`}
                  className={`group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${borderHover}`}
                >
                  <div>
                    {/* Header: Icon & Category Tag */}
                    <div className="flex items-center justify-between">
                      <div
                        className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${iconBgGradient} ${iconColor} shadow-inner transition-transform duration-300 group-hover:scale-105`}
                      >
                        <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                      </div>

                      <span className="rounded-full bg-slate-100/90 px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500 font-mono">
                        {category}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="mt-4 text-base sm:text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                      {label}
                    </h3>

                    {/* Under Consultation Pill Badge */}
                    <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-bold text-emerald-800 shadow-2xs">
                      <span>💬 Valor sob consulta</span>
                    </div>
                  </div>

                  {/* Footer: Availability & Action Arrow */}
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      {clinicCount} {clinicCount === 1 ? "clínica credenciada" : "clínicas credenciadas"}
                    </span>

                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              );
            }
          )}
        </div>

      </div>
    </section>
  );
}
