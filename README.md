# CRE Fact-Checker Agent

AI-powered claim verifier for Moltbook's `m/chainlink-official` submolt.
Fetches posts, verifies price/weather/DeFi claims against real data sources, stores verdicts on-chain via Sepolia, and posts fact-check comments back to Moltbook.

**Live frontend:** https://cre-fact-checker.vercel.app/
**Agent profile:** https://www.moltbook.com/u/cre-factchecker
**Contract:** https://sepolia.etherscan.io/address/0xff687eC2191d3EE6DDF28Ee806B45c8D837C128E
**Demo video:** https://www.youtube.com/watch?v=oIMdGOnCmoc

---

## The problem your project addresses

Autonomous agents post unverifiable price predictions and market claims on social platforms. There is no trustless, on-chain mechanism to audit whether these claims are TRUE or FALSE at the time they are made. Without a verifiable, timestamped record, a wrong prediction silently disappears — no accountability exists for agent-generated content.

## How you've addressed the problem

A CRE TypeScript workflow fetches the live ETH/USD price from CoinGecko via CRE's HTTP capability, evaluates it against a $3,500 threshold (the claim being verified), computes a verdict hash, and writes it to a `VerdictRegistry` smart contract on Sepolia via CRE's on-chain write capability. The workflow calls `storeVerdict(bytes32 verdictHash, string verdict)` on-chain — the verdict hash is `keccak256(abi.encodePacked(postId, verdict, confidence, timestamp))` — creating an immutable, verifiable record of every fact-check. A Next.js frontend displays live verdicts from a Moltbook social feed alongside Etherscan proof links.

## How you've used CRE

**Demo video:** https://www.youtube.com/watch?v=oIMdGOnCmoc

The CRE workflow (`cre-workflow/main.ts`) uses four CRE capabilities:

- **HTTPClient** — fetches live ETH/USD price from CoinGecko (`api.coingecko.com`) inside the DON's sandboxed WASM environment
- **CronCapability** — triggers the workflow on a schedule (every 5 minutes)
- **EVMClient + runtime.report()** — generates a DON-signed consensus report and submits it on-chain to VerdictRegistry on Sepolia
- **ConsensusAggregationByFields with `median` reducer** — multiple DON nodes independently fetch the price and agree on the median before any on-chain write, making the result manipulation-resistant

---

## Chainlink Integration Files

| File | Purpose |
|---|---|
| `cre-workflow/main.ts` | CRE workflow — HTTP fetch + on-chain write |
| `cre-workflow/workflow.yaml` | CRE configuration (schedule, targets) |
| `cre-workflow/config.json` | Runtime config (threshold, contract address, chain) |
| `contracts/VerdictRegistry.sol` | On-chain verdict storage (Sepolia) |

---

## How to Run CRE Simulation

Requires CRE CLI: https://docs.chain.link/chainlink-nodes/cre/getting-started/cli-installation

```bash
# 1. Install root dependencies
npm install

# 2. Install CRE workflow dependencies
#    (postinstall auto-copies the Javy WASM plugin — no manual step needed)
cd cre-workflow && npm install && cd ..

# 3. Create project.yaml from the example and add your Alchemy Sepolia RPC URL
cp project.yaml.example project.yaml
#    Open project.yaml and replace YOUR_ALCHEMY_KEY_HERE with your key
#    e.g. https://eth-sepolia.g.alchemy.com/v2/<your_key>
#    Get a free key at https://dashboard.alchemy.com

# 4. Run simulation (dry-run, no broadcast)
cre workflow simulate ./cre-workflow --non-interactive --trigger-index 0 -T staging-settings

# 5. Run with on-chain broadcast (produces real tx hash)
#    Requires CRE_ETH_PRIVATE_KEY environment variable
CRE_ETH_PRIVATE_KEY=<your_sepolia_key> cre workflow simulate ./cre-workflow --non-interactive --trigger-index 0 -T staging-settings --broadcast
```

> Run all commands from the repository root (where `project.yaml` lives).
> Install the CRE CLI first: https://github.com/smartcontractkit/cre-cli/releases

**Evidence of successful simulation:**
- Transaction hash: `0x7cfe49b0ad11c9241e8bece2b299b220d07a8468dedf2d5b8c9bb11fba58d95d`
- Etherscan: https://sepolia.etherscan.io/tx/0x7cfe49b0ad11c9241e8bece2b299b220d07a8468dedf2d5b8c9bb11fba58d95d

---

## CRE Capabilities Used

| Capability | Usage |
|---|---|
| **HTTPClient** | Fetches live ETH/USD price from CoinGecko (`api.coingecko.com`) |
| **CronCapability** | Triggers the workflow every 5 minutes |
| **EVMClient + runtime.report()** | Generates signed consensus report and writes on-chain |
| **ConsensusAggregationByFields** | `median` reducer ensures DON-consensus-safe price data |

---

## Oracle Data Sources

| Source | Data | Used for |
|---|---|---|
| CoinGecko | ETH/USD spot price | Price claim verification |
| OpenWeatherMap | Precipitation probability | Weather claim verification |
| DeFi Llama | Protocol TVL | DeFi/risk claim verification |
| Ethereum RPC | Gas price | Gas fee claim verification |

---

## Moltbook Integration

- **Agent profile:** https://www.moltbook.com/u/cre-factchecker
- **Live frontend:** https://cre-fact-checker.vercel.app/
- **Contract:** https://sepolia.etherscan.io/address/0xff687eC2191d3EE6DDF28Ee806B45c8D837C128E

The agent monitors `m/chainlink-official`, extracts verifiable claims, posts verdict comments with on-chain proof links, and syncs results to JSONBin for the live frontend.

---

## Stack

| Layer | Tech |
|---|---|
| **CRE workflow** | TypeScript, `@chainlink/cre-sdk`, CronCapability, HTTPClient, EVMClient |
| **Agent runtime** | Node.js + TypeScript (tsx) |
| **Claim verification** | CoinGecko, OpenWeatherMap, DeFi Llama, Ethereum RPC |
| **On-chain proof** | `VerdictRegistry.sol` (Sepolia) — direct via ethers v6, CRE via writeReport |
| **Agent registry** | Moltbook API |
| **Frontend live feed** | Next.js 15 + Tailwind v3 + Framer Motion |
| **Contract tooling** | Hardhat + Solc 0.8.19 |

---

## Quick Start (Full Agent)

### 1. Fill in environment variables

```bash
cp .env.example .env
# Edit .env — add PRIVATE_KEY, NEXT_PUBLIC_RPC_URL, OPENWEATHER_API_KEY
```

### 2. Register the Moltbook agent (one-time)

```bash
npm run register
```

### 3. Deploy VerdictRegistry to Sepolia

```bash
npm run compile          # compile the contract
npm run deploy:contract  # deploy to Sepolia, saves address to .env
```

> Wallet needs Sepolia ETH — faucets: https://sepoliafaucet.com

### 4. Run the agent

```bash
npm run agent            # polls every 10 minutes
npm run agent:once       # single run
npm run agent:demo       # demo mode — posts test claims to Moltbook
```

### 5. View the live feed

```bash
npm run dev              # Next.js dev server at http://localhost:3000
```

---

## Architecture

```
Moltbook feed (m/chainlink-official)
         │
         ▼
  claimParser.ts  ──► extractClaims()
         │
         ▼
  creVerifier.ts  ──► CoinGecko / OpenWeatherMap / DeFi Llama
         │
         ▼
  onChainProof.ts ──► VerdictRegistry.storeVerdict() on Sepolia
         │
         ▼
moltbookPublisher.ts ──► POST comment to Moltbook
         │
         ▼
  memory/verdicts.json  ──► GET /api/verdicts  ──► Next.js live feed

CRE Workflow (parallel path):
  cre-workflow/main.ts
    ├── HTTPClient → CoinGecko ETH/USD
    ├── Evaluate threshold (ETH > $3,500)
    ├── Compute verdict hash (keccak256)
    └── EVMClient.writeReport() → VerdictRegistry on Sepolia
```

## Environment Variables

| Variable | Description |
|---|---|
| `MOLTBOOK_API_KEY` | Set by `npm run register` |
| `OPENWEATHER_API_KEY` | From openweathermap.org (free tier) |
| `PRIVATE_KEY` | Sepolia wallet key (with or without 0x) |
| `NEXT_PUBLIC_RPC_URL` | Alchemy/Infura Sepolia endpoint |
| `VERDICT_REGISTRY_ADDRESS` | Set by `npm run deploy:contract` |
| `COINGECKO_API_KEY` | Optional — free tier works without it |
| `JSONBIN_BIN_ID` | JSONBin bin ID for Vercel-accessible verdict storage |
| `JSONBIN_API_KEY` | JSONBin master key |
