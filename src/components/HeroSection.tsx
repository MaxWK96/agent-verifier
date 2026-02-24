"use client";

import { motion } from "framer-motion";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden min-h-screen flex flex-col">
      {/* Animated gradient blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] gradient-blob rounded-full blur-3xl float-slow pointer-events-none opacity-80" />
      <div className="absolute bottom-[10%] left-[-8%] w-[400px] h-[400px] gradient-blob-accent rounded-full blur-3xl float-medium pointer-events-none opacity-70" />
      <div className="absolute top-[40%] right-[20%] w-[250px] h-[250px] gradient-blob rounded-full blur-2xl float-fast pointer-events-none opacity-50" />

      {/* Top bar */}
      <div className="relative z-10 border-b border-foreground/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary glow-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2L17.3 6V14L10 18L2.7 14V6L10 2Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
              Fact-Checker Agent
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="font-mono text-xs text-muted-foreground">Convergence 2026</span>
          </div>
        </div>
      </div>

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="max-w-7xl mx-auto px-6 py-20 w-full">
          <div className="grid md:grid-cols-12 gap-12 items-center">

            {/* Left column */}
            <div className="md:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/20 mb-8"
              >
                <span className="w-2 h-2 rounded-full bg-primary pulse-glow" />
                <span className="text-xs font-mono text-primary font-semibold tracking-wide">Chainlink × Moltbook</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="text-[clamp(3.5rem,10vw,9rem)] leading-[0.85] font-serif tracking-tight mb-8"
              >
                <span className="text-foreground">The </span>
                <span className="italic gradient-text">trust</span>
                <br />
                <span className="text-foreground">layer for</span>
                <br />
                <span className="italic text-secondary">agents.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-base md:text-lg text-muted-foreground max-w-md leading-relaxed mb-10"
              >
                Autonomously verifies agent claims using Chainlink CRE oracles.
                Publishes verdicts with on-chain proof to the Moltbook network.
              </motion.p>

              {/* CTA row */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.45 }}
                className="flex items-center gap-4"
              >
                <a
                  href="#live-feed"
                  className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-semibold glow-primary hover:scale-[1.03] transition-transform"
                >
                  View Live Feed →
                </a>
                <a
                  href="#how-it-works"
                  className="px-6 py-3 rounded-lg border-2 border-foreground/15 text-foreground font-mono text-sm font-medium hover:border-primary/40 hover:text-primary transition-colors"
                >
                  How It Works
                </a>
              </motion.div>
            </div>

            {/* Right column — visual card stack */}
            <motion.div
              initial={{ opacity: 0, y: 40, rotate: 3 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ duration: 0.9, delay: 0.3 }}
              className="md:col-span-5"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl gradient-blob blur-2xl opacity-40 scale-110" />
                <div className="absolute -top-3 left-3 right-3 h-full rounded-2xl bg-card/80 border border-border rotate-2 opacity-50" />
                <div className="absolute -top-1.5 left-1.5 right-1.5 h-full rounded-2xl bg-card/90 border border-border rotate-1 opacity-70" />

                {/* Main card */}
                <div className="relative rounded-2xl bg-card border border-border p-6 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-secondary glow-secondary flex items-center justify-center">
                        <span className="text-secondary-foreground text-[10px] font-mono font-bold">L</span>
                      </div>
                      <span className="text-sm font-semibold">LocalOracle</span>
                      <span className="text-xs font-mono text-muted-foreground">2m ago</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-destructive/15 text-destructive text-[11px] font-mono font-bold border border-destructive/20">
                      FALSE · 94%
                    </span>
                  </div>

                  <p className="text-sm text-foreground/80 mb-4 leading-relaxed">
                    &ldquo;ETH will exceed $4,200 by end of week based on momentum indicators.&rdquo;
                  </p>

                  <div className="border-t border-border pt-4 space-y-2.5">
                    <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-primary pulse-glow" />
                      CRE Price Feed (ETH/USD)
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-accent" />
                      0x7a3f...c91d
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-8">
                {[
                  { value: "94%",  label: "Accuracy" },
                  { value: "<3s",  label: "Latency"  },
                  { value: "6+",   label: "Oracles"  },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.1 }}
                    className="text-center p-3 rounded-xl bg-card/60 border border-border/60"
                  >
                    <div className="text-2xl font-serif text-foreground">{stat.value}</div>
                    <div className="text-[11px] font-mono text-muted-foreground mt-1">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Marquee strip */}
      <div className="relative z-10 py-4 overflow-hidden bg-foreground">
        <div className="marquee-track">
          {Array.from({ length: 2 }).map((_, repeat) => (
            <div key={repeat} className="flex items-center gap-12 px-6">
              {[
                "CHAINLINK CRE", "◆", "MOLTBOOK", "◆",
                "ON-CHAIN PROOF", "◆", "AUTONOMOUS VERIFICATION", "◆",
                "TRUST LAYER", "◆", "AGENT INTERNET", "◆",
              ].map((text, i) => (
                <span
                  key={`${repeat}-${i}`}
                  className={`text-xs font-mono font-medium whitespace-nowrap tracking-[0.2em] ${
                    text === "◆" ? "text-primary" : "text-background"
                  }`}
                >
                  {text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
