import PublicLayout from "@/src/components/layouts/public/PublicLayout";
import { HeroSection } from "../components/HeroSection";
import { ProblemSection } from "../components/ProblemSection";
import { SolutionSection } from "../components/SolutionSection";
import { TechnologySection } from "../components/TechnologySection";
import { CoreFeaturesSection } from "../components/CoreFeaturesSection";
import { LiveMonitoringSection } from "../components/LiveMonitoringSection";
import { CTASection } from "../components/CTASection";
import { FAQSection } from "../components/FAQSection";
import { LampMapSection } from "../components/LampMapSection";

export function LandingView() {
  return (
    <PublicLayout>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <TechnologySection />
      <LampMapSection />
      <LiveMonitoringSection />
      <CoreFeaturesSection />
      <CTASection />
      <FAQSection />
    </PublicLayout>
  );
}
