function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const FIELDS = ["softwareName", "version", "link"];

/**
 * Add: all three fields are required.
 * Update (partial): send any of them; only what is sent changes.
 */
export function validateSoftware(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Body must be a JSON object" };
  }

  const data = {};
  for (const field of FIELDS) {
    const value = body[field];
    if (value === undefined) {
      if (!partial) return { error: `"${field}" is required` };
      continue;
    }
    if (typeof value !== "string" || value.trim() === "") {
      return { error: `"${field}" must be a non-empty string` };
    }
    if (value.length > 2048) return { error: `"${field}" is too long` };
    data[field] = value.trim();
  }

  if (data.link !== undefined && !isHttpUrl(data.link)) {
    return { error: `"link" must be a valid http(s) URL` };
  }
  if (partial && Object.keys(data).length === 0) {
    return { error: `Send at least one of "softwareName", "version" or "link"` };
  }
  return { data };
}

// Storage failed (Redis down or not configured): log it and answer with JSON, not an empty 500.
export function storageError(err) {
  console.error("software store error:", err);
  return Response.json({ error: "Could not reach software storage. Try again later." }, { status: 500 });
}
