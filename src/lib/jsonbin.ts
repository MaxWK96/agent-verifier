/**
 * JSONBin.io v3 helper
 * Used by both the Next.js API route (reading) and the agent (writing).
 * Env vars: JSONBIN_BIN_ID, JSONBIN_API_KEY
 */

const BASE = "https://api.jsonbin.io/v3/b";

function credentials(): { binId: string; apiKey: string } | null {
  const binId  = process.env.JSONBIN_BIN_ID;
  const apiKey = process.env.JSONBIN_API_KEY;
  if (!binId || !apiKey) return null;
  return { binId, apiKey };
}

/** Fetch the latest bin contents. Returns fallback if not configured or on error. */
export async function readBin<T>(fallback: T): Promise<T> {
  const creds = credentials();
  if (!creds) return fallback;

  const res = await fetch(`${BASE}/${creds.binId}/latest`, {
    headers: { "X-Master-Key": creds.apiKey },
    cache: "no-store",
  });

  if (!res.ok) return fallback;
  const json = await res.json() as { record: unknown };
  return (Array.isArray(json.record) ? json.record : fallback) as T;
}

/** Overwrite the bin with new data. Returns true on success. */
export async function writeBin<T>(data: T): Promise<boolean> {
  const creds = credentials();
  if (!creds) return false;

  const res = await fetch(`${BASE}/${creds.binId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": creds.apiKey,
    },
    body: JSON.stringify(data),
  });

  return res.ok;
}
