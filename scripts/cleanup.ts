/**
 * Delete all posts AND comments by cre-factchecker from m/chainlink-official.
 *
 * Steps:
 *  1. Fetch all posts from m/chainlink-official
 *  2. Delete any post authored by us
 *  3. On remaining posts, scan comments and delete any by us
 *
 * Usage:  npm run cleanup
 */
import "dotenv/config";

const apiKey     = process.env.MOLTBOOK_API_KEY;
const AGENT_NAME = (process.env.MOLTBOOK_AGENT_NAME ?? "cre-factchecker").toLowerCase();

if (!apiKey) {
  console.error("✗ MOLTBOOK_API_KEY not set");
  process.exit(1);
}

const HEADERS = {
  Authorization:  `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

const BASE = "https://www.moltbook.com/api/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Author {
  name?:     string;
  username?: string;
  handle?:   string;
  [k: string]: unknown;
}

interface Post {
  id:      string;
  title?:  string;
  author:  Author;
  [k: string]: unknown;
}

interface Comment {
  id:       string;
  content?: string;
  author:   Author;
  [k: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isByUs(author: Author): boolean {
  const names = [author.name, author.username, author.handle]
    .map((v) => String(v ?? "").toLowerCase());
  return names.some((n) =>
    n === AGENT_NAME ||
    n === "demo-agent" ||
    n.includes("factcheck") ||
    n.includes("cre-fact")
  );
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    console.warn(`  GET ${url} → ${res.status}`);
    return null;
  }
  return res.json() as Promise<T>;
}

async function deleteResource(url: string, label: string): Promise<boolean> {
  const res = await fetch(url, { method: "DELETE", headers: HEADERS });
  const ok  = res.ok || res.status === 204;
  console.log(`  ${ok ? "✓" : "✗"} DELETE ${label} → ${res.status}`);
  return ok;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n🧹 Cleanup — removing posts and comments by "${AGENT_NAME}"\n`);

  // 1. Fetch posts from m/chainlink-official (try both param names)
  let posts: Post[] = [];
  for (const param of ["submolt_name", "submolt"]) {
    const url = `${BASE}/posts?${param}=chainlink-official&limit=25&sort=new`;
    const raw = await getJson<unknown>(url);
    if (!raw) continue;
    posts = Array.isArray(raw)
      ? (raw as Post[])
      : (((raw as Record<string, unknown>).posts as Post[]) ?? []);
    if (posts.length > 0) break;
  }

  console.log(`Fetched ${posts.length} post(s) from m/chainlink-official\n`);

  let postsDeleted    = 0;
  let commentsDeleted = 0;

  for (const post of posts) {
    const titlePreview = String(post.title ?? post.id).slice(0, 60);

    // Delete post if we authored it
    if (isByUs(post.author)) {
      process.stdout.write(`🗑  OUR POST: ${post.id} "${titlePreview}" `);
      const ok = await deleteResource(`${BASE}/posts/${post.id}`, `post ${post.id}`);
      if (ok) postsDeleted++;
      console.log();
      continue; // comments cascade-delete with the post
    }

    // Scan comments on others' posts
    const raw = await getJson<unknown>(`${BASE}/posts/${post.id}/comments`);
    if (!raw) continue;

    const comments: Comment[] = Array.isArray(raw)
      ? (raw as Comment[])
      : (((raw as Record<string, unknown>).comments as Comment[]) ?? []);

    const ours = comments.filter((c) => isByUs(c.author));
    if (ours.length === 0) continue;

    console.log(`Post ${post.id} "${titlePreview}" — found ${ours.length} comment(s) by us`);
    for (const c of ours) {
      const preview = String(c.content ?? "").replace(/\n/g, " ").slice(0, 60);
      process.stdout.write(`  🗑  Comment ${c.id} "${preview}" `);
      const ok = await deleteResource(`${BASE}/comments/${c.id}`, `comment ${c.id}`);
      if (ok) commentsDeleted++;
    }
    console.log();
  }

  console.log("── Summary ─────────────────────────────────────");
  console.log(`  Posts deleted   : ${postsDeleted}`);
  console.log(`  Comments deleted: ${commentsDeleted}`);
}

main().catch((err) => {
  console.error("✗ Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
