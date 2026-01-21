import { NextResponse } from "next/server";
import { emphasizeAndPunctuate } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { file_path, add_ending, emphasize_start } = await request.json();
    const result = await emphasizeAndPunctuate(file_path, add_ending, Boolean(emphasize_start));
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
