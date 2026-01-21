import { NextResponse } from "next/server";
import fs from "fs/promises";

export async function POST(request: Request) {
  try {
    const { file_path, content } = await request.json();
    if (!file_path) {
      return NextResponse.json({ detail: "חסר נתיב קובץ" }, { status: 400 });
    }
    await fs.writeFile(file_path, content ?? "", "utf-8");
    return NextResponse.json({ saved: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `שגיאה בכתיבת הקובץ: ${message}` }, { status: 500 });
  }
}
