import { NextResponse } from "next/server";
import { createSingleLetterHeaders } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { file_path, end_suffix, end, level_num, ignore, start, remove, bold_only } = await request.json();
    const result = await createSingleLetterHeaders(
      file_path,
      end_suffix,
      Number(end),
      Number(level_num),
      Array.isArray(ignore) ? ignore : [],
      start,
      Array.isArray(remove) ? remove : [],
      Boolean(bold_only)
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
