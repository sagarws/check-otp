import { NextResponse } from "next/server";
import { addSoftware, listSoftware } from "@/lib/software-store";
import { validateSoftware } from "@/lib/software-validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/software -> the whole list
export async function GET() {
  return NextResponse.json(await listSoftware());
}

// POST /api/software { softwareName, version, link } -> add new software
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data, error } = validateSoftware(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const result = await addSoftware(data);
  if (result.error === "exists") {
    return NextResponse.json(
      { error: `Software "${data.softwareName}" already exists. Edit it instead.` },
      { status: 409 }
    );
  }
  return NextResponse.json(result.item, { status: 201 });
}
