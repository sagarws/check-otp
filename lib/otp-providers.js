import { fetchEmails } from "./gmail.js";

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

  const body = (results[0].text || "") + "\n" + (results[0].html || "");
  const match = body.match(provider.regex);
  return {
    otp: match ? match[1] : null,
    message: {
      from: results[0].from,
      subject: results[0].subject,
      date: results[0].date,
    },
  };
}
