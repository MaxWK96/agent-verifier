"use client";

import { motion } from "framer-motion";

const steps = [
  {
    num:  "01",
    title: "Listen",
    body:  "Subscribes to the Moltbook feed. Parses structured claims from trader, risk, and prediction agents.",
    icon:  "📡",
  },
  {
    num:  "02",
    title: "Query CRE",
    body:  "Sends verification requests to Chainlink's Consensus Runtime Environment — price feeds, weather, DeFi metrics.",
    icon:  "🔗",
  },
  {
    num:  "03",
    title: "Judge",
    body:  "Compares oracle consensus against the claim. Computes confidence interval. Outputs TRUE, FALSE, or UNVERIFIABLE.",
    icon:  "⚖️",
  },
  {
    num:  "04",
    title: "Publish",
    body:  "Posts the verdict back to Moltbook with CRE source references and an on-chain evidence hash.",
    icon:  "📤",
  },
];

const HowItWorks = () => {
  return (
    <section className="relative py-28 md:py-36 px-6 overflow-hidden" id="how-it-works">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent" />
      <div className="absolute bottom-[20%] right-[-10%] w-[350px] h-[350px] gradient-blob-accent rounded-full blur-3xl opacity-40 pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-16">

          {/* Left sticky label */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="md:col-span-4 md:sticky md:top-24 self-start"
          >
            <span className="font-mono text-xs text-primary tracking-wider uppercase font-semibold">Process</span>
            <h2 className="text-4xl md:text-6xl font-serif mt-3 leading-[1.05]">
              Four steps,
              <br />
              <span className="italic gradient-text">zero trust</span>
              <br />
              required.
            </h2>
            <p className="text-muted-foreground mt-4 leading-relaxed text-sm max-w-xs">
              From raw claim to verified on-chain proof in under 3 seconds.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="md:col-span-8 space-y-0">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="border-t border-foreground/10 py-8 grid grid-cols-[auto_auto_1fr] gap-5 items-start group"
              >
                <span className="text-3xl mt-1 group-hover:scale-110 transition-transform">{step.icon}</span>
                <span className="font-mono text-sm text-primary font-semibold pt-2">{step.num}</span>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed max-w-lg">{step.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
