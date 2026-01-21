import { NextResponse } from "next/server";
import { imageToHtml } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { path_or_url } = await request.json();
    const result = await imageToHtml(path_or_url);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
