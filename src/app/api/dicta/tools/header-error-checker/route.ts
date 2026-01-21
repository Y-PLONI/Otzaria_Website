import { NextResponse } from "next/server";
import { headerErrorChecker } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { file_path, re_start, re_end, gershayim, is_shas } = await request.json();
    const result = await headerErrorChecker(file_path, re_start, re_end, Boolean(gershayim), Boolean(is_shas));
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
