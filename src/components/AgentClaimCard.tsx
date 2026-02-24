"use client";

import { motion } from "framer-motion";
import type { ClaimData } from "./LiveFeed";

const AgentClaimCard = ({ claim, darkMode }: { claim: ClaimData; darkMode?: boolean }) => {
  const verdictColor: Record<string, string> = {
    TRUE:    "bg-success/20 text-success border-success/30",
    FALSE:   "bg-destructive/20 text-destructive border-destructive/30",
    PENDING: "bg-warning/20 text-warning border-warning/30",
  };

  const avatarColor: Record<string, string> = {
    trader:  "bg-secondary glow-secondary",
    risk:    "bg-primary glow-primary",
    checker: "bg-accent",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`rounded-xl border p-5 hover:scale-[1.01] transition-all duration-300 ${
        darkMode
          ? "border-background/10 bg-background/5 backdrop-blur-sm hover:bg-background/8"
          : "border-border bg-background hover:shadow-lg"
      }`}
    >
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg ${avatarColor[claim.agentType] ?? "bg-muted"} flex items-center justify-center text-[11px] font-mono font-bold text-primary-foreground`}
          >
            {claim.agent[0]?.toUpperCase()}
          </div>
          <div>
            <span className={`text-sm font-semibold ${darkMode ? "text-background" : "text-foreground"}`}>
              {claim.agent}
            </span>
            <span className={`ml-2 text-xs font-mono ${darkMode ? "text-background/40" : "text-muted-foreground"}`}>
              {claim.timestamp}
            </span>
          </div>
        </div>

        {claim.verdict && (
          <span
            className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold tracking-wide border ${verdictColor[claim.verdict] ?? ""}`}
          >
            {claim.verdict}{claim.confidence ? ` · ${claim.confidence}%` : ""}
          </span>
        )}
      </div>

      <p className={`text-sm leading-relaxed mb-3 ${darkMode ? "text-background/70" : "text-foreground/80"}`}>
        {claim.claim}
      </p>

      {claim.creSource && (
        <div
          className={`flex items-center gap-4 flex-wrap font-mono text-[11px] ${
            darkMode ? "text-background/40" : "text-muted-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary pulse-glow" />
            {claim.creSource}
          </span>
          {claim.evidenceHash && (
            claim.txHash ? (
              <a
                href={`https://sepolia.etherscan.io/tx/${claim.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline decoration-dotted underline-offset-2 transition-colors ${
                  darkMode ? "hover:text-background/70" : "hover:text-foreground"
                }`}
              >
                {claim.evidenceHash} ↗
              </a>
            ) : (
              <span
                className={`underline decoration-dotted underline-offset-2 ${
                  darkMode ? "text-background/40" : "text-muted-foreground"
                }`}
              >
                {claim.evidenceHash}
              </span>
            )
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AgentClaimCard;
