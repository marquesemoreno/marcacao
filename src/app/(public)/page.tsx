import { HeroSection } from "@/components/public/landing/hero-section";
import { SpecialtyGrid } from "@/components/public/landing/specialty-grid";
import { HowItWorks } from "@/components/public/landing/how-it-works";
import { FeaturedClinics } from "@/components/public/landing/featured-clinics";
import { BenefitsSection } from "@/components/public/landing/benefits-section";
import { FaqSection } from "@/components/public/landing/faq-section";
import { getFeaturedClinics } from "@/actions/search";

// Preços/avaliações mudam a qualquer momento — evita que a home fique
// congelada com dados do instante do build (e evita build do Docker
// depender de um banco acessível/populado nesse momento, ver Dockerfile).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const clinics = await getFeaturedClinics();

  return (
    <main className="flex flex-col">
      <HeroSection />
      <SpecialtyGrid />
      <HowItWorks />
      <FeaturedClinics clinics={clinics} />
      <BenefitsSection />
      <FaqSection />
    </main>
  );
}
