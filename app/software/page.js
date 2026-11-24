"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const EMPTY = { softwareName: "", version: "", link: "" };

/**
 * Only for dev mode: localStorage "devmode" must be "true", otherwise this
 * page sends you home. Turn it on in the browser console:
 *   localStorage.setItem("devmode", "true")
 */
export default function SoftwarePage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(null); // null until localStorage is read

  useEffect(() => {
    const on = localStorage.getItem("devmode") === "true";
    setAllowed(on);
    if (!on) router.replace("/");
  }, [router]);

  return allowed ? <SoftwareManager /> : null;
}

function SoftwareManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // { original, softwareName, version, link }
  const [busy, setBusy] = useState(""); // name of the row being saved / deleted
  const [message, setMessage] = useState(null); // { type: "error" | "success", text }
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/software", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load the list");
      setItems(data);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function call(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  const urlFor = (name) => `/api/software/${encodeURIComponent(name)}`;

  async function handleAdd(e) {
    e.preventDefault();
    setAdding(true);
    setMessage(null);
    try {
      const item = await call("POST", "/api/software", form);
      setForm(EMPTY);
      setMessage({ type: "success", text: `Added ${item.softwareName} v${item.version}` });
      await load();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setAdding(false);
    }
  }

  async function handleSave() {
    const { original, ...changes } = editing;
    setBusy(original);
    setMessage(null);
    try {
      const item = await call("PUT", urlFor(original), changes);
      setEditing(null);
      setMessage({ type: "success", text: `Updated ${item.softwareName} to v${item.version}` });
      await load();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy("");
    }
  }

  async function handleDelete(name) {
    if (!window.confirm(`Delete "${name}"? Apps checking this name will get "not found".`)) return;
    setBusy(name);
    setMessage(null);
    try {
      await call("DELETE", urlFor(name));
      setMessage({ type: "success", text: `Deleted ${name}` });
      if (editing?.original === name) setEditing(null);
      await load();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy("");
    }
  }

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? items.filter((s) => `${s.softwareName} ${s.version}`.toLowerCase().includes(needle))
    : items;
  const formValid = form.softwareName.trim() && form.version.trim() && form.link.trim();

  return (
    <main className="page page-top">
      <section className="card card-wide">
        <div className="sw-topbar">
          <Link href="/" className="sw-back">
            ← Check OTP
          </Link>
        </div>

        <div className="header">
          <span className="badge">
            <span className="badge-dot" />
            Updates
          </span>
          <h1 className="title">Software Versions</h1>
          <p className="subtitle">
            The latest version and download link for each app. Apps call{" "}
            <code className="sw-code">GET /api/software/&lt;name&gt;</code> to check for updates.
          </p>
        </div>

        <form className="sw-add" onSubmit={handleAdd} noValidate>
          <input
            className="input"
            placeholder="Software name"
            value={form.softwareName}
            onChange={(e) => setForm({ ...form, softwareName: e.target.value })}
            disabled={adding}
            aria-label="Software name"
          />
          <input
            className="input"
            placeholder="Version (e.g. 1.2.0)"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            disabled={adding}
            aria-label="Version"
          />
          <input
            className="input"
            type="url"
            placeholder="Download link (https://...)"
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            disabled={adding}
            aria-label="Download link"
          />
          <button type="submit" className="button sw-add-btn" disabled={adding || !formValid}>
            {adding ? <span className="spinner" aria-hidden="true" /> : "+ Add"}
          </button>
        </form>

        {message && (
          <div className={message.type === "error" ? "error" : "success"} role="status">
            {message.text}
          </div>
        )}

        <div className="sw-list-head">
          <span>
            {items.length} {items.length === 1 ? "app" : "apps"}
          </span>
          <input
            className="input input-sm sw-search"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search software"
          />
        </div>

        <div className="sw-table-wrap">
          <table className="sw-table">
            <thead>
              <tr>
                <th>Software</th>
                <th>Version</th>
                <th>Download link</th>
                <th>Updated</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="sw-empty">Loading...</td>
                </tr>
              )}
              {!loading && shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="sw-empty">
                    {items.length === 0 ? "No software yet. Add one above." : "Nothing matches your search."}
                  </td>
                </tr>
              )}
              {shown.map((s) =>
                editing?.original === s.softwareName ? (
                  <tr key={s.softwareName} className="sw-editing">
                    <td>
                      <input
                        className="input input-sm"
                        value={editing.softwareName}
                        onChange={(e) => setEditing({ ...editing, softwareName: e.target.value })}
                        aria-label="Software name"
                      />
                    </td>
                    <td>
                      <input
                        className="input input-sm"
                        value={editing.version}
                        onChange={(e) => setEditing({ ...editing, version: e.target.value })}
                        aria-label="Version"
                        autoFocus
                      />
                    </td>
                    <td colSpan={2}>
                      <input
                        className="input input-sm"
                        value={editing.link}
                        onChange={(e) => setEditing({ ...editing, link: e.target.value })}
                        aria-label="Download link"
                      />
                    </td>
                    <td className="sw-actions">
                      <button
                        type="button"
                        className="sw-btn sw-btn-primary"
                        onClick={handleSave}
                        disabled={busy === s.softwareName}
                      >
                        Save
                      </button>
                      <button type="button" className="sw-btn" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.softwareName}>
                    <td className="sw-name">{s.softwareName}</td>
                    <td>
                      <span className="sw-version">v{s.version}</span>
                    </td>
                    <td className="sw-link">
                      <a href={s.link} target="_blank" rel="noopener noreferrer" title={s.link}>
                        {s.link}
                      </a>
                    </td>
                    <td className="sw-date">{formatDate(s.updatedAt)}</td>
                    <td className="sw-actions">
                      <button
                        type="button"
                        className="sw-btn"
                        onClick={() =>
                          setEditing({
                            original: s.softwareName,
                            softwareName: s.softwareName,
                            version: s.version,
                            link: s.link,
                          })
                        }
                        disabled={!!busy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="sw-btn sw-btn-danger"
                        onClick={() => handleDelete(s.softwareName)}
                        disabled={!!busy}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
