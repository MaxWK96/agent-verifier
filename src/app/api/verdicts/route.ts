import { NextResponse } from "next/server";
import * as fs   from "fs";
import * as path from "path";

export const dynamic = "force-dynamic"; // never cache — always read fresh from disk

interface StoredVerdict {
  postId:       string;
  agentName:    string;
  claimText:    string;
  verdict:      string;
  confidence:   number;
  source:       string;
  currentValue: number | null;
  txHash:       string;
  verdictHash:  string;
  timestamp:    string;
  commentId?:   string;
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "memory", "verdicts.json");

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ verdicts: [], count: 0 });
    }

    const raw     = fs.readFileSync(filePath, "utf-8");
    const all     = JSON.parse(raw) as StoredVerdict[];
    const last20  = Array.isArray(all) ? all.slice(0, 20) : [];

    return NextResponse.json({ verdicts: last20, count: last20.length });
  } catch (err) {
    console.error("[/api/verdicts] Error:", err);
    return NextResponse.json(
      { verdicts: [], count: 0, error: "Failed to load verdicts" },
      { status: 500 }
    );
  }
}
