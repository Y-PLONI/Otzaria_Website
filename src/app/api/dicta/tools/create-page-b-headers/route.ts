import { NextResponse } from "next/server";
import { createPageBHeaders } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { file_path, header_level } = await request.json();
    const result = await createPageBHeaders(file_path, Number(header_level));
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
