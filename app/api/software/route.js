import { NextResponse } from "next/server";
import { addSoftware, listSoftware } from "@/lib/software-store";
import { storageError, validateSoftware } from "@/lib/software-validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/software -> the whole list
export async function GET() {
  try {
    return NextResponse.json(await listSoftware());
  } catch (err) {
    return storageError(err);
  }
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

  let result;
  try {
    result = await addSoftware(data);
  } catch (err) {
    return storageError(err);
  }
  if (result.error === "exists") {
    return NextResponse.json(
      { error: `Software "${data.softwareName}" already exists. Edit it instead.` },
      { status: 409 }
    );
  }
  return NextResponse.json(result.item, { status: 201 });
}
