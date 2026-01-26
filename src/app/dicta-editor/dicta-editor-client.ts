const API_BASE = "/api/dicta";

type ToolState = {
  currentBookId: string | null;
  selectedImagePath: string;
  ocrPdfPath: string;
  originalText: string | null;
  activeTool: string | null;
  isEditing: boolean;
};

const state: ToolState = {
  currentBookId: null,
  selectedImagePath: "",
  ocrPdfPath: "",
  originalText: null,
  activeTool: null,
  isEditing: false,
};

const qs = (id: string) => document.getElementById(id) as HTMLElement | null;

type ApiErrorShape = { detail?: string; error?: string };
type UploadResponse = { path: string; name?: string };
type FileReadResponse = { content: string };
type VersionItem = { version_id: string; description?: string; timestamp: string; filename: string; size?: number };
type ToolResult = { count?: number; changed?: boolean; message?: string; found?: boolean };
type ImageToHtmlResponse = { html?: string };
type DictaSyncResponse = { log: string[] };
type OcrResponse = { text?: string; session_cost?: number };
type HeaderErrorResponse = {
  unmatched_regex: string[];
  unmatched_tags: string[];
  opening_without_closing: string[];
  closing_without_opening: string[];
  heading_errors: string[];
  missing_levels: number[];
};
type VersionListResponse = { versions: VersionItem[] };
type BookItem = { _id: string; title: string; status: string; claimedBy?: { _id: string; name: string } | null; updatedAt: string; content?: string };
type BookLoadResponse = BookItem;

const getErrorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
const extractApiError = (data: unknown, status: number) => {
  if (data && typeof data === "object") {
    const details = data as ApiErrorShape;
    return details.detail || details.error || `HTTP ${status}`;
  }
  return `HTTP ${status}`;
};

async function apiPost<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  // Unified tools endpoint: /tools/xxx becomes /tools with tool=xxx
  let finalPath = path;
  let finalPayload = payload;
  
  const toolMatch = path.match(/^\/tools\/(.+)$/);
  if (toolMatch) {
    finalPath = "/tools";
    finalPayload = { tool: toolMatch[1], ...payload };
  }

  const res = await fetch(`${API_BASE}${finalPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(finalPayload),
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = extractApiError(data, res.status);
    throw new Error(message);
  }

  return data as T;
}

// Deprecated: used only for temp files if needed, but we now use book flow
async function apiUpload(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
  const data = (await res.json()) as ApiErrorShape & UploadResponse;
  if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
  return data;
}

async function apiGetBooks() {
    const res = await fetch(`${API_BASE}/books`);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as BookItem[];
}

async function apiLoadBook(id: string) {
    const res = await fetch(`${API_BASE}/books/${id}`);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as BookLoadResponse;
}

async function apiCreateBook(title: string) {
    const res = await fetch(`${API_BASE}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: "" })
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as BookItem;
}

async function apiUpdateBook(id: string, content: string) {
    const res = await fetch(`${API_BASE}/books/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

async function apiClaimBook(id: string) {
    const res = await fetch(`${API_BASE}/books/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: 'claim' })
    });
    if(!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return await res.json();
}

async function apiReleaseBook(id: string) {
    const res = await fetch(`${API_BASE}/books/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: 'release' })
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

function setResult(el: HTMLElement | null, text: string, isError = false) {
  if (!el) return;
  el.textContent = text;
  (el as HTMLElement).style.color = isError ? "red" : "inherit";
}

function ensureBookSelected() {
  if (!state.currentBookId) {
    alert("נא לבחור ספר תחילה");
    throw new Error("No book selected");
  }
}

function init() {
  setupTopBar();
  setupToolbar();

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (state.activeTool && !target.closest(".popup-card") && !target.closest(".tool-btn")) {
      closePopup();
    }
  });

  fetch(`${API_BASE}/health`).then(() => console.log("API Connected")).catch(() => console.error("API Disconnected"));

  // Check if bookId is passed in URL
  const urlParams = new URLSearchParams(window.location.search);
  const bookIdFromUrl = urlParams.get('bookId');
  
  if (bookIdFromUrl) {
    // Load specific book from URL
    loadBook(bookIdFromUrl);
  } else {
    // Auto-open book selector on page load
    setTimeout(() => openTool('bookSelector'), 300);
  }
}

function setupTopBar() {
  qs("openBookBtn")?.addEventListener("click", () => openTool('bookSelector'));
  qs("saveBookBtn")?.addEventListener("click", saveCurrentBook);
  // qs("openFileBtn")?.addEventListener("click", () => (qs("filePicker") as HTMLInputElement)?.click());
  // qs("filePicker")?.addEventListener("change", handleUploadFile as EventListener);

  qs("fontPlusBtn")?.addEventListener("click", () => adjustFontSize(2));
  qs("fontMinusBtn")?.addEventListener("click", () => adjustFontSize(-2));

  // qs("versionBtn")?.addEventListener("click", () => openTool("versions"));
  qs("editFab")?.addEventListener("click", toggleEditMode as EventListener);
}


function adjustFontSize(delta: number) {
  const el = qs("filePreview") as HTMLElement;
  const display = qs("fontSizeDisplay");
  if (!el || !display) return;
  const current = parseInt(getComputedStyle(el).fontSize, 10);
  const newSize = Math.max(10, Math.min(60, current + delta));
  el.style.fontSize = `${newSize}px`;
  display.textContent = String(newSize);
}

async function handleUploadFile() {
  // Deprecated: File upload is now handled through the book management system
  // This function is kept for backwards compatibility but should not be called
  console.warn("handleUploadFile is deprecated. Use the book selector instead.");
}

async function refreshPreview() {
  if (!state.currentBookId) return;

  if (state.isEditing) {
    state.isEditing = false;
    const fab = qs("editFab") as HTMLElement;
    if (fab) {
      fab.innerHTML = '<span class="material-symbols-outlined">edit</span>';
      fab.classList.remove("saving");
      fab.title = "עריכה ידנית";
    }
  }

  // Load content directly from MongoDB
  const data = await apiLoadBook(state.currentBookId);

  const editFab = qs("editFab") as HTMLElement;
  if (editFab) editFab.style.display = "flex";

  const bookContent = data.content || "";
  const content = bookContent
    .replace(/^<h([1-6])>(.*?)<\/h\1>/gim, '<div class="content_h$1">$2</div>')
    .replace(/\n/g, "<br>");

  const preview = qs("filePreview");
  if (preview) preview.innerHTML = content;

  buildNavigation(bookContent.split("\n"));
}

async function toggleEditMode() {
  ensureBookSelected();
  const fab = qs("editFab") as HTMLElement;
  const preview = qs("filePreview") as HTMLElement;
  if (!fab || !preview) return;

  if (!state.isEditing) {
    state.isEditing = true;
    fab.innerHTML = '<span class="material-symbols-outlined">save</span>';
    fab.classList.add("saving");
    fab.title = "שמור שינויים";

    // Load content from MongoDB
    const data = await apiLoadBook(state.currentBookId!);

    const textarea = document.createElement("textarea");
    textarea.className = "editor-textarea";
    textarea.value = data.content || "";

    preview.innerHTML = "";
    preview.appendChild(textarea);
    textarea.setSelectionRange(0, 0);
    textarea.focus();
    textarea.scrollTop = 0;
  } else {
    const textarea = preview.querySelector("textarea");
    if (!textarea) return;
    const newContent = textarea.value;

    try {
      // Save content directly to MongoDB
      await apiUpdateBook(state.currentBookId!, newContent);
      await refreshPreview();
    } catch (e: unknown) {
      alert("שגיאה בשמירת הקובץ: " + getErrorMessage(e));
    }
  }
}

function buildNavigation(lines: string[]) {
  const nav = qs("navigationList") as HTMLElement;
  if (!nav) return;
  nav.innerHTML = "";
  const headingRegex = /<h([1-6])>(.*?)<\/h\1>/i;

  lines.forEach((line) => {
    const match = line.match(headingRegex);
    if (match) {
      const level = Number(match[1]);
      const title = match[2];
      const fullTag = match[0];

      const div = document.createElement("div");
      div.className = "nav-item";
      div.textContent = title;
      div.style.paddingRight = `${(level - 1) * 10}px`;

      div.onclick = () => {
        if (state.isEditing) {
          const textarea = (qs("filePreview") as HTMLElement)?.querySelector("textarea");
          if (textarea) {
            const index = textarea.value.indexOf(fullTag);
            if (index !== -1) {
              textarea.focus();
              textarea.setSelectionRange(index, index);
              const textUpTo = textarea.value.substring(0, index);
              const lineCount = textUpTo.split("\n").length;
              const lineHeight = 35.2;
              textarea.scrollTop = (lineCount * lineHeight) - 100;
            } else {
              alert("הכותרת לא נמצאה (אולי הטקסט נערך?)");
            }
          }
        } else {
          const children = Array.from((qs("filePreview") as HTMLElement)?.children || []);
          const el = children.find((child) => child.textContent?.includes(title));
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }
      };

      nav.appendChild(div);
    }
  });
}

function setupToolbar() {
  document.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = (btn as HTMLElement).dataset.tool || "";
      if (state.activeTool === tool) {
        closePopup();
      } else {
        openTool(tool);
      }
    });
  });
}

function closePopup() {
  document.querySelectorAll(".portal-element").forEach((el) => el.remove());
  const container = qs("popupsContainer") as HTMLElement | null;
  if (container) {
    container.innerHTML = "";
    container.classList.remove("active");
  }
  state.activeTool = null;
  document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
}

function openTool(toolName: string) {
  closePopup();
  state.activeTool = toolName;

  const btn = document.querySelector(`.tool-btn[data-tool="${toolName}"]`);
  if (btn) btn.classList.add("active");

  const tmpl = qs(`tmpl-${toolName}`);
  if (!tmpl) {
    if (toolName === "versions") {
      const vTmpl = qs("tmpl-versions");
      renderPopup(vTmpl);
      bindToolEvents("versions");
      return;
    }
    console.error("Unknown tool template:", toolName);
    return;
  }

  renderPopup(tmpl);
  bindToolEvents(toolName);
}

function renderPopup(template: HTMLElement | null) {
  const container = qs("popupsContainer") as HTMLElement | null;
  if (!container || !template) return;
  container.innerHTML = "";
  
  if (template instanceof HTMLTemplateElement) {
    const clone = template.content.cloneNode(true);
    container.appendChild(clone);
  } else {
    // Fallback for non-template elements (like hidden divs in React)
    // We assume the content is the children of the container
    Array.from(template.childNodes).forEach(node => {
        container.appendChild(node.cloneNode(true));
    });
  }
  
  container.classList.add("active");
}

const LISTS = {
  LEVELS_6: ["1", "2", "3", "4", "5", "6"],
  HEADERS: ["דף", "עמוד", "פרק", "פסוק", "שאלה", "סימן", "סעיף", "הלכה", "הלכות", "סק", "ענף"],
  SL_START: ["", "(", "["],
  SL_END: ["", ".", ",", "'", "',", "'.", "]", ")", "']", "')", "].", ").", "],", "),", "'),", "').", "'],", "']."],
};

async function loadBookList() {
    const listContainer = qs("bookListContainer");
    if (!listContainer) return;
    listContainer.innerHTML = 'טוען...';
    try {
        const books = await apiGetBooks();
        renderBookList(books);
    } catch (e) {
        listContainer.innerHTML = `<div style="color:red">Error: ${getErrorMessage(e)}</div>`;
    }
}

function renderBookList(books: BookItem[]) {
    const listContainer = qs("bookListContainer");
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    if (books.length === 0) {
        listContainer.innerHTML = '<div style="padding:10px; text-align:center">אין ספרים זמינים כרגע.</div>';
        return;
    }

    const ul = document.createElement("div");
    ul.className = "book-list"; 
    
    books.forEach(book => {
        const row = document.createElement("div");
        row.className = "book-list-item";
        row.style.padding = "10px";
        row.style.borderBottom = "1px solid #eee";
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        
        // סטטוס הספר
        const statusBadge = getStatusBadge(book.status);
        const claimedByText = book.claimedBy ? ` (${book.claimedBy.name})` : '';
        
        row.innerHTML = `
            <div style="flex:1">
                <strong>${book.title}</strong>
                <div style="font-size: 0.8em; color: gray; margin-top: 4px;">
                    ${statusBadge}${claimedByText}
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <span style="font-size: 0.75em; color: gray;">${new Date(book.updatedAt).toLocaleDateString()}</span>
            </div>
        `;
        
        // כפתור פעולה בהתאם לסטטוס
        const actionBtn = document.createElement("button");
        actionBtn.className = "m3-btn text";
        actionBtn.style.marginRight = "8px";
        
        if (book.status === 'available') {
            actionBtn.textContent = "תפוס";
            actionBtn.onclick = (e) => { e.stopPropagation(); claimAndLoadBook(book._id); };
        } else if (state.currentBookId === book._id) {
            actionBtn.textContent = "פתח";
            actionBtn.onclick = (e) => { e.stopPropagation(); loadBook(book._id); };
        } else {
            // ספר תפוס ע"י מישהו אחר
            actionBtn.textContent = "תפוס";
            actionBtn.disabled = true;
            actionBtn.style.opacity = "0.5";
        }
        
        row.querySelector('div:last-child')?.prepend(actionBtn);
        
        // Highlight active
        if (state.currentBookId === book._id) {
            row.style.backgroundColor = "#e3f2fd";
        }

        ul.appendChild(row);
    });
    listContainer.appendChild(ul);
}

function getStatusBadge(status: string) {
    switch(status) {
        case 'available': return '<span style="color: green;">🟢 פנוי</span>';
        case 'in-progress': return '<span style="color: orange;">🟠 בעריכה</span>';
        case 'completed': return '<span style="color: blue;">🔵 הושלם</span>';
        default: return status;
    }
}

async function claimAndLoadBook(id: string) {
    try {
        await apiClaimBook(id);
        await loadBook(id);
    } catch (e) {
        alert("שגיאה בתפיסת הספר: " + getErrorMessage(e));
    }
}

async function loadBook(id: string) {
    try {
        const data = await apiLoadBook(id);
        state.currentBookId = data._id;
        
        // Update UI
        const nameEl = qs("selectedFileName");
        if (nameEl) nameEl.textContent = data.title;
        
        // Show save button
        const saveBtn = qs("saveBookBtn") as HTMLElement;
        if (saveBtn) saveBtn.style.display = "flex";
        
        // Show edit FAB
        const editFab = qs("editFab") as HTMLElement;
        if (editFab) editFab.style.display = "flex";
        
        // Load content into preview
        const preview = qs("filePreview");
        const bookContent = data.content || "";
        if (preview) {
            const content = bookContent
                .replace(/^<h([1-6])>(.*?)<\/h\1>/gim, '<div class="content_h$1">$2</div>')
                .replace(/\n/g, "<br>");
            preview.innerHTML = content;
        }
        
        buildNavigation(bookContent.split("\n"));
        
        closePopup();
    } catch (e) {
        alert("שגיאה בטעינת הספר: " + getErrorMessage(e));
    }
}

async function createNewBook() {
    const input = qs("newBookTitle") as HTMLInputElement;
    const title = input?.value?.trim();
    if (!title) return alert("נא להזין שם לספר");
    
    try {
        const newBook = await apiCreateBook(title);
        input.value = "";
        await loadBookList(); // Refresh list
        // Optionally auto-open:
        // loadBook(newBook._id);
    } catch (e) {
        alert("שגיאה ביצירת ספר: " + getErrorMessage(e));
    }
}

async function saveCurrentBook() {
    if (!state.currentBookId) return alert("אין ספר פתוח לשמירה");
    
    let content = "";
    
    if (state.isEditing) {
        const textarea = (qs("filePreview") as HTMLElement)?.querySelector("textarea");
        content = textarea?.value || "";
    } else {
        // If not in edit mode, load current content from DB 
        // (tools auto-save, so this is mainly for consistency)
        try {
            const data = await apiLoadBook(state.currentBookId);
            content = data.content || "";
        } catch (e) {
            return alert("שגיאה בקריאת הספר: " + getErrorMessage(e));
        }
    }

    const btn = qs("saveBookBtn");
    if(btn) btn.textContent = "שומר...";
    
    try {
        await apiUpdateBook(state.currentBookId, content);
        
        if (state.isEditing) {
           await refreshPreview();
        }
        
        alert("הספר נשמר בהצלחה!");
    } catch (e) {
        alert("שגיאה בשמירה: " + getErrorMessage(e));
    } finally {
        if(btn) btn.innerHTML = '<span class="material-symbols-outlined">save</span> שמור ספר';
    }
}

function bindToolEvents(tool: string) {
  const pqs = (sel: string) => (qs("popupsContainer") as HTMLElement | null)?.querySelector(`#${sel}`) as HTMLElement | null;

  switch (tool) {
    case "bookSelector":
        pqs("refreshBooksBtn")?.addEventListener("click", loadBookList);
        loadBookList();
        break;
    case "createHeaders":
      pqs("createHeadersBtn")?.addEventListener("click", createHeaders);
      setupCombobox("headersCombobox", "createHeadersFind", LISTS.HEADERS);
      setupCombobox("createHeadersLevelBox", "createHeadersLevel", LISTS.LEVELS_6);
      break;
    case "singleLetterHeaders":
      pqs("singleLetterBtn")?.addEventListener("click", createSingleLetterHeaders);
      setupCombobox("singleLetterStartBox", "singleLetterStart", LISTS.SL_START);
      setupCombobox("singleLetterEndBox", "singleLetterEnd", LISTS.SL_END);
      setupCombobox("singleLetterLevelBox", "singleLetterLevel", LISTS.LEVELS_6);
      break;
    case "addPageNumber":
      pqs("addPageNumberBtn")?.addEventListener("click", addPageNumber);
      break;
    case "changeHeading":
      pqs("changeHeadingBtn")?.addEventListener("click", changeHeadingLevel);
      setupCombobox("changeHeadingCurrentBox", "changeHeadingCurrent", LISTS.LEVELS_6);
      setupCombobox("changeHeadingNewBox", "changeHeadingNew", LISTS.LEVELS_6);
      break;
    case "punctuate":
      pqs("punctuateBtn")?.addEventListener("click", emphasizeAndPunctuate);
      break;
    case "pageBHeader":
      pqs("pageBHeaderBtn")?.addEventListener("click", createPageBHeaders);
      setupCombobox("pageBHeaderLevelBox", "pageBHeaderLevel", LISTS.LEVELS_6);
      break;
    case "replacePageB":
      pqs("replacePageBBtn")?.addEventListener("click", replacePageBHeaders);
      break;
    case "imageToHtml":
      pqs("uploadImageBtn")?.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement)?.files?.[0];
          if (file) {
            const res = await apiUpload(file);
            const imagePath = pqs("imagePath") as HTMLInputElement | null;
            if (imagePath) imagePath.value = res.path;
            state.selectedImagePath = res.path;
          }
        };
        input.click();
      });
      pqs("imageToHtmlBtn")?.addEventListener("click", imageToHtml);
      pqs("imageCopyBtn")?.addEventListener("click", copyImageHtml);
      break;
    case "cleanText":
      pqs("cleanTextBtn")?.addEventListener("click", cleanText);
      pqs("cleanUndoBtn")?.addEventListener("click", undoCleanText);
      break;
    case "dictaSync":
      pqs("dictaSyncBtn")?.addEventListener("click", dictaSync);
      break;
    case "ocr":
      pqs("ocrRunBtn")?.addEventListener("click", ocrRun);
      pqs("ocrUploadBtn")?.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".pdf";
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement)?.files?.[0];
          if (file) {
            const res = await apiUpload(file);
            const ocrPath = pqs("ocrPdfPath") as HTMLInputElement | null;
            if (ocrPath) ocrPath.value = res.path;
          }
        };
        input.click();
      });
      break;
    case "headerCheck":
      pqs("headerCheckBtn")?.addEventListener("click", headerErrorCheck);
      break;
    case "versions":
      pqs("versionSaveBtn")?.addEventListener("click", saveVersion);
      loadVersions();
      break;
    default:
      break;
  }
}

function setupCombobox(wrapperId: string, inputId: string, optionsData: string[] = []) {
  const wrapper = (qs("popupsContainer") as HTMLElement | null)?.querySelector(`#${wrapperId}`) as HTMLElement | null;
  if (!wrapper) return;

  const input = wrapper.querySelector(`#${inputId}`) as HTMLInputElement | null;
  const btn = wrapper.querySelector(".combo-btn") as HTMLElement | null;
  if (!input || !btn) return;

  let options = wrapper.querySelector(".combo-options") as HTMLElement | null;
  if (!options) {
    options = document.createElement("div");
    options.className = "combo-options portal-element";
    
    // Populate immediately (no filtering)
    optionsData.forEach((item) => {
        const div = document.createElement("div");
        div.className = "combo-item";
        div.textContent = item === "" ? "\u00A0" : item; // Handle empty string
        div.onclick = (e) => {
          e.stopPropagation();
          if (input) input.value = item;
          options?.classList.remove("active");
        };
        options?.appendChild(div);
      });
  }

  const updatePosition = () => {
    if (!options || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownMaxHeight = 200;

    options.style.position = "fixed";
    options.style.left = `${rect.left}px`;
    options.style.width = `${rect.width}px`;
    options.style.zIndex = "99999"; 

    // Default downwards
    options.style.top = `${rect.bottom}px`;
    options.style.bottom = "auto";
    options.style.marginTop = "4px";

    // Intelligent placement
    if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
      options.style.top = "auto";
      options.style.bottom = `${viewportHeight - rect.top}px`;
      options.style.marginTop = "0";
      options.style.marginBottom = "4px";
    }
  };

  const toggle = (e: Event) => {
    e.stopPropagation();
    if (!options) return;

    // Close others
    document.querySelectorAll(".portal-element.active").forEach((el) => {
      if (el !== options) el.classList.remove("active");
    });

    if (options.classList.contains("active")) {
      options.classList.remove("active");
      return;
    }

    // Append to body if not already
    if (options.parentNode !== document.body) {
      document.body.appendChild(options);
    }

    updatePosition();
    options.classList.add("active");
  };

  btn.addEventListener("click", toggle);
  
  // Original app closed menu on clicking input? Or toggled? 
  // App.js said: input.onclick = toggle; 
  // We'll mimic that if desired, or just let them type. 
  // Usually clicking input allows typing. 
  // If we enable toggling on input click, typing becomes hard if it closes.
  // We will omit input.onclick for usability, or make it open only.
  input.addEventListener("click", (e) => {
       e.stopPropagation();
       if (options && !options.classList.contains("active")) {
           // duplicates logic from toggle(true) phase
            document.querySelectorAll(".portal-element.active").forEach((el) => {
                if (el !== options) el.classList.remove("active");
            });
            if (options.parentNode !== document.body) {
                document.body.appendChild(options);
            }
            updatePosition();
            options.classList.add("active");
       }
  });

  document.addEventListener("click", (e) => {
    const target = e.target as Node;
    // Close if click outside wrapper AND outside options
    if (!wrapper.contains(target) && !options?.contains(target)) {
      options?.classList.remove("active");
    }
  });
  
  window.addEventListener("scroll", () => {
      if (options?.classList.contains("active")) updatePosition();
  }, true); // Capture scroll to update position if scrolling parent

  window.addEventListener("resize", () => {
    if (options?.classList.contains("active")) updatePosition();
  });
}

function splitList(value: string) {
  return value
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function createHeaders() {
  ensureBookSelected();
  const res = await apiPost<ToolResult>("/tools/create-headers", {
    book_id: state.currentBookId,
    find_word: (qs("createHeadersFind") as HTMLInputElement)?.value,
    end: Number((qs("createHeadersEnd") as HTMLInputElement)?.value),
    level_num: Number((qs("createHeadersLevel") as HTMLInputElement)?.value),
  });
  setResult(qs("createHeadersResult"), res.count ? `נוצרו ${res.count}` : "לא נמצא", !res.count);
  await refreshPreview();
}

async function createSingleLetterHeaders() {
  ensureBookSelected();
  const res = await apiPost<ToolResult>("/tools/create-single-letter-headers", {
    book_id: state.currentBookId,
    end_suffix: (qs("singleLetterEnd") as HTMLInputElement)?.value,
    end: Number((qs("singleLetterMax") as HTMLInputElement)?.value),
    level_num: Number((qs("singleLetterLevel") as HTMLInputElement)?.value),
    ignore: splitList((qs("singleLetterIgnore") as HTMLInputElement)?.value || ""),
    start: (qs("singleLetterStart") as HTMLInputElement)?.value,
    remove: splitList((qs("singleLetterRemove") as HTMLInputElement)?.value || ""),
    bold_only: (qs("singleLetterBold") as HTMLInputElement)?.checked,
  });
  setResult(qs("singleLetterResult"), res.count ? `נוצרו ${res.count}` : "אין שינוי", !res.count);
  await refreshPreview();
}

async function changeHeadingLevel() {
  ensureBookSelected();
  const res = await apiPost<ToolResult>("/tools/change-heading-level", {
    book_id: state.currentBookId,
    current_level: (qs("changeHeadingCurrent") as HTMLInputElement)?.value,
    new_level: (qs("changeHeadingNew") as HTMLInputElement)?.value,
  });
  setResult(qs("changeHeadingResult"), res.message || "עודכן", !res.changed);
  await refreshPreview();
}

async function emphasizeAndPunctuate() {
  ensureBookSelected();
  const res = await apiPost<ToolResult>("/tools/emphasize-and-punctuate", {
    book_id: state.currentBookId,
    add_ending: (qs("punctuateEnding") as HTMLSelectElement)?.value,
    emphasize_start: (qs("punctuateEmphasize") as HTMLInputElement)?.checked,
  });
  setResult(qs("punctuateResult"), res.changed ? "בוצע" : "אין שינוי", !res.changed);
  await refreshPreview();
}

async function addPageNumber() {
  ensureBookSelected();
  const res = await apiPost<ToolResult>("/tools/add-page-number", {
    book_id: state.currentBookId,
    replace_with: (qs("addPageNumberType") as HTMLSelectElement)?.value,
  });
  setResult(qs("addPageNumberResult"), res.message || "בוצע", !res.changed);
  await refreshPreview();
}

async function createPageBHeaders() {
  ensureBookSelected();
  const res = await apiPost<ToolResult>("/tools/create-page-b-headers", {
    book_id: state.currentBookId,
    header_level: Number((qs("pageBHeaderLevel") as HTMLInputElement)?.value),
  });
  setResult(qs("pageBHeaderResult"), res.count ? `נוספו ${res.count}` : "אין שינוי", !res.count);
  await refreshPreview();
}

async function replacePageBHeaders() {
  ensureBookSelected();
  const res = await apiPost<ToolResult>("/tools/replace-page-b-headers", {
    book_id: state.currentBookId,
    replace_type: (qs("replacePageBType") as HTMLSelectElement)?.value,
  });
  setResult(qs("replacePageBResult"), res.count ? `בוצעו ${res.count}` : "אין שינוי", !res.count);
  await refreshPreview();
}

async function cleanText() {
  ensureBookSelected();
  // Store original for undo (load from DB)
  const original = await apiLoadBook(state.currentBookId!);
  state.originalText = original.content || null;

  const res = await apiPost<ToolResult>("/tools/text-cleaner", {
    book_id: state.currentBookId,
    options: {
      remove_empty_lines: (qs("cleanEmpty") as HTMLInputElement)?.checked,
      remove_double_spaces: (qs("cleanSpaces") as HTMLInputElement)?.checked,
      remove_spaces_before: (qs("cleanBefore") as HTMLInputElement)?.checked,
      remove_spaces_after: (qs("cleanAfter") as HTMLInputElement)?.checked,
      remove_spaces_around_newlines: (qs("cleanAround") as HTMLInputElement)?.checked,
      replace_double_quotes: (qs("cleanQuotes") as HTMLInputElement)?.checked,
      normalize_quotes: true,
    },
  });
  setResult(qs("cleanTextResult"), res.changed ? "נוקה בהצלחה" : "נקי", !res.changed);
  await refreshPreview();
}

async function undoCleanText() {
  if (!state.originalText || !state.currentBookId) return;
  await apiUpdateBook(state.currentBookId, state.originalText);
  setResult(qs("cleanTextResult"), "שוחזר");
  await refreshPreview();
}

async function imageToHtml() {
  const path = (qs("imagePath") as HTMLInputElement)?.value.trim();
  const res = await apiPost<ImageToHtmlResponse>("/tools/image-to-html", { path_or_url: path });
  setResult(qs("imageToHtmlResult"), res.html || "");
}

async function copyImageHtml() {
  const html = qs("imageToHtmlResult")?.textContent || "";
  if (html) navigator.clipboard.writeText(html);
}

async function dictaSync() {
  const folder = (qs("dictaFolder") as HTMLInputElement)?.value.trim();
  const res = await apiPost<DictaSyncResponse>("/tools/dicta-sync", { folder_path: folder });
  const log = qs("dictaLog") as HTMLElement;
  if (log) log.textContent = res.log.join("\n");
}

async function ocrRun() {
  const result = qs("ocrResult") as HTMLElement;
  if (result) result.textContent = "מתבצעת עבודה...";

  try {
    const payload = {
      pdf_path: (qs("ocrPdfPath") as HTMLInputElement)?.value,
      api_key: (qs("ocrApiKey") as HTMLInputElement)?.value,
      model: (qs("ocrModel") as HTMLInputElement)?.value,
      prompt: (qs("ocrPrompt") as HTMLTextAreaElement)?.value,
      pages_per_chunk: Number((qs("ocrPages") as HTMLInputElement)?.value),
      delay_seconds: Number((qs("ocrDelay") as HTMLInputElement)?.value),
    };
    const res = await apiPost<OcrResponse>("/tools/ocr", payload);
    if (result) {
      const costLine = res.session_cost ? `\nעלות משוערת: $${res.session_cost.toFixed(4)}` : "";
      result.textContent = `${res.text || "סיום"}${costLine}`.trim();
    }
  } catch (e: unknown) {
    if (result) result.textContent = "שגיאה: " + getErrorMessage(e);
  }
}

async function headerErrorCheck() {
  ensureBookSelected();

  (qs("hcUnmatchedRegex") as HTMLTextAreaElement).value = "";
  (qs("hcUnmatchedTags") as HTMLTextAreaElement).value = "";
  (qs("hcOpenNoClose") as HTMLTextAreaElement).value = "";
  (qs("hcCloseNoOpen") as HTMLTextAreaElement).value = "";
  (qs("hcHeadingErrors") as HTMLTextAreaElement).value = "";
  const missing = qs("hcMissingLevels");
  if (missing) missing.textContent = "";
  const resultsArea = qs("headerCheckResultsArea") as HTMLElement;
  if (resultsArea) resultsArea.style.display = "block";

  try {
    const res = await apiPost<HeaderErrorResponse>("/tools/header-error-checker", {
      book_id: state.currentBookId,
      re_start: (qs("headerCheckStart") as HTMLInputElement)?.value,
      re_end: (qs("headerCheckEnd") as HTMLInputElement)?.value,
      gershayim: (qs("headerCheckGershayim") as HTMLInputElement)?.checked,
      is_shas: (qs("headerCheckShas") as HTMLInputElement)?.checked,
    });

    (qs("hcUnmatchedRegex") as HTMLTextAreaElement).value = res.unmatched_regex.join("\n");
    (qs("hcUnmatchedTags") as HTMLTextAreaElement).value = res.unmatched_tags.join("\n");
    (qs("hcOpenNoClose") as HTMLTextAreaElement).value = res.opening_without_closing.join("\n");
    (qs("hcCloseNoOpen") as HTMLTextAreaElement).value = res.closing_without_opening.join("\n");
    (qs("hcHeadingErrors") as HTMLTextAreaElement).value = res.heading_errors.join("\n");

    if (res.missing_levels && res.missing_levels.length > 0) {
      if (missing) missing.textContent = "כותרות חסרות: " + res.missing_levels.join(", ");
    } else if (missing) {
      missing.textContent = "";
    }
  } catch (e: unknown) {
    alert("שגיאה בבדיקה: " + getErrorMessage(e));
  }
}

async function saveVersion() {
  ensureBookSelected();
  // Version system is currently disabled for DB-based workflow
  // TODO: Implement version history in MongoDB
  alert("מערכת הגרסאות אינה זמינה במצב עבודה עם MongoDB");
  return;
}

async function loadVersions() {
  // Version system is currently disabled for DB-based workflow
  const list = qs("versionList") as HTMLElement;
  if (!list) return;
  list.innerHTML = "<div style='padding: 10px; color: gray;'>מערכת הגרסאות אינה זמינה במצב עבודה עם MongoDB</div>";
}

export function initDictaEditor() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __dictaEditorInitialized?: boolean };
  if (w.__dictaEditorInitialized) return;
  w.__dictaEditorInitialized = true;
  init();
}
