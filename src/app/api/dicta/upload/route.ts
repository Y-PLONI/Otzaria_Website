import { NextResponse } from "next/server";
import path from "path";
import { ensureUploadDir, UPLOAD_DIR } from "../_lib";
import fs from "fs/promises";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ detail: "חסר קובץ" }, { status: 400 });
    }

    await ensureUploadDir();
    const safeName = file.name.replace(/\.\./g, "").replace(/[\\/]/g, "_");
    const destName = `${Date.now()}_${safeName}`;
    const destPath = path.join(UPLOAD_DIR, destName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(destPath, buffer);

    return NextResponse.json({ path: destPath, name: file.name });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `שגיאה בשמירת הקובץ: ${message}` }, { status: 500 });
  }
}
