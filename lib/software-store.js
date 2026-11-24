import { Redis } from "@upstash/redis";

/**
 * Software versions, stored in Upstash Redis as one hash:
 *   key "software", field = lowercased name, value = { softwareName, version, link, updatedAt }
 * Names are unique, compared without case.
 *
 * Needs the REST URL and token in env. The Vercel Upstash integration sets
 * KV_REST_API_URL / KV_REST_API_TOKEN; UPSTASH_REDIS_REST_URL / _TOKEN also work.
 */
const KEY = "software";

let client;
function redis() {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error(
        "Redis is not configured: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN)"
      );
    }
    client = new Redis({ url, token });
  }
  return client;
}

const fieldOf = (name) => String(name).trim().toLowerCase();

// Renames or rewrites one entry in a single step, so two requests can't
// both take the same new name. Returns 1 ok, 0 not found, -1 new name taken.
const REPLACE_SCRIPT = `
if redis.call("HEXISTS", KEYS[1], ARGV[1]) == 0 then return 0 end
if ARGV[1] ~= ARGV[2] and redis.call("HEXISTS", KEYS[1], ARGV[2]) == 1 then return -1 end
redis.call("HDEL", KEYS[1], ARGV[1])
redis.call("HSET", KEYS[1], ARGV[2], ARGV[3])
return 1
`;

export async function listSoftware() {
  const all = (await redis().hgetall(KEY)) || {};
  return Object.values(all).sort((a, b) =>
    a.softwareName.localeCompare(b.softwareName, undefined, { sensitivity: "base" })
  );
}

export async function getSoftware(name) {
  return (await redis().hget(KEY, fieldOf(name))) || null;
}

export async function addSoftware(item) {
  const saved = { ...item, updatedAt: new Date().toISOString() };
  const added = await redis().hsetnx(KEY, fieldOf(item.softwareName), JSON.stringify(saved));
  return added ? { item: saved } : { error: "exists" };
}

export async function updateSoftware(name, changes) {
  const current = await getSoftware(name);
  if (!current) return { error: "not_found" };

  const updated = { ...current, ...changes, updatedAt: new Date().toISOString() };
  const result = await redis().eval(
    REPLACE_SCRIPT,
    [KEY],
    [fieldOf(name), fieldOf(updated.softwareName), JSON.stringify(updated)]
  );
  if (result === 0) return { error: "not_found" };
  if (result === -1) return { error: "exists" };
  return { item: updated };
}

export async function deleteSoftware(name) {
  const current = await getSoftware(name);
  if (!current) return { error: "not_found" };
  const removed = await redis().hdel(KEY, fieldOf(name));
  return removed ? { item: current } : { error: "not_found" };
}
