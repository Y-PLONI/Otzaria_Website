import { NextResponse } from "next/server";
import { addPageNumberToHeading } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { file_path, replace_with } = await request.json();
    const result = await addPageNumberToHeading(file_path, replace_with);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
