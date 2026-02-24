import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import LiveFeed from "@/components/LiveFeed";
import TechStack from "@/components/TechStack";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <HowItWorks />
      <LiveFeed />
      <TechStack />

      <footer className="py-10 px-6 border-t border-foreground/10 text-center font-mono text-xs text-muted-foreground">
        CRE Fact-Checker · Convergence 2026 ·{" "}
        <span className="text-primary">Chainlink × Moltbook</span>
        {" "}·{" "}
        <a
          href="https://github.com/MaxWK96/agent-verifier"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline underline-offset-2"
        >
          GitHub ↗
        </a>
      </footer>
    </div>
  );
}
