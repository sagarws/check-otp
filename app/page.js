"use client";

import { useMemo, useState } from "react";

const PLATFORMS = [
  { value: "flipkart", label: "Flipkart" },
  { value: "tatacliq", label: "Tata Cliq" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Page() {
  const [platform, setPlatform] = useState("flipkart");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const platformLabel = useMemo(
    () => PLATFORMS.find((p) => p.value === platform)?.label || platform,
    [platform]
  );

  const emailValid = EMAIL_RE.test(email.trim());

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setError("");
    setResult(null);
    setCopied(false);

    if (!emailValid) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setError(data.message || "Unable to retrieve the latest OTP.");
        return;
      }

      setResult(data);
    } catch (err) {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyOtp() {
    if (!result?.otp) return;
    try {
      await navigator.clipboard.writeText(result.otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — nothing meaningful to recover.
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="header">
          <span className="badge">
            <span className="badge-dot" />
            Seller Portal
          </span>
          <h1 className="title">Check OTP</h1>
          <p className="subtitle">
            Fetch the latest OTP from Gmail in one click.
          </p>
        </div>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="label" htmlFor="platform">
              Platform
            </label>
            <select
              id="platform"
              className="select"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              disabled={loading}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="Enter email address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="button"
            disabled={loading || !emailValid}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Checking OTP...
              </>
            ) : (
              "Get Latest OTP"
            )}
          </button>
        </form>

        {error && <div className="error" role="alert">{error}</div>}

        {result && (
          <div className="result" role="status" aria-live="polite">
            <div className="result-label">Latest OTP</div>
            <div className="otp">{result.otp}</div>
            <div className="meta">
              <strong>{platformLabel}</strong> · {result.email}
              <br />
              Retrieved {formatWhen(result.retrievedAt)}
            </div>
            <button
              type="button"
              className={`copy-btn${copied ? " copied" : ""}`}
              onClick={copyOtp}
            >
              {copied ? "Copied!" : "Copy OTP"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function formatWhen(iso) {
  if (!iso) return "just now";
  const d = new Date(iso);
  const secs = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (secs < 30) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return d.toLocaleTimeString();
}
