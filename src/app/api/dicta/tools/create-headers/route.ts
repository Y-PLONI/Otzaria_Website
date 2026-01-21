import { NextResponse } from "next/server";
import { createHeaders } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { file_path, find_word, end, level_num } = await request.json();
    const result = await createHeaders(file_path, find_word, Number(end), Number(level_num));
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
