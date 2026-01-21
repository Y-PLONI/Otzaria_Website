import { NextResponse } from "next/server";
import { dictaSync } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { folder_path } = await request.json();
    const result = await dictaSync(folder_path);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
