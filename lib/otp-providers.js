import { fetchEmails } from "./gmail.js";

// Snapdeal's OTP mail has changed wording before, so the code is found with
// ordered patterns (strongest anchor first) after stripping numbers that would
// otherwise fool the fallback: validity windows, years, phone numbers.
// Mirrors @trackvid/automation-core/platforms/snapdeal/common/getOtp.
const SNAPDEAL_PATTERNS = [
  /\bOTP\s*(?:is|:)\s*(\d{4,8})\b/i,
  /\bcode\s*(?:is|:)\s*(\d{4,8})\b/i,
  /\b(?:is|:)\s*(\d{6})\b/,
  /\b(\d{6})\b/,
];

const SNAPDEAL_NOISE = [
  /\b\d+\s*(?:minutes?|mins?|hours?|hrs?|days?|seconds?|secs?)\b/gi,
  /\b(?:19|20)\d{2}\b/g,
  /\+?\d{2,4}[-\s]?\d{6,}/g,
];

function snapdealCodeIn(body) {
  let text = String(body || "");
  for (const pattern of SNAPDEAL_NOISE) text = text.replace(pattern, " ");
  for (const pattern of SNAPDEAL_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// AJIO (Reliance Retail SSO) mails the code when a seller account is asked to
// "Verify your identity" after the password. The mail reads "Your OTP Code
// 704662 Expires in 10 minutes", and the template letter-spaces the digits, so
// a text rendering can come out as "7 0 4 6 6 2": the anchored patterns accept
// single spaces between digits and the match is collapsed before the shape
// check. Mirrors @trackvid/automation-core/platforms/ajio/common/getOtp.
const AJIO_PATTERNS = [
  /\bOTP\s*Code\s*:?\s*(\d(?: ?\d){3,7})\b/i,
  /\bOTP\s*(?:is|:)\s*(\d(?: ?\d){3,7})\b/i,
  /\bcode\s*(?:is|:)\s*(\d{4,8})\b/i,
  /\b(\d{6})\b/,
];

const OTP_SHAPE = /^\d{4,8}$/;

function ajioCodeIn(body) {
  let text = String(body || "");
  // Same noise as Snapdeal: validity windows, years, phone numbers.
  for (const pattern of SNAPDEAL_NOISE) text = text.replace(pattern, " ");
  for (const pattern of AJIO_PATTERNS) {
    const match = text.match(pattern);
    const code = match ? match[1].replace(/\s+/g, "") : null;
    if (code && OTP_SHAPE.test(code)) return code;
  }
  return null;
}

// The HTML part, as text: tags and entities out so the patterns see what a
// person would read, not style attributes or tracking URLs.
function htmlToText(html) {
  return String(html || "")
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}

const PROVIDERS = {
  flipkart: {
    label: "Flipkart",
    sender: "noreply@rmo.flipkart.com",
    subject: "is your verification code for secure access",
    regex: /Your OTP:\s*(\d{4,8})/i,
  },
  tatacliq: {
    label: "Tata Cliq",
    sender: "sp.alerts@tataunistore.com",
    subject: "One Time Password (OTP) for your LOGIN on Seller Portal",
    regex: /Seller Portal is\s+(\d{4,8})/i,
  },
  snapdeal: {
    label: "Snapdeal",
    // Envelope sender, not the reply-to (support@cxesnapdeal.in).
    sender: "snapdeal@sdseller.co.in",
    subject: "Snapdeal(OTP) - Your OTP details!",
    // Text first, then HTML: the HTML carries style attributes and tracking
    // URLs full of numbers the fallback pattern must never see.
    extract: (msg) => snapdealCodeIn(msg.text) || snapdealCodeIn(msg.html),
  },
  ajio: {
    label: "AJIO",
    // "Reliance Retail Seller Central", seen on a real challenge (2026-10).
    sender: "no-reply_sellercentral@ril.com",
    subject: "OTP AUTHENTICATION",
    extract: (msg) => ajioCodeIn(msg.text) || ajioCodeIn(htmlToText(msg.html)),
  },
};

export function isSupportedPlatform(platform) {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, platform);
}

export async function getLatestOtp(platform, email) {
  const provider = PROVIDERS[platform];
  if (!provider) throw new Error(`Unsupported platform: ${platform}`);
  if (!email) throw new Error("Missing email address");

  const results = await fetchEmails({
    from: provider.sender,
    to: email,
    subject: provider.subject,
    limit: 1,
  });

  if (results.length === 0) return { otp: null, message: null };

  let otp = null;
  if (provider.extract) {
    otp = provider.extract(results[0]);
  } else {
    const body = (results[0].text || "") + "\n" + (results[0].html || "");
    const match = body.match(provider.regex);
    otp = match ? match[1] : null;
  }
  return {
    otp,
    message: {
      from: results[0].from,
      subject: results[0].subject,
      date: results[0].date,
    },
  };
}
