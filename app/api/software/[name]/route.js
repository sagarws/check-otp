import { NextResponse } from "next/server";
import { deleteSoftware, getSoftware, updateSoftware } from "@/lib/software-store";
import { validateSoftware } from "@/lib/software-validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = (name) =>
  NextResponse.json({ error: `Software "${name}" not found` }, { status: 404 });

// GET /api/software/Featured%20App -> one object (apps call this to check their version)
export async function GET(_request, { params }) {
  const name = decodeURIComponent(params.name);
  const item = await getSoftware(name);
  return item ? NextResponse.json(item) : notFound(name);
}

// PUT /api/software/Featured%20App { version?, link?, softwareName? } -> update
export async function PUT(request, { params }) {
  const name = decodeURIComponent(params.name);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data, error } = validateSoftware(body, { partial: true });
  if (error) return NextResponse.json({ error }, { status: 400 });

  const result = await updateSoftware(name, data);
  if (result.error === "not_found") return notFound(name);
  if (result.error === "exists") {
    return NextResponse.json(
      { error: `Another software is already named "${data.softwareName}"` },
      { status: 409 }
    );
  }
  return NextResponse.json(result.item);
}

// DELETE /api/software/Featured%20App
export async function DELETE(_request, { params }) {
  const name = decodeURIComponent(params.name);
  const result = await deleteSoftware(name);
  return result.error ? notFound(name) : NextResponse.json({ ok: true, deleted: result.item });
}
