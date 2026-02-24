/**
 * Register the CRE Fact-Checker agent on Moltbook and save the API key to .env
 *
 * Usage:  npm run register
 */
import "dotenv/config";
import * as fs   from "fs";
import * as path from "path";

interface AgentPayload {
  api_key?:   string;
  apiKey?:    string;
  name?:      string;
  username?:  string;
  claim_url?: string;
  claimUrl?:  string;
  [key: string]: unknown;
}

interface RegisterResponse {
  // Flat structure
  api_key?:   string;
  apiKey?:    string;
  claim_url?: string;
  claimUrl?:  string;
  // Nested under "agent"
  agent?:     AgentPayload;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  console.log("Registering CRE Fact-Checker on Moltbook…\n");

  const res = await fetch("https://www.moltbook.com/api/v1/agents/register", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name:        "CRE-FactChecker",
      description: "Verifies agent claims using Chainlink CRE oracles. Posts verdicts with on-chain proof.",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Moltbook registration failed ${res.status}: ${body}`);
  }

  const data: RegisterResponse = await res.json();
  console.log("Raw response:", JSON.stringify(data, null, 2));

  // API nests the payload under "agent" key
  const agent    = data.agent ?? data;
  const apiKey   = agent.api_key  ?? agent.apiKey  ?? data.api_key  ?? data.apiKey;
  const claimUrl = agent.claim_url ?? agent.claimUrl ?? data.claim_url ?? data.claimUrl;
  const agentName = agent.name ?? agent.username ?? "cre-factchecker";

  if (!apiKey) {
    throw new Error(
      "No api_key found in response. Searched data.api_key and data.agent.api_key.\n" +
        "Raw response logged above."
    );
  }

  // ── Write to .env ──────────────────────────────────────────────────────────
  const envPath = path.join(process.cwd(), ".env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  function upsertEnv(content: string, key: string, value: string): string {
    const line = `${key}=${value}`;
    if (content.includes(`${key}=`)) {
      return content.replace(new RegExp(`${key}=.*`), line);
    }
    return content.trimEnd() + `\n${line}\n`;
  }

  envContent = upsertEnv(envContent, "MOLTBOOK_API_KEY",    apiKey);
  envContent = upsertEnv(envContent, "MOLTBOOK_AGENT_NAME", agentName);

  fs.writeFileSync(envPath, envContent, "utf-8");

  // ── Output ─────────────────────────────────────────────────────────────────
  console.log("\n✅  Registration successful!");
  console.log(`    MOLTBOOK_API_KEY   → .env: ${apiKey.slice(0, 8)}…`);
  console.log(`    MOLTBOOK_AGENT_NAME → .env: ${agentName}`);

  if (claimUrl) {
    console.log("\n🔗  Claim your agent on X/Twitter:");
    console.log(`    ${claimUrl}`);
    console.log(
      "\n    Open the URL above in your browser, connect your X account,\n" +
        "    and post the verification tweet to prove ownership."
    );
  } else {
    console.log("\n⚠  No claim_url returned. Check Moltbook docs for manual verification.");
  }
}

main().catch((err) => {
  console.error("\n✗ Registration error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
