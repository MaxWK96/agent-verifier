"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AgentClaimCard from "./AgentClaimCard";

export interface ClaimData {
  id:            string;
  agent:         string;
  agentType:     "trader" | "risk" | "checker";
  claim:         string;
  timestamp:     string;
  verdict?:      "TRUE" | "FALSE" | "PENDING";
  confidence?:   number;
  creSource?:    string;
  evidenceHash?: string;
  txHash?:       string; // full tx hash for Etherscan link
}

// ─── Fallback mock data (shown when API returns nothing yet) ─────────────────

const MOCK_CLAIMS: ClaimData[] = [
  {
    id: "1", agent: "LocalOracle", agentType: "trader",
    claim: "ETH will exceed $4,200 by end of week based on momentum indicators.",
    timestamp: "2 min ago", verdict: "FALSE", confidence: 94,
    creSource: "CRE Price Feed (ETH/USD)", evidenceHash: "0x7a3f...c91d",
  },
  {
    id: "2", agent: "WeatherBot_SE", agentType: "trader",
    claim: "Stockholm precipitation probability >80% next 48h — flooding risk elevated.",
    timestamp: "5 min ago", verdict: "TRUE", confidence: 87,
    creSource: "CRE Weather API Consensus", evidenceHash: "0x4b2e...a83f",
  },
  {
    id: "3", agent: "DeRisk_v2", agentType: "risk",
    claim: "Aave V3 TVL dropped 34% in 6h — circuit breaker threshold approaching.",
    timestamp: "8 min ago", verdict: "TRUE", confidence: 91,
    creSource: "CRE DeFi TVL Oracle", evidenceHash: "0x9c1d...f47b",
  },
  {
    id: "4", agent: "AlphaSeeker", agentType: "trader",
    claim: "BTC dominance will flip below 40% within 72 hours.",
    timestamp: "12 min ago", verdict: "FALSE", confidence: 96,
    creSource: "CRE Market Cap Feed", evidenceHash: "0x2f8a...d62c",
  },
  {
    id: "5", agent: "LocalOracle", agentType: "trader",
    claim: "Placed YES on SOL/USD >$180 — CRE consensus 78%, edge 15pp over market.",
    timestamp: "18 min ago", verdict: "PENDING",
  },
  {
    id: "6", agent: "GasTracker", agentType: "risk",
    claim: "Ethereum gas fees will spike above 100 gwei in next 2 hours due to NFT mint.",
    timestamp: "22 min ago", verdict: "TRUE", confidence: 82,
    creSource: "CRE Gas Oracle + Event Monitor", evidenceHash: "0x6e3b...a19f",
  },
];

// ─── Real-data helpers ────────────────────────────────────────────────────────

interface ApiVerdict {
  postId:       string;
  agentName:    string;
  claimText:    string;
  verdict:      string;
  confidence:   number;
  source:       string;
  currentValue: number | null;
  txHash:       string;
  timestamp:    string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ZERO_HASH = "0x" + "0".repeat(64);

function toClaimData(v: ApiVerdict): ClaimData {
  const verdict: ClaimData["verdict"] =
    v.verdict === "TRUE"  ? "TRUE"    :
    v.verdict === "FALSE" ? "FALSE"   : "PENDING";

  const agentType: ClaimData["agentType"] =
    v.source === "DeFi Llama" || v.source === "Ethereum RPC" ? "risk"    :
    v.source === "OpenWeatherMap"                             ? "trader"  : "checker";

  const hash = v.txHash !== ZERO_HASH
    ? `${v.txHash.slice(0, 6)}...${v.txHash.slice(-4)}`
    : undefined;

  return {
    id:           v.postId,
    agent:        v.agentName,
    agentType,
    claim:        v.claimText.slice(0, 200),
    timestamp:    relativeTime(v.timestamp),
    verdict,
    confidence:   v.confidence,
    creSource:    v.source,
    evidenceHash: hash,
    txHash:       v.txHash !== ZERO_HASH ? v.txHash : undefined,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

const LiveFeed = () => {
  const [claims,       setClaims]       = useState<ClaimData[]>([]);
  const [visibleCount, setVisibleCount] = useState(2);
  const [liveData,     setLiveData]     = useState(false);

  // Fetch real verdicts; fall back to mocks if empty
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch("/api/verdicts");
        const data = await res.json() as { verdicts?: ApiVerdict[] };
        if (data.verdicts && data.verdicts.length > 0) {
          setClaims(data.verdicts.map(toClaimData));
          setVisibleCount(data.verdicts.length); // show all real verdicts at once
          setLiveData(true);
        } else {
          setClaims(MOCK_CLAIMS);
        }
      } catch {
        setClaims(MOCK_CLAIMS);
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  // Progressive reveal only for mock data
  useEffect(() => {
    if (!liveData && visibleCount < claims.length) {
      const t = setTimeout(() => setVisibleCount((c) => c + 1), 2200);
      return () => clearTimeout(t);
    }
  }, [visibleCount, claims.length, liveData]);

  const visible = liveData ? claims : claims.slice(0, visibleCount);

  return (
    <section className="relative py-28 md:py-36 px-6 section-dark overflow-hidden" id="live-feed">
      <div className="absolute top-[10%] right-[-5%] w-[300px] h-[300px] rounded-full bg-primary/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-5%] w-[250px] h-[250px] rounded-full bg-secondary/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid md:grid-cols-12 gap-12">

          {/* Sticky legend */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="md:col-span-4"
          >
            <div className="md:sticky md:top-24">
              <div className="inline-flex items-center gap-2 mb-4">
                <span className={`w-2.5 h-2.5 rounded-full ${liveData ? "bg-success animate-pulse" : "bg-warning"}`} />
                <span className={`text-xs font-mono font-semibold tracking-wider uppercase ${liveData ? "text-success" : "text-warning"}`}>
                  {liveData ? "Live" : "Demo"}
                </span>
              </div>
              <h2 className="text-4xl md:text-6xl font-serif leading-[1.05] mb-4">
                Agent
                <br />
                <span className="italic text-primary">verdicts</span>
              </h2>
              <p className="text-background/60 leading-relaxed text-sm">
                {liveData
                  ? "Verified claims from the Moltbook agent network. Each verdict links to CRE oracle data and on-chain proof."
                  : "Real-time claim verification from the Moltbook agent network. Each verdict links back to CRE oracle data and on-chain proof."}
              </p>

              <div className="mt-8 space-y-3 font-mono text-xs">
                {[
                  { color: "bg-success",     label: "TRUE — oracle confirms claim"  },
                  { color: "bg-destructive",  label: "FALSE — oracle contradicts"   },
                  { color: "bg-warning",      label: "PENDING — verifying..."       },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-sm ${item.color}`} />
                    <span className="text-background/50">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Cards */}
          <div className="md:col-span-8 space-y-3">
            <AnimatePresence>
              {visible.map((claim, i) => (
                <AgentClaimCard key={`${claim.id}-${i}`} claim={claim} darkMode />
              ))}
            </AnimatePresence>

            {visible.length === 0 && (
              <div className="text-background/40 font-mono text-sm py-12 text-center">
                No verdicts yet — run{" "}
                <code className="bg-background/10 px-1.5 py-0.5 rounded">npm run agent:demo</code>{" "}
                to populate the feed.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiveFeed;
