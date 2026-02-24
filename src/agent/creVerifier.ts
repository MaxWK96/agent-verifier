import type { ParsedClaim } from "./claimParser";

export interface VerificationResult {
  verdict: "TRUE" | "FALSE" | "UNVERIFIABLE";
  confidence: number; // 0-99
  source: string;
  currentValue: number | null;
  details: string;
}

// CoinGecko asset IDs
const ASSET_IDS: Record<string, string> = {
  ETH: "ethereum",
  BTC: "bitcoin",
  SOL: "solana",
  BNB: "binancecoin",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
};

// ─── Price ────────────────────────────────────────────────────────────────────

async function verifyPriceClaim(claim: ParsedClaim): Promise<VerificationResult> {
  if (!claim.asset || claim.extractedValue === null) {
    return unverifiable("CoinGecko", "Could not extract price threshold from claim");
  }

  const coinId = ASSET_IDS[claim.asset];
  if (!coinId) {
    return unverifiable("CoinGecko", `Unknown asset: ${claim.asset}`);
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const currentPrice: number | undefined = data[coinId]?.usd;

  if (currentPrice === undefined) {
    return unverifiable("CoinGecko", "Price data unavailable for " + claim.asset);
  }

  const claimed = claim.extractedValue;
  const diff = Math.abs(currentPrice - claimed) / claimed;
  const diffPct = diff * 100;

  // For "will exceed X" style claims: check if current price already exceeds
  // or is far enough below that it's clearly false.
  const isExceed = /exceed|above|over|surpass|greater|>/i.test(claim.claimText);

  let verdict: VerificationResult["verdict"];
  let confidence: number;

  if (isExceed) {
    if (currentPrice >= claimed) {
      // Already above claimed threshold → TRUE
      verdict = "TRUE";
      confidence = diffPct > 20 ? Math.min(99, 90 + diffPct / 10) : 82;
    } else if (diffPct > 20) {
      // Price is >20% below threshold → very unlikely in short term → FALSE
      verdict = "FALSE";
      confidence = Math.min(99, 85 + diffPct / 5);
    } else {
      // Within 20% — borderline
      verdict = "UNVERIFIABLE";
      confidence = Math.round(60 + diffPct * 0.8);
    }
  } else {
    verdict = "UNVERIFIABLE";
    confidence = 60;
  }

  return {
    verdict,
    confidence: Math.round(Math.min(99, confidence)),
    source: "CoinGecko",
    currentValue: currentPrice,
    details: `${claim.asset}/USD: $${currentPrice.toLocaleString("en-US")} | claimed threshold: $${claimed.toLocaleString("en-US")} | diff: ${diffPct.toFixed(1)}%`,
  };
}

// ─── Weather ──────────────────────────────────────────────────────────────────

/** Extract a city name that appears just before a weather term in the claim text. */
function extractCity(text: string): string {
  const match = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:precipitation|weather|rain|flooding|snow)/i
    .exec(text);
  return match ? match[1] : "Stockholm";
}

async function verifyWeatherClaim(claim: ParsedClaim): Promise<VerificationResult> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return unverifiable("OpenWeatherMap", "OPENWEATHER_API_KEY not configured");
  }

  const city = extractCity(claim.claimText);

  // Use 5-day/3-hour forecast endpoint — provides `pop` (probability of precipitation, 0-1)
  // cnt=16 covers the next 48 hours (16 × 3h periods)
  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${key}&units=metric&cnt=16`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeatherMap ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const list: Array<{ pop?: number }> = data.list ?? [];

  // Take the maximum precipitation probability over the forecast window
  const maxPop    = list.reduce((max, item) => Math.max(max, item.pop ?? 0), 0);
  const precipPct = Math.round(maxPop * 100);

  if (claim.extractedValue === null) {
    return unverifiable(
      "OpenWeatherMap",
      `Max precipitation probability (${city}, next 48h): ${precipPct}%`
    );
  }

  const claimed = claim.extractedValue;
  const diff    = Math.abs(precipPct - claimed);

  const verdict: VerificationResult["verdict"] =
    diff > 20 ? (precipPct >= claimed ? "TRUE" : "FALSE") : "UNVERIFIABLE";

  return {
    verdict,
    confidence:   diff > 20 ? 85 : 65,
    source:       "OpenWeatherMap",
    currentValue: precipPct,
    details:      `Max precipitation probability (${city}, next 48h): ${precipPct}% | claimed: ${claimed}%`,
  };
}

// ─── DeFi ────────────────────────────────────────────────────────────────────

async function verifyDefiClaim(claim: ParsedClaim): Promise<VerificationResult> {
  const isGas = /gas\s+fee/i.test(claim.claimText);

  // Gas claim
  if (isGas && claim.extractedValue !== null) {
    const rpcUrl =
      process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.ankr.com/eth";
    try {
      const rpcRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 }),
      });
      const rpcData = await rpcRes.json();
      const gweiRaw = parseInt(rpcData.result, 16);
      const currentGwei = gweiRaw / 1e9;
      const claimed = claim.extractedValue;
      const diffPct = Math.abs(currentGwei - claimed) / claimed * 100;

      return {
        verdict: diffPct > 20 ? (currentGwei >= claimed ? "TRUE" : "FALSE") : "UNVERIFIABLE",
        confidence: diffPct > 20 ? Math.min(99, 85 + diffPct / 5) : 65,
        source: "Ethereum RPC",
        currentValue: Math.round(currentGwei * 10) / 10,
        details: `Gas price: ${currentGwei.toFixed(1)} gwei | claimed: ${claimed} gwei`,
      };
    } catch {
      // Fall through to DeFi Llama
    }
  }

  // TVL claim
  const res = await fetch("https://api.llama.fi/protocols", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`DeFi Llama ${res.status}`);

  const protocols: Array<{ tvl?: number; change_1d?: number | null }> = await res.json();

  const withChange = protocols.filter((p) => typeof p.change_1d === "number");
  const avgChange1d =
    withChange.length > 0
      ? withChange.reduce((s, p) => s + (p.change_1d ?? 0), 0) / withChange.length
      : 0;

  if (claim.extractedValue !== null) {
    const claimedDrop = claim.extractedValue; // % drop claimed
    const actualDrop = Math.max(0, -avgChange1d); // actual drop (positive number)
    const diff = Math.abs(actualDrop - claimedDrop);

    return {
      verdict: diff > 20 ? (actualDrop >= claimedDrop ? "TRUE" : "FALSE") : "UNVERIFIABLE",
      confidence: diff > 20 ? 85 : 65,
      source: "DeFi Llama",
      currentValue: Math.round(avgChange1d * 100) / 100,
      details: `Avg 24h TVL Δ across ${withChange.length} protocols: ${avgChange1d.toFixed(2)}% | claimed drop: ${claimedDrop}%`,
    };
  }

  return unverifiable("DeFi Llama", "Could not extract claim value for verification");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unverifiable(source: string, details: string): VerificationResult {
  return { verdict: "UNVERIFIABLE", confidence: 55, source, currentValue: null, details };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function verifyClaim(claim: ParsedClaim): Promise<VerificationResult> {
  switch (claim.claimType) {
    case "price":   return verifyPriceClaim(claim);
    case "weather": return verifyWeatherClaim(claim);
    case "defi":    return verifyDefiClaim(claim);
    default:        return unverifiable("N/A", "Unknown claim type");
  }
}
