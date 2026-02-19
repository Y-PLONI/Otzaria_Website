const FINAL_MAP = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
const LETTER_VALUES = { "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "ז": 7, "ח": 8, "ט": 9, "י": 10, "כ": 20, "ל": 30, "מ": 40, "נ": 50, "ס": 60, "ע": 70, "פ": 80, "צ": 90, "ק": 100, "ר": 200, "ש": 300, "ת": 400 };

export function toHebrew(num) {
  if (num <= 0) return "";
  let remaining = num;
  let result = "";
  const values = [400, 300, 200, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const letters = ["ת", "ש", "ר", "ק", "צ", "פ", "ע", "ס", "נ", "מ", "ל", "כ", "י", "ט", "ח", "ז", "ו", "ה", "ד", "ג", "ב", "א"];

  for (let i = 0; i < values.length; i++) {
    while (remaining >= values[i]) {
      if (remaining === 15) { result += "טו"; remaining = 0; break; }
      if (remaining === 16) { result += "טז"; remaining = 0; break; }
      result += letters[i];
      remaining -= values[i];
    }
  }
  return result;
}

export function toNumber(text) {
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

export function stripTags(text, tags) {
  let result = text;
  tags.forEach((tag) => {
    result = result.split(tag).join("");
  });
  return result;
}

export function isGematria(text, end) {
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