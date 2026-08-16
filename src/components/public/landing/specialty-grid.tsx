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
  type LucideIcon,
} from "lucide-react";

type SpecialtyItem = {
  label: string;
  query: string;
  icon: LucideIcon;
  iconClassName: string;
};

const specialties: SpecialtyItem[] = [
  { label: "Clínico Geral", query: "Clínica Geral", icon: Stethoscope, iconClassName: "bg-sky-50 text-sky-600" },
  { label: "Cardiologia", query: "Cardiologia", icon: HeartPulse, iconClassName: "bg-rose-50 text-rose-600" },
  { label: "Oftalmologia", query: "Oftalmologia", icon: Eye, iconClassName: "bg-violet-50 text-violet-600" },
  { label: "Ultrassonografia", query: "Ultrassonografia", icon: Waves, iconClassName: "bg-teal-50 text-teal-600" },
  { label: "Exames de Sangue", query: "Hemograma", icon: Droplet, iconClassName: "bg-red-50 text-red-600" },
  { label: "Ginecologia", query: "Ginecologia", icon: Venus, iconClassName: "bg-pink-50 text-pink-600" },
  { label: "Ortopedia", query: "Ortopedia", icon: Bone, iconClassName: "bg-amber-50 text-amber-600" },
  { label: "Dermatologia", query: "Dermatologia", icon: Sparkles, iconClassName: "bg-emerald-50 text-emerald-600" },
];

export function SpecialtyGrid() {
  return (
    <section id="especialidades" className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Especialidades e exames mais buscados
          </h2>
          <p className="mt-3 text-slate-600">
            Encontre rápido o que você precisa — é só clicar para ver as clínicas disponíveis.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {specialties.map(({ label, query, icon: Icon, iconClassName }) => (
            <Link
              key={label}
              href={`/buscar?q=${encodeURIComponent(query)}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-xl"
            >
              <span
                className={`flex size-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${iconClassName}`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-sm font-semibold text-slate-800">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
