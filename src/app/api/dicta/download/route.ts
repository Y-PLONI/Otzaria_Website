import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import fsSync from "fs";

export async function POST(request: Request) {
  try {
    const { file_path } = await request.json();
    if (!file_path || !fsSync.existsSync(file_path)) {
      return NextResponse.json({ detail: "הקובץ לא נמצא" }, { status: 404 });
    }

    const buffer = await fs.readFile(file_path);
    const filename = path.basename(file_path);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `שגיאה בהורדה: ${message}` }, { status: 500 });
  }
}
