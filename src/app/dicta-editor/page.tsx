"use client";

/* eslint-disable react/no-unescaped-entities */

import { useEffect, useState, useRef } from "react";
import "./dicta-editor.css";
import { initDictaEditor } from "./dicta-editor-client";

export default function DictaEditorPage() {
  const [mounted, setMounted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !initialized.current) {
      initialized.current = true;
      initDictaEditor();
    }
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="dicta-editor">
      <header className="top-bar">
        <div className="top-bar__start">
          <button className="icon-btn" id="openFileBtn" title="בחר קובץ">
            <span className="material-symbols-outlined">folder_open</span>
          </button>
          <div className="file-info" id="selectedFileName">כרטיסייה חדשה</div>
          <button className="version-btn" id="versionBtn" title="ניהול גירסאות">v1</button>
        </div>

        <div className="top-bar__end">
          <button className="icon-btn" id="fontPlusBtn" title="הגדל גופן">
            <span className="material-symbols-outlined">add</span>
          </button>
          <button className="icon-btn" id="fontMinusBtn" title="הקטן גופן">
            <span className="material-symbols-outlined">remove</span>
          </button>
          <span id="fontSizeDisplay">18</span>
          <button className="icon-btn" title="אודות">
            <span className="material-symbols-outlined">info</span>
          </button>
        </div>

        <input type="file" id="filePicker" accept=".txt" hidden />
      </header>

      <div className="main-layout">
        <aside className="toolbar">
          <button className="tool-btn" data-tool="createHeaders" title="יצירת כותרות">
            <span className="material-symbols-outlined">title</span>
          </button>
          <button className="tool-btn" data-tool="singleLetterHeaders" title="כותרות אותיות">
            <span className="material-symbols-outlined">format_size</span>
          </button>
          <button className="tool-btn" data-tool="changeHeading" title="שינוי רמת כותרת">
            <span className="material-symbols-outlined">format_indent_increase</span>
          </button>
          <button className="tool-btn" data-tool="punctuate" title="הדגשה וניקוד">
            <span className="material-symbols-outlined">format_bold</span>
          </button>
          <button className="tool-btn" data-tool="pageBHeader" title="כותרות עמוד ב">
            <span className="material-symbols-outlined">find_in_page</span>
          </button>
          <button className="tool-btn" data-tool="replacePageB" title="החלפת עמוד ב">
            <span className="material-symbols-outlined">swap_horiz</span>
          </button>
          <button className="tool-btn" data-tool="headerCheck" title="בדיקת שגיאות בכותרות">
            <span className="material-symbols-outlined">bug_report</span>
          </button>
          <button className="tool-btn" data-tool="cleanText" title="תיקון שגיאות נפוצות">
            <span className="material-symbols-outlined">spellcheck</span>
          </button>
          <button className="tool-btn" data-tool="ocr" title="OCR">
            <span className="material-symbols-outlined">document_scanner</span>
          </button>
          <button className="tool-btn" data-tool="imageToHtml" title="המרת תמונה לטקסט">
            <span className="material-symbols-outlined">image</span>
          </button>
          <button className="tool-btn" data-tool="dictaSync" title="סנכרון ספרי דיקטה">
            <span className="material-symbols-outlined">sync</span>
          </button>
        </aside>

        <aside className="navigation-panel scrollbar">
          <div className="nav-title">ניווט</div>
          <div id="navigationList"></div>
        </aside>

        <main className="content-area scrollbar" id="filePreview"></main>

        <button className="fab-btn" id="editFab" title="עריכה ידנית" style={{ display: "none" }}>
          <span className="material-symbols-outlined">edit</span>
        </button>

        <div id="popupsContainer"></div>
      </div>

      <div style={{ display: "none" }} id="tmpl-createHeaders">
        <div className="popup-card">
          <div className="popup-header">יצירת כותרות</div>
          <div className="popup-content">
            <div className="input-group">
              <label>מילה לחיפוש</label>
              <div className="custom-combobox" id="headersCombobox">
                <input type="text" id="createHeadersFind" className="m3-input" defaultValue="דף" />
                <button className="combo-btn" type="button">
                  <span className="material-symbols-outlined">expand_more</span>
                </button>
              </div>
            </div>
            <div className="row">
              <div className="input-group">
                <label>עד מספר</label>
                <input type="number" id="createHeadersEnd" defaultValue={999} className="m3-input" />
              </div>
              <div className="input-group">
                <label>רמה</label>
                <div className="custom-combobox" id="createHeadersLevelBox">
                  <input type="text" id="createHeadersLevel" defaultValue="2" className="m3-input" />
                  <button className="combo-btn" type="button">
                    <span className="material-symbols-outlined">expand_more</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="result-msg" style={{ textAlign: "right", marginBottom: 12, fontSize: 14 }}>
              בתיבת 'מילה לחפש' יש לבחור או להקליד את המילה בה אנו רוצים שתתחיל הכותרת.<br />
              לדוג': פרק/פסוק/סימן/סעיף/הלכה/שאלה/עמוד/סק/ענף<br /><br />
              <b>שים לב!</b><br />
              אין להקליד רווח אחרי המילה, וכן אין להקליד את התו גרש (') או גרשיים (") וכן אין להקליד יותר ממילה אחת
            </div>
            <button className="m3-btn filled" id="createHeadersBtn">הפעל</button>
            <div className="result-msg" id="createHeadersResult"></div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-singleLetterHeaders">
        <div className="popup-card">
          <div className="popup-header">כותרות אותיות</div>
          <div className="popup-content">
            <div className="row">
              <div className="input-group">
                <label>תו התחלה</label>
                <div className="custom-combobox" id="singleLetterStartBox">
                  <input type="text" className="m3-input" id="singleLetterStart" />
                  <button className="combo-btn" type="button"><span className="material-symbols-outlined">expand_more</span></button>
                </div>
              </div>
              <div className="input-group">
                <label>תו סוף</label>
                <div className="custom-combobox" id="singleLetterEndBox">
                  <input type="text" className="m3-input" id="singleLetterEnd" />
                  <button className="combo-btn" type="button"><span className="material-symbols-outlined">expand_more</span></button>
                </div>
              </div>
            </div>
            <div className="row">
              <div className="input-group">
                <label>רמה</label>
                <div className="custom-combobox" id="singleLetterLevelBox">
                  <input type="text" className="m3-input" id="singleLetterLevel" defaultValue="3" />
                  <button className="combo-btn" type="button"><span className="material-symbols-outlined">expand_more</span></button>
                </div>
              </div>
              <div className="input-group"><label>מקסימום</label><input className="m3-input" id="singleLetterMax" defaultValue="999" /></div>
            </div>
            <div className="input-group"><label>התעלם מ:</label><input className="m3-input" id="singleLetterIgnore" defaultValue="<big> </big> <i> </i> </small> </small> <span> </span> <br> </br> <p> </p>" /></div>
            <div className="input-group"><label>הסר:</label><input className="m3-input" id="singleLetterRemove" defaultValue={", : \" ' . ( ) [ ] { }"} /></div>
            <label className="checkbox-row"><input type="checkbox" id="singleLetterBold" defaultChecked /> לחפש מודגש בלבד</label>
            <div className="result-msg" style={{ color: "#D32F2F", fontWeight: "bold", marginBottom: 12 }}>
              מומלץ מאוד ליצור גיבוי של הספר לפני הפעלת תוכנה זו!!
            </div>
            <button className="m3-btn filled" id="singleLetterBtn">הפעל</button>
            <div className="result-msg" id="singleLetterResult"></div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-addPageNumber">
        <div className="popup-card">
          <div className="popup-header">מספר עמוד</div>
          <div className="popup-content">
            <div className="input-group">
              <label>סוג החלפה</label>
              <select className="m3-select" id="addPageNumberType">
                <option value="נקודה ונקודותיים">נקודה ונקודותיים</option>
                <option value="ע&quot;א וע&quot;ב">ע"א וע"ב</option>
              </select>
            </div>
            <button className="m3-btn filled" id="addPageNumberBtn">בצע החלפה</button>
            <div className="result-msg" id="addPageNumberResult"></div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-changeHeading">
        <div className="popup-card">
          <div className="popup-header"> שינוי רמת כותרת</div>
          <div className="popup-content">
            <div className="row">
              <div className="input-group">
                <label>נוכחית</label>
                <div className="custom-combobox" id="changeHeadingCurrentBox">
                  <input type="text" className="m3-input" id="changeHeadingCurrent" defaultValue="2" />
                  <button className="combo-btn" type="button"><span className="material-symbols-outlined">expand_more</span></button>
                </div>
              </div>
              <div className="input-group">
                <label>חדשה</label>
                <div className="custom-combobox" id="changeHeadingNewBox">
                  <input type="text" className="m3-input" id="changeHeadingNew" defaultValue="3" />
                  <button className="combo-btn" type="button"><span className="material-symbols-outlined">expand_more</span></button>
                </div>
              </div>
            </div>
            <button className="m3-btn filled" id="changeHeadingBtn">שנה רמת כותרת</button>
            <div className="result-msg" id="changeHeadingResult"></div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-punctuate">
        <div className="popup-card">
          <div className="popup-header">הדגשה וניקוד</div>
          <div className="popup-content">
            <div className="input-group">
              <label>סוף קטע</label>
              <select className="m3-select" id="punctuateEnding">
                <option value="הוסף נקודותיים">הוסף נקודותיים</option>
                <option value="הוסף נקודה">הוסף נקודה</option>
                <option value="ללא שינוי">ללא שינוי</option>
              </select>
            </div>
            <label className="checkbox-row"><input type="checkbox" id="punctuateEmphasize" defaultChecked /> הדגש תחילת קטע</label>
            <div className="result-msg" style={{ fontWeight: "bold", marginBottom: 12, textAlign: "center" }}>
              התוכנה פועלת רק על שורות שיש בהם עשר מילים ומעלה
            </div>
            <button className="m3-btn filled" id="punctuateBtn">הפעל</button>
            <div className="result-msg" id="punctuateResult"></div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-pageBHeader">
        <div className="popup-card">
          <div className="popup-header">כותרות עמוד ב</div>
          <div className="popup-content">
            <div className="result-msg" style={{ textAlign: "center", marginBottom: 12 }}>
              התוכנה יוצרת כותרת בכל מקום בקובץ שכתוב בתחילת שורה -<br />
              'עמוד ב', או 'ע"ב'.<br />
              באם כתוב את המילה 'שם' לפני המילים הנ"ל, המילה 'שם' נמחקת<br />
              ובאם כתוב את המילה 'גמרא' לפני המילים 'עמוד ב' או 'ע"ב'<br />
              התוכנה תעביר את המילה 'גמרא' לתחילת השורה שאחרי הכותרת
            </div>
            <div className="input-group">
              <label>רמת כותרת</label>
              <div className="custom-combobox" id="pageBHeaderLevelBox">
                <input type="text" className="m3-input" id="pageBHeaderLevel" defaultValue="3" />
                <button className="combo-btn" type="button"><span className="material-symbols-outlined">expand_more</span></button>
              </div>
            </div>
            <button className="m3-btn filled" id="pageBHeaderBtn">הפעל</button>
            <div className="result-msg" id="pageBHeaderResult"></div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-replacePageB">
        <div className="popup-card">
          <div className="popup-header">החלפת עמוד ב</div>
          <div className="popup-content">
            <div className="result-msg" style={{ textAlign: "center", marginBottom: 12 }}>
              שים לב! התוכנה פועלת רק אם הדפים והעמודים הוגדרו ככותרות (כגון: &lt;h3&gt;עמוד ב&lt;/h3&gt;)<br />
              זהירות! בדוק שלא פספסת כותרת 'דף' - אחרת 'עמוד ב' שאחריו יהפוך לכותרת שגויה
            </div>
            <div className="input-group">
              <select className="m3-select" id="replacePageBType">
                <option value="נקודותיים">נקודותיים</option>
                <option value="ע&quot;ב">ע"ב</option>
              </select>
            </div>
            <div className="result-msg" style={{ textAlign: "center", marginBottom: 12 }}>
              דוגמאות:<br />
              נקודותיים: דף ב: דף ג: דף ד:<br />
              ע"ב: דף ב ע"ב דף ג ע"ב דף ד ע"ב
            </div>
            <button className="m3-btn filled" id="replacePageBBtn">בצע החלפה</button>
            <div className="result-msg" id="replacePageBResult"></div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-imageToHtml">
        <div className="popup-card">
          <div className="popup-header">המרת תמונה</div>
          <div className="popup-content">
            <button className="m3-btn outlined" id="uploadImageBtn">בחר תמונה</button>
            <div className="input-group"><label>נתיב/URL</label><input className="m3-input" id="imagePath" /></div>
            <div className="row">
              <button className="m3-btn filled" id="imageToHtmlBtn">המר</button>
              <button className="m3-btn text" id="imageCopyBtn">העתק</button>
            </div>
            <div className="result-msg" id="imageToHtmlResult"></div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-cleanText">
        <div className="popup-card">
          <div className="popup-header">תיקון שגיאות</div>
          <div className="popup-content">
            <div className="checkbox-group">
              <label><input type="checkbox" id="cleanEmpty" defaultChecked /> שורות ריקות</label>
              <label><input type="checkbox" id="cleanSpaces" defaultChecked /> רווחים כפולים</label>
              <label><input type="checkbox" id="cleanBefore" defaultChecked /> רווחים לפני</label>
              <label><input type="checkbox" id="cleanAfter" defaultChecked /> רווחים אחרי</label>
              <label><input type="checkbox" id="cleanAround" defaultChecked /> רווחים אנטר</label>
              <label><input type="checkbox" id="cleanQuotes" defaultChecked /> גרשיים בודדים</label>
            </div>
            <div className="row">
              <button className="m3-btn filled" id="cleanTextBtn">הרץ</button>
              <button className="m3-btn text" id="cleanUndoBtn">בטל</button>
            </div>
            <div className="result-msg" id="cleanTextResult"></div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-dictaSync">
        <div className="popup-card">
          <div className="popup-header">סנכרון דיקטה</div>
          <div className="popup-content">
            <div className="input-group"><label>תיקייה</label><input className="m3-input" id="dictaFolder" /></div>
            <button className="m3-btn filled" id="dictaSyncBtn">סנכרן</button>
            <div className="log-box" id="dictaLog"></div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-ocr">
        <div className="popup-card large">
          <div className="popup-header">OCR</div>
          <div className="popup-content">
            <button className="m3-btn outlined" id="ocrUploadBtn">בחר PDF</button>
            <div className="input-group"><label>נתיב</label><input className="m3-input" id="ocrPdfPath" /></div>
            <div className="input-group"><label>API Key</label><input className="m3-input" id="ocrApiKey" /></div>
            <div className="input-group"><label>מודל</label><input className="m3-input" id="ocrModel" defaultValue="gemini-2.5-pro" /></div>
            <div className="input-group"><label>פרומפט</label><textarea className="m3-input" id="ocrPrompt" rows={3}></textarea></div>
            <div className="row">
              <div className="input-group"><label>Pages/Chunk</label><input className="m3-input" id="ocrPages" defaultValue="5" /></div>
              <div className="input-group"><label>Delay</label><input className="m3-input" id="ocrDelay" defaultValue="35" /></div>
            </div>
            <button className="m3-btn filled" id="ocrRunBtn">הפעל OCR</button>
            <div className="log-box" id="ocrResult"></div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-headerCheck">
        <div className="popup-card large alert-color">
          <div className="popup-header">בדיקת שגיאות</div>
          <div className="popup-content">
            <div className="row">
              <div className="input-group"><label>התחלה</label><input className="m3-input" id="headerCheckStart" defaultValue={"\u200F"} /></div>
              <div className="input-group"><label>סוף</label><input className="m3-input" id="headerCheckEnd" defaultValue={"\u200F"} /></div>
            </div>
            <div className="row">
              <label><input type="checkbox" id="headerCheckGershayim" /> גרשיים תקינים</label>
              <label><input type="checkbox" id="headerCheckShas" /> ש"ס</label>
            </div>
            <button className="m3-btn filled" id="headerCheckBtn">בדוק</button>

            <div id="headerCheckResultsArea" style={{ display: "none", marginTop: 10 }}>
              <div className="error-section">
                <div className="error-title">כותרות שיש בהן תווים מיותרים</div>
                <textarea className="m3-input error-box" id="hcUnmatchedRegex" readOnly></textarea>
              </div>
              <div className="error-section">
                <div className="error-title">כותרות שאינן לפי הסדר</div>
                <textarea className="m3-input error-box" id="hcUnmatchedTags" readOnly></textarea>
              </div>
              <div className="error-section">
                <div className="error-title">תגים פותחים ללא תגים סוגרים</div>
                <textarea className="m3-input error-box" id="hcOpenNoClose" readOnly></textarea>
              </div>
              <div className="error-section">
                <div className="error-title">תגים סוגרים ללא תגים פותחים</div>
                <textarea className="m3-input error-box" id="hcCloseNoOpen" readOnly></textarea>
              </div>
              <div className="error-section">
                <div className="error-title">טקסט שאינו חלק מכותרת (באותה שורה)</div>
                <textarea className="m3-input error-box" id="hcHeadingErrors" readOnly></textarea>
              </div>
              <div className="result-msg" id="hcMissingLevels" style={{ color: "blue" }}></div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} id="tmpl-versions">
        <div className="popup-card">
          <div className="popup-header">ניהול גירסאות</div>
          <div className="popup-content">
            <div className="row">
              <input className="m3-input" id="versionDescription" placeholder="תיאור" />
              <button className="m3-btn filled" id="versionSaveBtn">שמור</button>
            </div>
            <div id="versionList" className="version-list-container"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
