"use client";

import { motion } from "framer-motion";

const TX_HASH = "0x40caf7a8426b850e5901777d8044afbc18e45096c97a157ff5c5ba0d8c9ad770";
const TX_SHORT = `${TX_HASH.slice(0, 8)}...${TX_HASH.slice(-4)}`;
const ETHERSCAN = `https://sepolia.etherscan.io/tx/${TX_HASH}`;

const nodes = [
  {
    num:     "①",
    label:   "HTTP Fetch",
    detail:  "CoinGecko ETH/USD",
    sub:     "via CRE HTTPClient",
    color:   "border-secondary/60 bg-secondary/10",
    dot:     "bg-secondary",
    numColor:"text-secondary",
  },
  {
    num:     "②",
    label:   "Evaluate",
    detail:  "ETH > $3,500?",
    sub:     "threshold comparison",
    color:   "border-primary/60 bg-primary/10",
    dot:     "bg-primary",
    numColor:"text-primary",
  },
  {
    num:     "③",
    label:   "Compute",
    detail:  "Verdict hash",
    sub:     "keccak256(postId + verdict + confidence)",
    color:   "border-accent/60 bg-accent/10",
    dot:     "bg-accent",
    numColor:"text-accent",
  },
  {
    num:     "④",
    label:   "On-chain Write",
    detail:  "VerdictRegistry.sol",
    sub:     "Sepolia via EVMClient",
    color:   "border-success/60 bg-success/10",
    dot:     "bg-success",
    numColor:"text-success",
  },
];

const CREWorkflow = () => {
  return (
    <section className="relative py-28 md:py-36 px-6 section-dark overflow-hidden" id="cre-workflow">
      {/* background blobs */}
      <div className="absolute top-[5%] left-[10%] w-[280px] h-[280px] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[5%] right-[5%] w-[220px] h-[220px] rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14 md:mb-20"
        >
          <span className="font-mono text-xs text-primary tracking-wider uppercase font-semibold">
            Chainlink CRE
          </span>
          <h2 className="text-4xl md:text-6xl font-serif mt-3 leading-[1.05] text-background">
            Powered by
            <br />
            <span className="italic text-primary">Chainlink CRE</span>
          </h2>
          <p className="text-background/60 mt-4 leading-relaxed text-sm max-w-md">
            Every verdict is produced by a CRE workflow — not a chatbot.
          </p>
        </motion.div>

        {/* Workflow nodes */}
        <div className="flex flex-col md:flex-row items-stretch gap-0 md:gap-0 mb-14">
          {nodes.map((node, i) => (
            <div key={node.num} className="flex flex-col md:flex-row items-center flex-1 min-w-0">

              {/* Node card */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.45 }}
                className={`w-full border-2 ${node.color} rounded-2xl p-5 md:p-6 flex flex-col gap-2 hover:scale-[1.03] transition-transform duration-300`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${node.dot} flex-shrink-0`} />
                  <span className={`font-mono text-xs tracking-wider uppercase font-semibold ${node.numColor}`}>
                    Step {node.num}
                  </span>
                </div>
                <p className="text-background font-semibold text-base leading-tight">{node.label}</p>
                <p className="text-background/80 text-sm font-medium">{node.detail}</p>
                <p className="text-background/45 text-xs font-mono leading-snug">{node.sub}</p>
              </motion.div>

              {/* Arrow between nodes */}
              {i < nodes.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 + 0.25 }}
                  className="flex-shrink-0 flex items-center justify-center
                             md:w-10 md:h-auto h-8 w-auto
                             text-primary/60 font-mono font-bold text-xl
                             rotate-90 md:rotate-0"
                >
                  →
                </motion.div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom bar: sim command + etherscan link */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10
                     border border-background/10 rounded-2xl px-6 py-5 bg-background/5"
        >
          {/* Simulation command */}
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[11px] text-background/40 uppercase tracking-wider mb-2">
              Simulation command
            </p>
            <code className="block bg-background/10 border border-background/15 rounded-lg px-4 py-2.5
                             font-mono text-xs text-background/85 leading-relaxed break-all md:break-normal">
              cre workflow simulate ./cre-workflow --non-interactive --trigger-index 0
            </code>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-12 bg-background/15 flex-shrink-0" />

          {/* Latest tx */}
          <div className="flex-shrink-0">
            <p className="font-mono text-[11px] text-background/40 uppercase tracking-wider mb-2">
              Latest simulation
            </p>
            <a
              href={ETHERSCAN}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary/80
                         transition-colors underline underline-offset-2"
            >
              {TX_SHORT} ↗
            </a>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default CREWorkflow;
