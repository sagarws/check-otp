import { MongoClient } from "mongodb";

/**
 * Software versions, stored in MongoDB (collection "software"):
 *   { nameKey, softwareName, version, link, updatedAt }
 * nameKey is the lowercased name with a unique index, so names are unique
 * without case, even when two requests arrive at once.
 *
 * Env: MONGODB_URI (falls back to the built-in Atlas URI), MONGODB_DB (optional, default "check-otp").
 * Special characters in the password (like @) must be URL-encoded in the URI.
 */
const DB_NAME = process.env.MONGODB_DB || "check-otp";
const DUPLICATE_KEY = 11000;

// Reuse one connection across requests (and across hot reloads in dev).
const cache = globalThis.__softwareMongo || (globalThis.__softwareMongo = {});

async function collection() {
  if (!cache.promise) {
    // "@" in the password must be written as %40 in the URI.
    const uri =
      process.env.MONGODB_URI ||
      "mongodb+srv://sagar:SagarM%40123@cluster0.zsb9419.mongodb.net/?retryWrites=true&w=majority";
    cache.promise = (async () => {
      const client = await new MongoClient(uri).connect();
      const col = client.db(DB_NAME).collection("software");
      await col.createIndex({ nameKey: 1 }, { unique: true });
      return col;
    })().catch((err) => {
      cache.promise = null; // try again on the next request
      throw err;
    });
  }
  return cache.promise;
}

const keyOf = (name) => String(name).trim().toLowerCase();

// What the API returns: no Mongo internals.
function toItem(doc) {
  if (!doc) return null;
  const { _id, nameKey, ...item } = doc;
  return item;
}

export async function listSoftware() {
  const col = await collection();
  const docs = await col.find({}).sort({ nameKey: 1 }).toArray();
  return docs.map(toItem);
}

export async function getSoftware(name) {
  const col = await collection();
  return toItem(await col.findOne({ nameKey: keyOf(name) }));
}

export async function addSoftware(item) {
  const col = await collection();
  const saved = { ...item, updatedAt: new Date().toISOString() };
  try {
    await col.insertOne({ nameKey: keyOf(item.softwareName), ...saved });
  } catch (err) {
    if (err.code === DUPLICATE_KEY) return { error: "exists" };
    throw err;
  }
  return { item: saved };
}

export async function updateSoftware(name, changes) {
  const col = await collection();
  const set = { ...changes, updatedAt: new Date().toISOString() };
  if (changes.softwareName) set.nameKey = keyOf(changes.softwareName);
  try {
    const doc = await col.findOneAndUpdate(
      { nameKey: keyOf(name) },
      { $set: set },
      { returnDocument: "after" }
    );
    return doc ? { item: toItem(doc) } : { error: "not_found" };
  } catch (err) {
    if (err.code === DUPLICATE_KEY) return { error: "exists" };
    throw err;
  }
}

export async function deleteSoftware(name) {
  const col = await collection();
  const doc = await col.findOneAndDelete({ nameKey: keyOf(name) });
  return doc ? { item: toItem(doc) } : { error: "not_found" };
}
