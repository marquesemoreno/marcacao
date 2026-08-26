import { HeroSection } from "@/components/public/landing/hero-section";
import { SpecialtyGrid } from "@/components/public/landing/specialty-grid";
import { WhatsAppShowcase } from "@/components/public/landing/whatsapp-showcase";
import { FeaturedClinics } from "@/components/public/landing/featured-clinics";
import { FaqSection } from "@/components/public/landing/faq-section";
import { getFeaturedClinics, getSpecialtyClinicCounts, getSpecialtyStartingPrices } from "@/actions/search";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [clinics, clinicCounts, startingPrices] = await Promise.all([
    getFeaturedClinics(),
    getSpecialtyClinicCounts(),
    getSpecialtyStartingPrices(),
  ]);

  return (
    <main className="flex flex-col">
      {/* 1. Hero Section com Busca (Cidade + Especialidade) */}
      <HeroSection />

      {/* 2. Grid de Especialidades Populares (com preço real "a partir de") */}
      <SpecialtyGrid clinicCounts={clinicCounts} startingPrices={startingPrices} />

      {/* 3. Seção Única do WhatsApp / Como Funciona */}
      <WhatsAppShowcase />

      {/* 4. Vitrine de Clínicas Parceiras (com botão levando para /clinicas) */}
      <FeaturedClinics clinics={clinics} />

      {/* 5. FAQ e Rodapé */}
      <FaqSection />
    </main>
  );
}
