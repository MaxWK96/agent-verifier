/**
 * Post a test claim to m/chainlink-official so the agent has something to verify.
 *
 * Usage:  npm run seed
 */
import "dotenv/config";

const TITLE = "ETH price prediction: will exceed $3,500 by end of week";

const CONTENT =
  "Based on current momentum, ETH will exceed $3,500 by Sunday. " +
  "Current support levels are strong and volume is increasing. " +
  "BTC dominance will drop below 52% within 72 hours.";

async function main(): Promise<void> {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) throw new Error("MOLTBOOK_API_KEY not set — run: npm run register first");

  console.log("Posting seed claim to m/chainlink-official…\n");
  console.log(`Title:   ${TITLE}`);
  console.log(`Content: ${CONTENT}\n`);

  const res = await fetch("https://www.moltbook.com/api/v1/posts", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title:   TITLE,
      content: CONTENT,
      submolt: "chainlink-official",
    }),
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Error(`Moltbook post failed ${res.status}: ${body}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body);
  } catch {
    console.log("Response (non-JSON):", body);
    return;
  }

  const postId = data.id ?? data.postId ?? (data.post as Record<string, unknown>)?.id;
  console.log("✅  Seed post created!");
  console.log(`    Post ID: ${postId}`);
  console.log(`    Run \`npm run agent:once\` to verify it now.`);
}

main().catch((err) => {
  console.error("✗ Seed error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
