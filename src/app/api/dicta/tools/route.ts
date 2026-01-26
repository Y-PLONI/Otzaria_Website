import { NextResponse } from "next/server";
import {
  addPageNumberToHeadingDB,
  changeHeadingLevelDB,
  createHeadersDB,
  createSingleLetterHeadersDB,
  createPageBHeadersDB,
  replacePageBHeadersDB,
  emphasizeAndPunctuateDB,
  textCleanerDB,
  headerErrorCheckerDB,
  imageToHtml,
  dictaSync,
  ocrProcess,
} from "../_lib";

export const runtime = "nodejs";

type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;

const toolHandlers: Record<string, ToolHandler> = {
  "add-page-number": async (params) => {
    const { book_id, replace_with } = params;
    if (!book_id) throw new Error("יש לבחור ספר תחילה");
    return addPageNumberToHeadingDB(book_id as string, replace_with as string);
  },

  "change-heading-level": async (params) => {
    const { book_id, current_level, new_level } = params;
    if (!book_id) throw new Error("יש לבחור ספר תחילה");
    return changeHeadingLevelDB(book_id as string, current_level as string, new_level as string);
  },

  "create-headers": async (params) => {
    const { book_id, find_word, end, level_num } = params;
    if (!book_id) throw new Error("יש לבחור ספר תחילה");
    return createHeadersDB(book_id as string, find_word as string, Number(end), Number(level_num));
  },

  "create-single-letter-headers": async (params) => {
    const { book_id, end_suffix, end, level_num, ignore, start, remove, bold_only } = params;
    if (!book_id) throw new Error("יש לבחור ספר תחילה");
    return createSingleLetterHeadersDB(
      book_id as string,
      end_suffix as string,
      Number(end),
      Number(level_num),
      Array.isArray(ignore) ? ignore : [],
      start as string,
      Array.isArray(remove) ? remove : [],
      Boolean(bold_only)
    );
  },

  "create-page-b-headers": async (params) => {
    const { book_id, header_level } = params;
    if (!book_id) throw new Error("יש לבחור ספר תחילה");
    return createPageBHeadersDB(book_id as string, Number(header_level));
  },

  "replace-page-b-headers": async (params) => {
    const { book_id, replace_type } = params;
    if (!book_id) throw new Error("יש לבחור ספר תחילה");
    return replacePageBHeadersDB(book_id as string, replace_type as string);
  },

  "emphasize-and-punctuate": async (params) => {
    const { book_id, add_ending, emphasize_start } = params;
    if (!book_id) throw new Error("יש לבחור ספר תחילה");
    return emphasizeAndPunctuateDB(book_id as string, add_ending as string, Boolean(emphasize_start));
  },

  "text-cleaner": async (params) => {
    const { book_id, options } = params;
    if (!book_id) throw new Error("יש לבחור ספר תחילה");
    return textCleanerDB(book_id as string, (options as Record<string, boolean>) || {});
  },

  "header-error-checker": async (params) => {
    const { book_id, re_start, re_end, gershayim, is_shas } = params;
    if (!book_id) throw new Error("יש לבחור ספר תחילה");
    return headerErrorCheckerDB(
      book_id as string,
      re_start as string,
      re_end as string,
      Boolean(gershayim),
      Boolean(is_shas)
    );
  },

  "image-to-html": async (params) => {
    const { path_or_url } = params;
    return imageToHtml(path_or_url as string);
  },

  "dicta-sync": async (params) => {
    const { folder_path } = params;
    return dictaSync(folder_path as string);
  },

  "ocr": async (params) => {
    const { pdf_path, api_key, model, prompt, pages_per_chunk, delay_seconds } = params;
    return ocrProcess(
      pdf_path as string,
      api_key as string,
      model as string,
      prompt as string,
      Number(pages_per_chunk) || 5,
      Number(delay_seconds) || 30
    );
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tool, ...params } = body;

    if (!tool || typeof tool !== "string") {
      return NextResponse.json({ detail: "יש לציין את שם הכלי (tool)" }, { status: 400 });
    }

    const handler = toolHandlers[tool];
    if (!handler) {
      return NextResponse.json({ detail: `כלי לא מוכר: ${tool}` }, { status: 400 });
    }

    const result = await handler(params);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
