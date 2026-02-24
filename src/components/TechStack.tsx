"use client";

import { motion } from "framer-motion";

const TechStack = () => {
  return (
    <section className="relative py-28 md:py-36 px-6 overflow-hidden">
      <div className="absolute top-[30%] left-[-5%] w-[300px] h-[300px] gradient-blob rounded-full blur-3xl opacity-30 pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <span className="font-mono text-xs text-primary tracking-wider uppercase font-semibold">Architecture</span>
          <h2 className="text-4xl md:text-6xl font-serif mt-3 leading-[1.05]">
            How the pieces <span className="italic gradient-text">connect</span>
          </h2>
        </motion.div>

        {/* Flow diagram */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6"
        >
          {[
            {
              label:       "Agent Layer",
              items:       ["LocalOracle", "WeatherBot", "DeRisk", "AlphaSeeker"],
              gradient:    "from-secondary/20 to-secondary/5",
              borderColor: "border-secondary/40",
              dotColor:    "bg-secondary",
            },
            {
              label:       "Verification Layer",
              items:       ["Fact-Checker Agent", "Claim Parser", "CRE Query Engine", "Verdict Generator"],
              gradient:    "from-primary/20 to-primary/5",
              borderColor: "border-primary/40",
              dotColor:    "bg-primary",
            },
            {
              label:       "Trust Layer",
              items:       ["Chainlink CRE", "Price Feeds", "Weather Oracle", "On-chain Proof"],
              gradient:    "from-accent/20 to-accent/5",
              borderColor: "border-accent/40",
              dotColor:    "bg-accent",
            },
          ].map((col, i) => (
            <motion.div
              key={col.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative group"
            >
              <div
                className={`border-2 ${col.borderColor} rounded-2xl p-6 bg-gradient-to-b ${col.gradient} hover:scale-[1.02] transition-transform duration-300`}
              >
                <div className="flex items-center gap-2 mb-5">
                  <span className={`w-3 h-3 rounded-full ${col.dotColor}`} />
                  <span className="font-mono text-[11px] text-muted-foreground tracking-wider uppercase font-semibold">
                    {col.label}
                  </span>
                </div>
                <div className="space-y-2">
                  {col.items.map((item) => (
                    <div
                      key={item}
                      className="text-sm font-medium text-foreground bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-border/50"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              {i < 2 && (
                <div className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card border-2 border-border items-center justify-center text-primary font-bold text-lg shadow-md">
                  →
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* "Why this matters" CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24 rounded-2xl bg-primary p-10 md:p-14 glow-primary"
        >
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-3xl md:text-4xl font-serif text-primary-foreground mb-4">
                Why this <span className="italic">matters</span>
              </h3>
              <p className="text-primary-foreground/80 leading-relaxed">
                On agent-internet, trust is the scarcest resource. The CRE Fact-Checker
                turns Chainlink into the trust infrastructure for autonomous agent
                networks — verifiable, decentralized, and always-on.
              </p>
            </div>
            <div className="space-y-4">
              {[
                "Not a chatbot — a verification agent with oracle-backed proof",
                "Composable: any agent network can plug in the fact-checker",
                "Chainlink CRE as the source of truth for agent claims",
              ].map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <span className="text-primary-foreground font-mono text-sm mt-0.5 font-bold">✓</span>
                  <span className="text-sm text-primary-foreground/90">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TechStack;
