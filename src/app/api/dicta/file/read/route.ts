import { NextResponse } from "next/server";
import fs from "fs/promises";
import fsSync from "fs";
import { validateSafePath } from "../../_lib";

export async function POST(request: Request) {
  try {
    const { file_path } = await request.json();
    validateSafePath(file_path);
    if (!file_path || !fsSync.existsSync(file_path)) {
      return NextResponse.json({ detail: "הקובץ לא נמצא" }, { status: 404 });
    }
    const content = await fs.readFile(file_path, "utf-8");
    return NextResponse.json({ content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `שגיאה בקריאת הקובץ: ${message}` }, { status: 500 });
  }
}
