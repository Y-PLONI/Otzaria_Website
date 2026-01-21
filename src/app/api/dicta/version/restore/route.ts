import { NextResponse } from "next/server";
import { VersionManager } from "../../version-manager";

export async function POST(request: Request) {
  try {
    const { file_path, version_filename } = await request.json();
    if (!file_path) return NextResponse.json({ detail: "יש לבחור קובץ תחילה" }, { status: 400 });
    const vm = new VersionManager(file_path);
    await vm.init();
    const success = await vm.restoreVersionByFilename(version_filename);
    return NextResponse.json({ success });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
