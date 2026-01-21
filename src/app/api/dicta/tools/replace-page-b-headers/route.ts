import { NextResponse } from "next/server";
import { replacePageBHeaders } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { file_path, replace_type } = await request.json();
    const result = await replacePageBHeaders(file_path, replace_type);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
