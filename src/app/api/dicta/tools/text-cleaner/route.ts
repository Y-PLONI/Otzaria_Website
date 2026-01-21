import { NextResponse } from "next/server";
import { textCleaner } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { file_path, options } = await request.json();
    const result = await textCleaner(file_path, options || {});
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
