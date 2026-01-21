import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { load as loadHtml } from "cheerio";
import { PDFDocument } from "pdf-lib";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const UPLOAD_DIR = path.join(process.cwd(), "var", "dicta-uploads");

export function validateSafePath(filePath: string) {
  if (!filePath) throw new Error("נא לבחור קובץ תחילה");
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  if (!resolvedPath.startsWith(resolvedUploadDir)) {
    throw new Error("גישה נדחתה: נתיב לא חוקי");
  }
}

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export function ensureTxt(filePath: string) {
  validateSafePath(filePath);
  if (!filePath.toLowerCase().endsWith(".txt")) {
    throw new Error("סוג הקובץ אינו נתמך. בחר קובץ טקסט [בסיומת TXT.]");
  }
}

export async function readText(filePath: string) {
  validateSafePath(filePath);
  return fs.readFile(filePath, "utf-8");
}

export async function writeText(filePath: string, content: string) {
  validateSafePath(filePath);
  await fs.writeFile(filePath, content, "utf-8");
}

export async function readLines(filePath: string) {
  return (await readText(filePath)).split(/\r?\n/);
}

export async function writeLines(filePath: string, lines: string[]) {
  await writeText(filePath, lines.join("\n"));
}

const FINAL_MAP: Record<string, string> = {
  "ך": "כ",
  "ם": "מ",
  "ן": "נ",
  "ף": "פ",
  "ץ": "צ",
};

const LETTER_VALUES: Record<string, number> = {
  "א": 1,
  "ב": 2,
  "ג": 3,
  "ד": 4,
  "ה": 5,
  "ו": 6,
  "ז": 7,
  "ח": 8,
  "ט": 9,
  "י": 10,
  "כ": 20,
  "ל": 30,
  "מ": 40,
  "נ": 50,
  "ס": 60,
  "ע": 70,
  "פ": 80,
  "צ": 90,
  "ק": 100,
  "ר": 200,
  "ש": 300,
  "ת": 400,
};

export function toHebrew(num: number): string {
  if (num <= 0) return "";
  let remaining = num;
  let result = "";

  const hundreds = [
    [400, "ת"],
    [300, "ש"],
    [200, "ר"],
    [100, "ק"],
  ] as const;

  const tens = [
    [90, "צ"],
    [80, "פ"],
    [70, "ע"],
    [60, "ס"],
    [50, "נ"],
    [40, "מ"],
    [30, "ל"],
    [20, "כ"],
    [10, "י"],
  ] as const;

  const ones = [
    [9, "ט"],
    [8, "ח"],
    [7, "ז"],
    [6, "ו"],
    [5, "ה"],
    [4, "ד"],
    [3, "ג"],
    [2, "ב"],
    [1, "א"],
  ] as const;

  for (const [value, letter] of hundreds) {
    while (remaining >= value) {
      result += letter;
      remaining -= value;
    }
  }

  if (remaining === 15) {
    result += "טו";
    remaining = 0;
  } else if (remaining === 16) {
    result += "טז";
    remaining = 0;
  }

  for (const [value, letter] of tens) {
    while (remaining >= value) {
      result += letter;
      remaining -= value;
    }
  }

  for (const [value, letter] of ones) {
    while (remaining >= value) {
      result += letter;
      remaining -= value;
    }
  }

  return result;
}

export function toNumber(text: string): number {
  if (!text) return 0;
  let sum = 0;
  const clean = text
    .replace(/["׳״]/g, "")
    .replace(/[^א-ת]/g, "")
    .split("")
    .map((ch) => FINAL_MAP[ch] || ch);

  for (const ch of clean) {
    sum += LETTER_VALUES[ch] || 0;
  }

  return sum;
}

function stripTags(text: string, tags: string[]) {
  let result = text;
  tags.forEach((tag) => {
    result = result.split(tag).join("");
  });
  return result;
}

function isGematria(text: string, end: number): boolean {
  const remove = ["<b>", "</b>", "<big>", "</big>", ":", '"', ",", ";", "[", "]", "(", ")", "'", ".", "״", "‚"];
  const aa = ["ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק", "יה", "יו", "קיה", "קיו", "ריה", "ריו", "שיה", "שיו", "תיה", "תיו", "תקיה", "תקיו", "תריה", "תריו", "תשיה", "תשיו", "תתיה", "תתיו", "תתקיה", "תתקיו"];
  const bb = ["ם", "ן", "ץ", "ף", "ך"];
  const cc = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "ששי", "שביעי", "שמיני", "תשיעי", "עשירי", "יוד", "למד", "נון", "דש", "חי", "טל", "שדמ", "ער", "שדם", "תשדם", "תשדמ", "ערב", "ערה", "עדר", "רחצ"];
  const appendList = aa.flatMap((item) => bb.map((suffix) => item + suffix));

  let cleaned = text;
  remove.forEach((tag) => {
    cleaned = cleaned.split(tag).join("");
  });

  const withauteGershayim = Array.from({ length: end - 1 }, (_, i) => toHebrew(i + 1)).concat(bb, cc, appendList, aa);
  return withauteGershayim.includes(cleaned);
}

export async function addPageNumberToHeading(filePath: string, replaceWith: string) {
  try {
    const content = await readLines(filePath);
    let changesMade = false;
    const updated: string[] = [];
    let i = 0;

    while (i < content.length) {
      const line = content[i];
      const match = line.match(/<h([2-9])>(דף \S+)<\/h\1>/);
      if (match) {
        const level = match[1];
        const title = match[2];
        const nextLineIndex = i + 1;
        if (nextLineIndex < content.length) {
          const nextLine = content[nextLineIndex].trim();
          const pattern = /(<[a-z]+>)?(ע["']+?[אב]|עמוד [אב])[.,:()\[\]'"״׳]?(<\/[a-z]+>)?\s?/;
          const matchNextLine = nextLine.match(pattern);
          if (matchNextLine) {
            changesMade = true;
            let newTitle = line;
            if (replaceWith === "נקודה ונקודותיים") {
              if (matchNextLine[2].includes("א")) {
                newTitle = `<h${level}>${title.replace(/\.+$/, "")}.<\/h${level}>`;
              } else {
                newTitle = `<h${level}>${title.replace(/\.+$/, "")}:<\/h${level}>`;
              }
            } else if (replaceWith === "ע\"א וע\"ב") {
              const suffix = matchNextLine[2].includes("א") ? "ע\"א" : "ע\"ב";
              newTitle = `<h${level}>${title.replace(/\.+$/, "")} ${suffix}<\/h${level}>`;
            }
            updated.push(newTitle);
            const modifiedNext = nextLine.replace(pattern, "").trim();
            if (modifiedNext !== "") updated.push(modifiedNext);
            i += 1;
          } else {
            updated.push(line);
          }
        } else {
          updated.push(line);
        }
      } else {
        updated.push(line);
      }
      i += 1;
    }

    if (changesMade) {
      await writeLines(filePath, updated);
      return { changed: true, message: "ההחלפה הושלמה בהצלחה!" };
    }
    return { changed: false, message: "אין מה להחליף בקובץ זה" };
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error?.code === "ENOENT") throw new Error("הקובץ לא נמצא");
    throw err;
  }
}

export async function changeHeadingLevel(filePath: string, currentLevel: string, newLevel: string) {
  ensureTxt(filePath);
  const content = await readText(filePath);
  const currentTag = `h${currentLevel}`;
  const newTag = `h${newLevel}`;
  const updated = content.replace(new RegExp(`<${currentTag}>(.*?)<\/${currentTag}>`, "gs"), `<${newTag}>$1<\/${newTag}>`);
  if (content === updated) return { changed: false, message: "אין מה להחליף בקובץ זה" };
  await writeText(filePath, updated);
  return { changed: true, message: "רמות הכותרות עודכנו בהצלחה!" };
}

export async function createHeaders(filePath: string, findWord: string, end: number, levelNum: number) {
  ensureTxt(filePath);
  let found = false;
  let countHeadings = 0;
  const htmlTags = ["<b>", "</b>", "<big>", "</big>", ":", '"', ",", ";", "[", "]", "(", ")", "'", "״", ".", "‚"];
  const findClean = stripTags(findWord, htmlTags).trim();
  const content = await readLines(filePath);
  const allLines: string[] = content.slice(0, 2);
  let i = 2;
  while (i < content.length) {
    const line = content[i];
    const words = line.split(/\s+/).filter(Boolean);
    try {
      if (words.length >= 2 && stripTags(words[0], htmlTags) === findClean && isGematria(stripTags(words[1], htmlTags), end + 1)) {
        found = true;
        countHeadings += 1;
        const headingLine = `<h${levelNum}>${stripTags(words[0], htmlTags)} ${stripTags(words[1], htmlTags)}<\/h${levelNum}>`;
        allLines.push(headingLine);
        if (words.slice(2).length) allLines.push(words.slice(2).join(" "));
      } else if (words.length === 1 && stripTags(words[0], htmlTags) === findClean && i + 1 < content.length) {
        const nextLine = content[i + 1];
        const nextWords = nextLine.split(/\s+/).filter(Boolean);
        if (nextWords.length >= 1 && isGematria(stripTags(nextWords[0], htmlTags), end + 1)) {
          found = true;
          countHeadings += 1;
          const headingLine = `<h${levelNum}>${stripTags(words[0], htmlTags)} ${stripTags(nextWords[0], htmlTags)}<\/h${levelNum}>`;
          allLines.push(headingLine);
          if (nextWords.slice(1).length) allLines.push(nextWords.slice(1).join(" "));
          i += 1;
        } else {
          allLines.push(line);
        }
      } else {
        allLines.push(line);
      }
    } catch {
      allLines.push(line);
    }
    i += 1;
  }

  await writeLines(filePath, allLines);
  if (findWord === "דף") {
    await addPageNumberToHeading(filePath, "נקודה ונקודותיים");
  }

  return { found, count: countHeadings };
}

export async function createSingleLetterHeaders(
  filePath: string,
  endSuffix: string,
  end: number,
  levelNum: number,
  ignore: string[],
  start: string,
  remove: string[],
  boldOnly: boolean
) {
  ensureTxt(filePath);
  let count = 0;
  let localEndSuffix = endSuffix;
  let localStart = start;
  let localIgnore = [...ignore];

  if (boldOnly) {
    localEndSuffix += "</b>";
    localStart = `<b>${localStart}`;
  } else {
    localIgnore = localIgnore.concat(["<b>", "</b>"]);
  }

  const stripHtml = (text: string, ignoreTags: string[]) => {
    let result = text;
    ignoreTags.forEach((tag) => {
      result = result.split(tag).join("");
    });
    return result;
  };

  const content = await readLines(filePath);
  const allLines: string[] = content.slice(0, 1);
  for (const line of content.slice(1)) {
    const words = line.split(/\s+/).filter(Boolean);
    try {
      if (
        stripHtml(words[0], localIgnore).endsWith(localEndSuffix) &&
        isGematria(words[0], end + 1) &&
        stripHtml(words[0], localIgnore).startsWith(localStart)
      ) {
        const headingLine = `<h${levelNum}>${stripHtml(words[0], remove)}<\/h${levelNum}>`;
        allLines.push(headingLine);
        if (words.slice(1).length) allLines.push(words.slice(1).join(" "));
        count += 1;
      } else {
        allLines.push(line);
      }
    } catch {
      allLines.push(line);
    }
  }

  await writeLines(filePath, allLines);
  return { count };
}

export async function createPageBHeaders(filePath: string, headerLevel: number) {
  ensureTxt(filePath);

  const buildTagAgnosticPattern = (word: string, optionalEndChars = "['\"']*") => {
    const anyTags = "(?:<[^>]+>\\s*)*";
    let pattern = "";
    for (const char of word) {
      pattern += anyTags + char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    pattern += anyTags;
    if (optionalEndChars) pattern += optionalEndChars + anyTags;
    return pattern;
  };

  const stripAndReplace = (text: string, counter: { count: number }) => {
    const anyTags = "(?:<[^>]+>\\s*)*";
    const nonWord = "(?:[^\\w<>]|$)";
    let pattern = "^\\s*" + anyTags;

    const shemPattern = buildTagAgnosticPattern("שם", "");
    pattern += `(?<shem>${shemPattern}\\s*)?`;

    const gmarahVariants = ["גמרא", "בגמרא", "גמ'", "בגמ'"];
    const gmarahPatterns = gmarahVariants.map((word) => buildTagAgnosticPattern(word, ""));
    const gmarahPattern = `(?<gmarah>${gmarahPatterns.join("|")})\\s*`;
    pattern += `(?:${gmarahPattern})?`;

    const abVariants = ["עמוד ב", "ע\"ב", "ע''ב", "ע'ב"];
    const abPatterns = abVariants.map((word) => `(?<!\\w)${buildTagAgnosticPattern(word)}(?!\\w)`);
    const abPattern = `(?<ab>${abPatterns.join("|")})`;
    pattern += abPattern + nonWord + `(?<rest>.*)`;

    const matchPattern = new RegExp(pattern, "iu");

    const replaceFunction = (match: RegExpExecArray & { groups?: Record<string, string> }) => {
      const header = `<h${headerLevel}>עמוד ב<\/h${headerLevel}>`;
      const restOfLine = (match.groups?.rest || "").trimStart();
      let gmarahText = match.groups?.gmarah || "";
      if (gmarahText) gmarahText = gmarahText.replace(new RegExp(anyTags, "g"), "").trim();
      counter.count += 1;
      if (gmarahText) {
        return restOfLine ? `${header}\n${gmarahText} ${restOfLine}\n` : `${header}\n${gmarahText}\n`;
      }
      return restOfLine ? `${header}\n${restOfLine}\n` : `${header}\n`;
    };

    if (/<h\d>.*?<\/h\d>/i.test(text)) return text;
    const match = matchPattern.exec(text);
    if (!match) return text;
    const replaced = replaceFunction(match);
    return replaced.replace(/\n\s*\n/g, "\n");
  };

  const lines = await readLines(filePath);
  const counter = { count: 0 };
  const newLines = lines.map((line) => stripAndReplace(line, counter));
  await writeLines(filePath, newLines);

  return { count: counter.count };
}

export async function replacePageBHeaders(filePath: string, replaceType: string) {
  ensureTxt(filePath);
  const content = await readText(filePath);

  let previousTitle = "";
  let previousLevel = "";
  let replacementsMade = 0;

  const updated = content.replace(/<h([1-9])>(.*?)<\/h\1>/g, (match, level, title) => {
    if (/^דף \S+\.?/.test(title)) {
      previousTitle = title.trim();
      previousLevel = level;
      return match;
    }
    if (title === "עמוד ב") {
      replacementsMade += 1;
      if (replaceType === "נקודותיים") {
        return `<h${previousLevel}>${previousTitle.replace(/\.+$/, "")}:<\/h${previousLevel}>`;
      }
      if (replaceType === "ע\"ב") {
        const modifiedTitle = previousTitle.replace(/( ע\"א| עמוד א)/, "");
        return `<h${previousLevel}>${modifiedTitle.replace(/\.+$/, "")} ע\"ב<\/h${previousLevel}>`;
      }
    }
    return match;
  });

  await writeText(filePath, updated);
  return { count: replacementsMade };
}

export async function emphasizeAndPunctuate(filePath: string, addEnding: string, emphasizeStart: boolean) {
  ensureTxt(filePath);
  const lines = await readLines(filePath);
  let changed = false;

  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i].replace(/\r$/, "");
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length > 10 && !Array.from({ length: 8 }, (_, idx) => idx + 2).some((n) => line.startsWith(`<h${n}>`))) {
      if (addEnding !== "ללא שינוי") {
        if (line.endsWith(",")) {
          line = line.replace(/,\s*$/, "");
          line += addEnding === "הוסף נקודה" ? "." : ":";
          changed = true;
        } else if (!/[\.!?:]$/.test(line) && !["</small>", "</big>", "</b>"].some((tag) => line.endsWith(tag))) {
          line += addEnding === "הוסף נקודה" ? "." : ":";
          changed = true;
        }
      }
      if (emphasizeStart) {
        const firstWord = words[0];
        if (!["<b>", "<small>", "<big>", "<h2>", "<h3>", "<h4>", "<h5>", "<h6>"].some((tag) => firstWord.includes(tag))) {
          if (!(firstWord.startsWith("<") && firstWord.endsWith(">"))) {
            line = `<b>${firstWord}</b> ${words.slice(1).join(" ")}`;
            changed = true;
          }
        }
      }
      lines[i] = line;
    }
  }

  if (changed) await writeLines(filePath, lines);
  return { changed };
}

export async function textCleaner(filePath: string, options: Record<string, boolean>) {
  ensureTxt(filePath);
  let text = await readText(filePath);
  const original = text;

  if (options.remove_empty_lines) text = text.replace(/\n\s*\n/g, "\n");
  if (options.remove_double_spaces) text = text.replace(/ +/g, " ");
  if (options.remove_spaces_before) text = text.replace(/[ \t]+([\)\],\.:])/g, "$1");
  if (options.remove_spaces_after) text = text.replace(/(\s|^)([\[\(])(\s+)/gm, "$1$2");
  if (options.remove_spaces_around_newlines) text = text.replace(/\s*\n\s*/g, "\n");
  if (options.replace_double_quotes) {
    text = text.replace(/''/g, '"').replace(/``/g, '"').replace(/’’/g, '"').replace(/׳׳/g, '"').replace(/‘‘/g, '"');
  }
  if (options.normalize_quotes) {
    text = text
      .replace(/[“”„]/g, '"')
      .replace(/[‘’`]/g, "'")
      .replace(/׳/g, "'");
  }

  text = text.replace(/\s+$/, "");
  if (text === original) return { changed: false };
  await writeText(filePath, text);
  return { changed: true };
}

export async function headerErrorChecker(filePath: string, reStart: string, reEnd: string, gershayim: boolean, isShas: boolean) {
  ensureTxt(filePath);
  const htmlContent = await readText(filePath);
  const lines = htmlContent.split(/\r?\n/);

  const openingWithoutClosing: string[] = [];
  const closingWithoutOpening: string[] = [];
  const headingErrors: string[] = [];

  const checkTags = (line: string, lineNumber: number) => {
    const allTags: Array<["open" | "close", string, number]> = [];
    const regex = /<(\/?\w+)>/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      const tag = match[1];
      const position = match.index;
      if (tag.startsWith("/")) {
        allTags.push(["close", tag.slice(1), position]);
      } else {
        allTags.push(["open", tag, position]);
      }
    }
    allTags.sort((a, b) => a[2] - b[2]);
    const openStack: string[] = [];
    for (const [tagType, tagName] of allTags) {
      if (tagType === "open") {
        openStack.push(tagName);
      } else {
        let found = false;
        for (let i = openStack.length - 1; i >= 0; i -= 1) {
          if (openStack[i] === tagName) {
            openStack.splice(i, 1);
            found = true;
            break;
          }
        }
        if (!found) closingWithoutOpening.push(`שורה ${lineNumber}: </${tagName}> || ${line.trim()}`);
      }
    }
    openStack.forEach((tag) => openingWithoutClosing.push(`שורה ${lineNumber}: <${tag}> || ${line.trim()}`));
  };

  const checkHeadingErrors = (line: string, lineNumber: number) => {
    ["h2", "h3", "h4", "h5", "h6"].forEach((tag) => {
      const headingPattern = new RegExp(`<${tag}>.*?<\/${tag}>`);
      const headingMatch = line.match(headingPattern);
      if (headingMatch) {
        const start = headingMatch.index || 0;
        const end = start + headingMatch[0].length;
        const before = line.slice(0, start).trim();
        const after = line.slice(end).trim();
        if (before || after) headingErrors.push(`שורה ${lineNumber}: ${line.trim()}`);
      }
    });
  };

  lines.forEach((line, idx) => {
    checkTags(line, idx + 1);
    checkHeadingErrors(line, idx + 1);
  });

  const $ = loadHtml(htmlContent);
  let pattern: RegExp;
  if (reStart && reEnd) {
    pattern = new RegExp(`^[${escapeRegExp(reStart)}]*[א-ת]([א-ת \\-]*[א-ת])?[${escapeRegExp(reEnd)}]*$`);
  } else if (reStart) {
    pattern = new RegExp(`^[${escapeRegExp(reStart)}]*[א-ת]([א-ת \\-]*[א-ת])?$`);
  } else if (reEnd) {
    pattern = new RegExp(`^[א-ת]([א-ת \\-]*[א-ת])?[${escapeRegExp(reEnd)}]*$`);
  } else {
    pattern = new RegExp("^[א-ת]([א-ת \\-]*[א-ת])?$");
  }

  const unmatchedRegex: string[] = [];
  const unmatchedTags: string[] = [];
  const missingLevels: number[] = [];

  for (let i = 2; i <= 6; i += 1) {
    const tags = $(`h${i}`).toArray();
    if (!tags.length) {
      missingLevels.push(i);
      continue;
    }
    const step = isShas ? 2 : 1;
    for (let index = 0; index < tags.length - step; index += step) {
      const currentTag = $(tags[index]).text() || "";
      const nextTag = $(tags[index + step]).text() || "";
      if (!currentTag || !nextTag) continue;
      const currentParts = currentTag.split(" ");
      const nextParts = nextTag.split(" ");
      const currentHeading = currentParts.length > 1 ? currentParts[1] : currentTag;
      const nextHeading = nextParts.length > 1 ? nextParts[1] : nextTag;

      if (!pattern.test(currentTag)) {
        if (!(gershayim && (currentTag.includes("'") || currentTag.includes('"')))) {
          unmatchedRegex.push(currentTag);
        }
      }
      if (currentHeading.includes("'") || currentHeading.includes('"')) {
        unmatchedTags.push(currentHeading);
      }
      if (toNumber(currentHeading) + step !== toNumber(nextHeading)) {
        unmatchedTags.push(`כותרת נוכחית - ${currentTag} || כותרת הבאה - ${nextTag}`);
      }
    }
  }

  return {
    unmatched_regex: unmatchedRegex,
    unmatched_tags: unmatchedTags,
    opening_without_closing: openingWithoutClosing,
    closing_without_opening: closingWithoutOpening,
    heading_errors: headingErrors,
    missing_levels: missingLevels,
  };
}

export async function imageToHtml(pathOrUrl: string) {
  if (!pathOrUrl) throw new Error("לא נמצאה תמונה להמרה");
  const cleaned = pathOrUrl.trim().replace(/^"|"$/g, "");
  let imgData: Buffer | null = null;
  let fileExtension = "png";

  if (fsSync.existsSync(cleaned)) {
    validateSafePath(cleaned);
    imgData = await fs.readFile(cleaned);
    fileExtension = path.extname(cleaned).replace(".", "") || "png";
  } else if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    const resp = await fetch(cleaned);
    if (!resp.ok) throw new Error("שגיאה בטעינת התמונה");
    const arr = await resp.arrayBuffer();
    imgData = Buffer.from(arr);
  } else {
    throw new Error("לא נמצאה תמונה להמרה");
  }

  if (!imgData) throw new Error("שגיאה בטעינת התמונה");
  const encoded = imgData.toString("base64");
  const html = `<img src=\"data:image/${fileExtension};base64,${encoded}\" >`;
  return { html };
}

export async function dictaSync(folderPath: string) {
  validateSafePath(folderPath);
  if (!folderPath) throw new Error("יש לבחור תיקייה תחילה");
  const baseUrl = process.env.DICTA_GITHUB_REPO || "https://raw.githubusercontent.com/zevisvei/otzaria-library/refs/heads/main/";
  const log: string[] = [];

  const listResp = await fetch(`${baseUrl}DictaToOtzaria/ספרים/לא ערוך/list.txt`);
  if (!listResp.ok) throw new Error(`שגיאה בקבלת רשימת קבצים: ${listResp.status}`);
  const listFromGithub = (await listResp.text()).split(/\r?\n/).filter(Boolean);
  log.push(`נמצאו ${listFromGithub.length} קבצים בשרת`);

  const localFiles: string[] = [];
  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".txt")) {
        localFiles.push(path.relative(folderPath, fullPath));
      }
    }
  };
  await walk(folderPath);

  const filesToDownload = listFromGithub.filter((file) => !localFiles.includes(file.replace(/\//g, path.sep)));
  for (const file of filesToDownload) {
    const filePath = path.join(folderPath, file.replace(/\//g, path.sep));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const url = `${baseUrl}DictaToOtzaria/ספרים/לא ערוך/אוצריא/${file}`;
    const r = await fetch(url);
    if (r.ok) {
      const text = await r.text();
      await writeText(filePath, text);
      log.push(`הורד: ${file}`);
    } else {
      log.push(`שגיאה בהורדה: ${file}`);
    }
  }

  const normalizedList = new Set(listFromGithub.map((f) => f.replace(/\//g, path.sep)));
  const filesToDelete = localFiles.filter((f) => !normalizedList.has(f));
  for (const file of filesToDelete) {
    const filePath = path.join(folderPath, file);
    try {
      await fs.unlink(filePath);
      log.push(`נמחק: ${file}`);
    } catch (ex: unknown) {
      const message = ex instanceof Error ? ex.message : String(ex);
      log.push(`שגיאה במחיקה: ${file} (${message})`);
    }
  }

  log.push("הסנכרון הושלם!");
  return { log };
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type UsageData = {
  month: string;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
};

async function loadMonthlyUsage(usageFile: string): Promise<UsageData> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (fsSync.existsSync(usageFile)) {
    try {
      const raw = await fs.readFile(usageFile, "utf-8");
      const data = JSON.parse(raw);
      if (data.month !== currentMonth) return { month: currentMonth, input_tokens: 0, output_tokens: 0, total_cost: 0 };
      return data;
    } catch {
      return { month: currentMonth, input_tokens: 0, output_tokens: 0, total_cost: 0 };
    }
  }
  return { month: currentMonth, input_tokens: 0, output_tokens: 0, total_cost: 0 };
}

async function saveMonthlyUsage(usageFile: string, data: UsageData) {
  await fs.writeFile(usageFile, JSON.stringify(data, null, 2));
}

export async function ocrProcess(
  pdfPath: string,
  apiKey: string | undefined,
  model: string,
  prompt: string,
  pagesPerChunk: number,
  delaySeconds: number
) {
  if (!pdfPath) throw new Error("אנא בחר קובץ PDF תחילה");
  validateSafePath(pdfPath);
  if (!fsSync.existsSync(pdfPath)) throw new Error("קובץ PDF לא נמצא");
  const key = apiKey || process.env.GEMINI_API_KEY || "";
  if (!key) throw new Error("אנא הגדר API Key בהגדרות");

  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  let recommendedDelay = delaySeconds;
  if (model.includes("2.5-pro")) recommendedDelay = Math.max(recommendedDelay, 30);
  if (model.includes("2.5-flash")) recommendedDelay = Math.max(recommendedDelay, 6);
  if (delaySeconds < recommendedDelay) delaySeconds = recommendedDelay;

  const client = new GoogleGenerativeAI(key);
  const genModel = client.getGenerativeModel({ model });

  const allText: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let startPage = 0; startPage < totalPages; startPage += pagesPerChunk) {
    const endPage = Math.min(startPage + pagesPerChunk, totalPages);
    let retryCount = 0;
    let success = false;

    while (retryCount < 3 && !success) {
      try {
        const chunkDoc = await PDFDocument.create();
        const pages = await chunkDoc.copyPages(pdfDoc, Array.from({ length: endPage - startPage }, (_, i) => startPage + i));
        pages.forEach((page) => chunkDoc.addPage(page));
        const chunkBytes = await chunkDoc.save();

        const contents = [
          {
            role: "user",
            parts: [
              { text: prompt || "" },
              { inlineData: { data: Buffer.from(chunkBytes).toString("base64"), mimeType: "application/pdf" } },
            ],
          },
        ];

        const response = await genModel.generateContent({ contents });
        const text = response.response.text();
        allText.push(text || "");

        const usage = (response.response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata;
        if (usage) {
          totalInputTokens += usage.promptTokenCount ?? 0;
          totalOutputTokens += usage.candidatesTokenCount ?? 0;
        }
        success = true;
      } catch (err: any) {
        const errorStr = err?.message || String(err);
        if (errorStr.includes("429") || /quota|rate/i.test(errorStr)) {
          retryCount += 1;
          if (retryCount < 3) {
            await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000 * (retryCount + 1)));
          } else {
            throw new Error(`נכשל אחרי 3 נסיונות. שגיאה: ${errorStr.slice(0, 200)}`);
          }
        } else {
          throw err;
        }
      }
    }

    if (endPage < totalPages) {
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }
  }

  const outputText = allText.join("\n\n");
  const totalTokens = totalInputTokens + totalOutputTokens;

  let sessionCost = 0;
  if (model.includes("2.5-pro")) {
    sessionCost = (totalInputTokens / 1_000_000) * 1.25 + (totalOutputTokens / 1_000_000) * 5;
  } else if (model.includes("2.5-flash")) {
    sessionCost = (totalInputTokens / 1_000_000) * 0.075 + (totalOutputTokens / 1_000_000) * 0.30;
  } else if (model.includes("1.5-pro")) {
    sessionCost = (totalInputTokens / 1_000_000) * 1.25 + (totalOutputTokens / 1_000_000) * 5;
  } else {
    sessionCost = (totalInputTokens / 1_000_000) * 0.075 + (totalOutputTokens / 1_000_000) * 0.30;
  }

  const usageFile = path.join(process.cwd(), "var", "gemini_usage.json");
  await fs.mkdir(path.dirname(usageFile), { recursive: true });
  const monthly = await loadMonthlyUsage(usageFile);
  monthly.input_tokens += totalInputTokens;
  monthly.output_tokens += totalOutputTokens;
  monthly.total_cost += sessionCost;
  await saveMonthlyUsage(usageFile, monthly);

  return {
    text: outputText,
    total_pages: totalPages,
    total_tokens: totalTokens,
    session_cost: sessionCost,
    monthly,
  };
}
