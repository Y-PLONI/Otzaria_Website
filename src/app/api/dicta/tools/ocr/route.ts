import { NextResponse } from "next/server";
import { ocrProcess } from "../../_lib";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { pdf_path, api_key, model, prompt, pages_per_chunk, delay_seconds } = await request.json();
    const result = await ocrProcess(
      pdf_path,
      api_key,
      model,
      prompt,
      Number(pages_per_chunk) || 5,
      Number(delay_seconds) || 30
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
