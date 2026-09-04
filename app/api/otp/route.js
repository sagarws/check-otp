import { NextResponse } from "next/server";
import { getLatestOtp, isSupportedPlatform } from "@/lib/otp-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const platform = String(body?.platform || "").toLowerCase().trim();
  const email = String(body?.email || "").trim();

  if (!isSupportedPlatform(platform)) {
    return NextResponse.json(
      { success: false, message: "Unsupported platform. Use flipkart or tatacliq." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { success: false, message: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  try {
    const { otp, message } = await getLatestOtp(platform, email);
    if (!otp) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No matching OTP email found. Trigger a fresh OTP on the seller portal and try again.",
        },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      platform,
      email,
      otp,
      retrievedAt: new Date().toISOString(),
      emailDate: message?.date || null,
    });
  } catch (err) {
    console.error("[api/otp] failed:", err);
    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to retrieve the latest OTP. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
