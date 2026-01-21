import { NextResponse } from "next/server";
import { VersionManager } from "../../version-manager";

export async function POST(request: Request) {
  try {
    const { file_path, description } = await request.json();
    if (!file_path) return NextResponse.json({ detail: "יש לבחור קובץ תחילה" }, { status: 400 });
    const vm = new VersionManager(file_path);
    await vm.init();
    const versionNum = await vm.saveVersion(description || "");
    if (!versionNum) return NextResponse.json({ detail: "לא ניתן לשמור גירסה" }, { status: 400 });
    return NextResponse.json({ version: versionNum });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
