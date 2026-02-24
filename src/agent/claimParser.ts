import "dotenv/config";

export interface ParsedClaim {
  postId: string;
  agentName: string;
  claimType: "price" | "weather" | "defi" | "unknown";
  claimText: string;
  extractedValue: number | null;
  asset: string | null;
}

interface MoltbookPost {
  id: string;
  author: { name: string; username?: string };
  content: string;
  createdAt: string;
}

const PRICE_ASSETS = [
  "ETH", "BTC", "SOL", "BNB", "MATIC", "AVAX", "DOT", "LINK", "UNI", "AAVE",
];

function parsePriceClaim(content: string): { value: number | null; asset: string | null } {
  // "ETH will exceed $4,200", "BTC above $50k", "SOL/USD >$100"
  const pattern = new RegExp(
    `\\b(${PRICE_ASSETS.join("|")})(?:\\/USD)?\\b[^.!?\\n]*?` +
      `(?:will\\s+)?(?:exceed|above|over|surpass|greater\\s+than|>)\\s*\\$?([\\d,]+(?:\\.\\d+)?)[kKmM]?`,
    "gi"
  );
  const match = pattern.exec(content);
  if (match) {
    let raw = match[2].replace(/,/g, "");
    const suffix = content[match.index + match[0].length];
    const multiplier = suffix === "k" || suffix === "K" ? 1000 : suffix === "m" || suffix === "M" ? 1_000_000 : 1;
    return { asset: match[1].toUpperCase(), value: parseFloat(raw) * multiplier };
  }

  // Reverse: "$4200 for ETH"
  const rev = /\$([0-9,]+(?:\.\d+)?)\s*(?:for|on)?\s*(ETH|BTC|SOL|BNB|LINK)/gi;
  const rm = rev.exec(content);
  if (rm) return { value: parseFloat(rm[1].replace(/,/g, "")), asset: rm[2].toUpperCase() };

  return { value: null, asset: null };
}

function parseWeatherClaim(content: string): { value: number | null } {
  const p =
    /(?:precipitation|rain(?:fall)?|flooding|snow)\s*(?:probability|chance|risk|>|above|over)?\s*([0-9]+)\s*%|([0-9]+)\s*%\s*(?:chance|probability|risk|likelihood)\s*(?:of\s+)?(?:rain|snow|flooding|precipitation)/gi;
  const m = p.exec(content);
  if (m) return { value: parseFloat(m[1] ?? m[2]) };
  return { value: null };
}

function parseDefiClaim(content: string): { value: number | null } {
  const tvl = /TVL\s+(?:dropped|fell|decreased|down|fell\s+by)\s+([0-9]+(?:\.\d+)?)\s*%/gi;
  const gas = /gas\s+fees?\s+(?:above|over|exceed|exceeds)\s+([0-9]+(?:\.\d+)?)\s*gwei/gi;
  const tm = tvl.exec(content);
  if (tm) return { value: parseFloat(tm[1]) };
  const gm = gas.exec(content);
  if (gm) return { value: parseFloat(gm[1]) };
  return { value: null };
}

// ─── Hard pre-filter ─────────────────────────────────────────────────────────
// Post must contain at least one of these literal strings or it is skipped
// before any regex parsing runs. Prevents generic hackathon/discussion posts
// from ever entering the claim pipeline.

const PRE_FILTER_TOKENS = [
  "$", "USD", "ETH", "BTC", "SOL",
  "TVL", "%", "gwei",
  "precipitation", "flooding", "price",
] as const;

function passesPreFilter(content: string): boolean {
  return PRE_FILTER_TOKENS.some((tok) => content.includes(tok));
}

// ─── Gate functions — all must pass before we attempt extraction ──────────────

/** Price: must have a known asset token AND a "$number" AND an action verb */
function isExplicitPriceClaim(c: string): boolean {
  const hasAsset  = PRICE_ASSETS.some((a) => new RegExp(`\\b${a}\\b`, "i").test(c));
  const hasDollar = /\$[0-9]/.test(c);
  const hasVerb   = /\b(?:will\s+)?(?:exceed|reach|hit|surpass|above|below|under|over|drop\s+(?:to|below))\b/i.test(c);
  return hasAsset && hasDollar && hasVerb;
}

/** Weather: must have a number% AND a weather term (not just the word "weather") */
function isExplicitWeatherClaim(c: string): boolean {
  const hasPct     = /[0-9]+\s*%/.test(c);
  const hasWeather = /\b(?:precipitation|rain(?:fall)?|flooding|snow|humidity)\b/i.test(c);
  return hasPct && hasWeather;
}

/** DeFi: must have an explicit number/% AND TVL or gas keyword together */
function isExplicitDefiClaim(c: string): boolean {
  const hasTvlWithNum = /TVL\s+(?:dropped|fell|decreased|down|fell\s+by)\s+[0-9]/.test(c);
  const hasGasWithNum = /gas\s+fees?\s+(?:above|over|exceed|exceeds)\s+[0-9]+\s*gwei/i.test(c);
  return hasTvlWithNum || hasGasWithNum;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseClaim(post: MoltbookPost): ParsedClaim {
  const c    = post.content;
  const name = post.author.name ?? post.author.username ?? "unknown";

  // Hard pre-filter — reject immediately if no claim-relevant token present
  if (!passesPreFilter(c)) {
    return { postId: post.id, agentName: name, claimType: "unknown", claimText: c.slice(0, 280), extractedValue: null, asset: null };
  }

  // Price: "$X" + verb required
  if (isExplicitPriceClaim(c)) {
    const { value, asset } = parsePriceClaim(c);
    // Must have extracted a real value — if not, the pattern fired but regex failed, skip
    if (value !== null) {
      return { postId: post.id, agentName: name, claimType: "price",   claimText: c.slice(0, 280), extractedValue: value, asset };
    }
  }

  // Weather: number% + weather term required
  if (isExplicitWeatherClaim(c)) {
    const { value } = parseWeatherClaim(c);
    if (value !== null) {
      return { postId: post.id, agentName: name, claimType: "weather", claimText: c.slice(0, 280), extractedValue: value, asset: null };
    }
  }

  // DeFi: explicit "TVL dropped X%" or "gas fees above X gwei"
  if (isExplicitDefiClaim(c)) {
    const { value } = parseDefiClaim(c);
    if (value !== null) {
      return { postId: post.id, agentName: name, claimType: "defi",    claimText: c.slice(0, 280), extractedValue: value, asset: null };
    }
  }

  // Nothing matched — skip this post entirely
  return { postId: post.id, agentName: name, claimType: "unknown", claimText: c.slice(0, 280), extractedValue: null, asset: null };
}

const SUBMOLTS = [
  "chainlink-official",
  "crypto",
  "defi",
  "predictions",
];

async function fetchSubmolt(apiKey: string, submolt: string): Promise<MoltbookPost[]> {
  const url = `https://www.moltbook.com/api/v1/posts?sort=new&limit=25&submolt=${submolt}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  });

  if (!res.ok) {
    // Non-fatal: log and return empty so other submolts still run
    console.warn(`  ⚠ m/${submolt} fetch failed (${res.status}) — skipping`);
    return [];
  }

  const data = await res.json();
  const posts: MoltbookPost[] = Array.isArray(data) ? data : (data.posts ?? data.data ?? []);

  // Tag each post with its source submolt for logging
  return posts.map((p) => ({ ...p, _submolt: submolt }));
}

export async function fetchMoltbookPosts(): Promise<MoltbookPost[]> {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) throw new Error("MOLTBOOK_API_KEY not set — run: npm run register");

  const results = await Promise.allSettled(
    SUBMOLTS.map((s) => fetchSubmolt(apiKey, s))
  );

  const all: MoltbookPost[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    if (r.status === "rejected") continue;
    for (const post of r.value) {
      if (!seen.has(post.id)) {
        seen.add(post.id);
        all.push(post);
      }
    }
  }

  return all;
}

export function extractClaims(posts: MoltbookPost[]): ParsedClaim[] {
  return posts.map(parseClaim).filter((c) => c.claimType !== "unknown");
}
