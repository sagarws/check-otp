import { promises as fs } from "fs";
import path from "path";

/**
 * Software versions, stored as a JSON array in data/software.json:
 *   [{ softwareName, version, link }, ...]
 * Names are unique, compared without case.
 */
const FILE = path.join(process.cwd(), "data", "software.json");

// Every write goes through this chain, so two requests never write at once.
let queue = Promise.resolve();

async function readAll() {
  try {
    const data = JSON.parse(await fs.readFile(FILE, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(list) {
  // Temp file + rename: the JSON file is never left half-written.
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(list, null, 2) + "\n");
  await fs.rename(tmp, FILE);
}

function withLock(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

const sameName = (a, b) =>
  String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

export async function listSoftware() {
  return readAll();
}

export async function getSoftware(name) {
  const list = await readAll();
  return list.find((s) => sameName(s.softwareName, name)) || null;
}

export function addSoftware(item) {
  return withLock(async () => {
    const list = await readAll();
    if (list.some((s) => sameName(s.softwareName, item.softwareName))) {
      return { error: "exists" };
    }
    const saved = { ...item, updatedAt: new Date().toISOString() };
    list.push(saved);
    await writeAll(list);
    return { item: saved };
  });
}

export function updateSoftware(name, changes) {
  return withLock(async () => {
    const list = await readAll();
    const index = list.findIndex((s) => sameName(s.softwareName, name));
    if (index === -1) return { error: "not_found" };
    if (
      changes.softwareName &&
      list.some((s, i) => i !== index && sameName(s.softwareName, changes.softwareName))
    ) {
      return { error: "exists" };
    }
    list[index] = { ...list[index], ...changes, updatedAt: new Date().toISOString() };
    await writeAll(list);
    return { item: list[index] };
  });
}

export function deleteSoftware(name) {
  return withLock(async () => {
    const list = await readAll();
    const index = list.findIndex((s) => sameName(s.softwareName, name));
    if (index === -1) return { error: "not_found" };
    const [removed] = list.splice(index, 1);
    await writeAll(list);
    return { item: removed };
  });
}
