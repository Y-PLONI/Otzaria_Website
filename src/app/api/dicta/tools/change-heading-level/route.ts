import { NextResponse } from "next/server";
import { changeHeadingLevel } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { file_path, current_level, new_level } = await request.json();
    const result = await changeHeadingLevel(file_path, current_level, new_level);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
