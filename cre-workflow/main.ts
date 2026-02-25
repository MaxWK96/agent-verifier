/**
 * CRE Fact-Checker Workflow
 * Chainlink Convergence Hackathon 2026
 *
 * Pipeline:
 * 1. Fetch ETH/USD price from CoinGecko via CRE HTTP capability
 * 2. Evaluate claim: "ETH will exceed $3,500 by end of week"
 * 3. Compute verdict (TRUE / FALSE) + confidence score
 * 4. Write verdict hash to VerdictRegistry.sol on Sepolia via CRE on-chain write
 */

import {
  bytesToHex,
  ConsensusAggregationByFields,
  type CronPayload,
  handler,
  CronCapability,
  EVMClient,
  HTTPClient,
  type HTTPSendRequester,
  encodeCallMsg,
  getNetwork,
  hexToBase64,
  median,
  Runner,
  type Runtime,
  TxStatus,
} from '@chainlink/cre-sdk'
import { type Address, encodeFunctionData, keccak256, encodePacked, zeroAddress } from 'viem'
import { z } from 'zod'

// ============================================================================
// ABI
// ============================================================================

const VerdictRegistryABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'verdictHash', type: 'bytes32' },
      { internalType: 'string', name: 'verdict', type: 'string' },
    ],
    name: 'storeVerdict',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// ============================================================================
// Config Schema
// ============================================================================

const configSchema = z.object({
  schedule: z.string(),
  registryAddress: z.string(),
  ethThreshold: z.number(),
  postId: z.string(),
  evms: z.array(
    z.object({
      chainSelectorName: z.string(),
      gasLimit: z.string(),
    }),
  ),
})

type Config = z.infer<typeof configSchema>

// ============================================================================
// Types
// ============================================================================

interface EthPriceResult {
  ethPrice: number
}

interface VerdictResult {
  verdict: string      // "TRUE" | "FALSE" | "UNVERIFIABLE"
  confidence: number   // 0-100
  ethPrice: number
}

// ============================================================================
// Step 1: Fetch ETH/USD from CoinGecko via CRE HTTP
// ============================================================================

const fetchEthPrice = (sendRequester: HTTPSendRequester, _config: Config): EthPriceResult => {
  const resp = sendRequester
    .sendRequest({
      method: 'GET',
      url: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    })
    .result()

  if (resp.statusCode !== 200) {
    return { ethPrice: 0 }
  }

  const raw = Buffer.from(resp.body).toString('utf-8')
  const data = JSON.parse(raw) as { ethereum?: { usd?: number } }
  const ethPrice = data.ethereum?.usd ?? 0

  return { ethPrice }
}

// ============================================================================
// Step 2: Evaluate Claim
// Returns verdict + confidence based on distance from threshold.
// ============================================================================

const evaluateClaim = (ethPrice: number, threshold: number): VerdictResult => {
  if (ethPrice === 0) {
    return { verdict: 'UNVERIFIABLE', confidence: 0, ethPrice }
  }

  const isAbove = ethPrice > threshold

  // Confidence scales with distance from threshold (capped at 99%).
  // Within 1% of threshold → ~50% confidence; 10%+ away → ~95%+ confidence.
  const distancePct = Math.abs(ethPrice - threshold) / threshold
  const confidence = Math.min(99, Math.round(50 + distancePct * 500))

  return {
    verdict: isAbove ? 'TRUE' : 'FALSE',
    confidence,
    ethPrice,
  }
}

// ============================================================================
// Step 3: Compute Verdict Hash
// Matches formula in src/agent/onChainProof.ts:
//   keccak256(abi.encodePacked(postId, verdict, confidence, timestamp))
// ============================================================================

const computeVerdictHash = (
  postId: string,
  verdict: string,
  confidence: number,
  timestamp: number,
): `0x${string}` => {
  return keccak256(
    encodePacked(
      ['string', 'string', 'uint256', 'uint256'],
      [postId, verdict, BigInt(Math.round(confidence)), BigInt(timestamp)],
    ),
  )
}

// ============================================================================
// Step 4: Write Verdict On-Chain via CRE
// ============================================================================

const writeVerdictOnChain = (
  runtime: Runtime<Config>,
  verdictHash: `0x${string}`,
  verdict: string,
): string => {
  const evmConfig = runtime.config.evms[0]

  const network = getNetwork({
    chainFamily: 'evm',
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  })

  if (!network) {
    throw new Error(`Network not found: ${evmConfig.chainSelectorName}`)
  }

  const evmClient = new EVMClient(network.chainSelector.selector)

  // Encode storeVerdict(bytes32 verdictHash, string verdict)
  const callData = encodeFunctionData({
    abi: VerdictRegistryABI,
    functionName: 'storeVerdict',
    args: [verdictHash, verdict],
  })

  runtime.log(`  Encoding storeVerdict(${verdictHash.slice(0, 10)}..., "${verdict}")`)

  // Generate signed consensus report
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(callData),
      encoderName: 'evm',
      signingAlgo: 'ecdsa',
      hashingAlgo: 'keccak256',
    })
    .result()

  // Submit report to VerdictRegistry
  const resp = evmClient
    .writeReport(runtime, {
      receiver: runtime.config.registryAddress as Address,
      report: reportResponse,
      gasConfig: {
        gasLimit: evmConfig.gasLimit,
      },
    })
    .result()

  if (resp.txStatus !== TxStatus.SUCCESS) {
    throw new Error(`On-chain write failed: ${resp.errorMessage ?? resp.txStatus}`)
  }

  const txHash = bytesToHex(resp.txHash ?? new Uint8Array(32))
  runtime.log(`  On-chain write successful. TxHash: ${txHash}`)

  return txHash
}

// ============================================================================
// Main Fact-Check Pipeline
// ============================================================================

const runFactCheck = (runtime: Runtime<Config>): string => {
  runtime.log('================================================')
  runtime.log('  CRE Fact-Checker - ETH Price Claim Verifier  ')
  runtime.log('  Chainlink Convergence Hackathon 2026          ')
  runtime.log('================================================')

  const { ethThreshold, postId } = runtime.config
  const claim = `ETH will exceed $${ethThreshold.toLocaleString()} by end of week`

  runtime.log(`  Claim:     "${claim}"`)
  runtime.log(`  PostID:    ${postId}`)
  runtime.log(`  Threshold: $${ethThreshold.toLocaleString()}`)
  runtime.log('')

  // ---- Step 1: Fetch ETH/USD price ----
  runtime.log('[1/3] Fetching ETH/USD price from CoinGecko via CRE HTTP...')

  const httpClient = new HTTPClient()

  const priceResult = httpClient
    .sendRequest(
      runtime,
      fetchEthPrice,
      ConsensusAggregationByFields<EthPriceResult>({
        ethPrice: median,
      }),
    )(runtime.config)
    .result()

  runtime.log(`  ETH/USD: $${priceResult.ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

  // ---- Step 2: Evaluate claim ----
  runtime.log('')
  runtime.log('[2/3] Evaluating claim...')

  const { verdict, confidence, ethPrice } = evaluateClaim(priceResult.ethPrice, ethThreshold)

  runtime.log(`  ETH Price:  $${ethPrice.toFixed(2)}`)
  runtime.log(`  Threshold:  $${ethThreshold.toLocaleString()}`)
  runtime.log(`  Verdict:    ${verdict}`)
  runtime.log(`  Confidence: ${confidence}%`)
  runtime.log(`  Reasoning:  ETH is ${ethPrice > ethThreshold ? 'ABOVE' : 'BELOW'} the $${ethThreshold} threshold`)

  // ---- Step 3: Write verdict on-chain ----
  runtime.log('')
  runtime.log('[3/3] Writing verdict hash to VerdictRegistry on Sepolia...')
  runtime.log(`  Registry: ${runtime.config.registryAddress}`)

  const timestamp = Math.floor(Date.now() / 1000)
  const verdictHash = computeVerdictHash(postId, verdict, confidence, timestamp)

  runtime.log(`  VerdictHash: ${verdictHash}`)
  runtime.log(`  Timestamp:   ${timestamp}`)

  const txHash = writeVerdictOnChain(runtime, verdictHash, verdict)

  // ---- Summary ----
  runtime.log('')
  runtime.log('================================================')
  runtime.log('  FACT-CHECK COMPLETE')
  runtime.log(`  Claim:       "${claim}"`)
  runtime.log(`  ETH Price:   $${ethPrice.toFixed(2)}`)
  runtime.log(`  Verdict:     ${verdict}`)
  runtime.log(`  Confidence:  ${confidence}%`)
  runtime.log(`  VerdictHash: ${verdictHash}`)
  runtime.log(`  TxHash:      ${txHash}`)
  runtime.log(`  Etherscan:   https://sepolia.etherscan.io/tx/${txHash}`)
  runtime.log('================================================')

  return `${verdict}|${confidence}|${txHash}`
}

// ============================================================================
// Trigger Handler
// ============================================================================

const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
  if (!payload.scheduledExecutionTime) {
    throw new Error('Scheduled execution time is required')
  }
  runtime.log(`Cron triggered at: ${new Date().toISOString()}`)
  return runFactCheck(runtime)
}

// ============================================================================
// Workflow Initialization
// ============================================================================

const initWorkflow = (config: Config) => {
  const cronTrigger = new CronCapability()

  return [
    handler(
      cronTrigger.trigger({
        schedule: config.schedule,
      }),
      onCronTrigger,
    ),
  ]
}

export async function main() {
  const runner = await Runner.newRunner<Config>({
    configSchema,
  })
  await runner.run(initWorkflow)
}
