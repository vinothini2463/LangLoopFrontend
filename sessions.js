/**
 * LangLoop – Sessions Controller  (v2 – Fixed)
 * ─────────────────────────────────────────────
 * Entity fields: { id, startTime, endTime, score, userId, deckId }
 * CRITICAL: session.id has NO @GeneratedValue — frontend MUST supply id on POST
 * startTime/endTime are LocalDateTime → ISO string "yyyy-MM-ddTHH:mm:ss"
 * API:  GET/POST/PUT/DELETE  /api/sessions / /api/sessions/{id}
 */

const PAGE_SIZE = 6;

let allSessions  = [];
let filteredSess = [];
let currentPage  = 1;
let editingId    = null;

/* ── API helper ─────────────────────────── */
async function apiCall(path, method = "GET", body = null) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" }
    };
    if (body !== null) opts.body = JSON.stringify(body);
    const res  = await fetch(BASE_URL + path, opts);
    if (res.status === 204) return null;
    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    return text ? JSON.parse(text) : null;
}

/* ── LOAD ───────────────────────────────── */
async function loadSessions() {
    show("sessLoading"); hide("sessTableWrapper"); hide("sessEmpty");
    try {
        allSessions = await apiCall("/api/sessions");
        if (!Array.isArray(allSessions)) allSessions = [];
        filterSessions();
        showToast("Sessions loaded!", "success");
    } catch (e) {
        console.error("loadSessions:", e);
        showToast("Failed to load sessions — is the server running?", "error");
        hide("sessLoading"); show("sessEmpty");
    }
}

/* ── FILTER / SORT ──────────────────────── */
function filterSessions() {
    const q    = (val("globalSearch")).toLowerCase();
    const sort = val("sortSessions") || "id-desc";

    filteredSess = allSessions.filter(s =>
        !q ||
        String(s.id).includes(q) ||
        String(s.userId).includes(q) ||
        String(s.deckId).includes(q)
    );

    filteredSess.sort((a, b) => {
        if (sort === "id-asc")     return a.id - b.id;
        if (sort === "id-desc")    return b.id - a.id;
        if (sort === "score-asc")  return a.score - b.score;
        if (sort === "score-desc") return b.score - a.score;
        return b.id - a.id;
    });

    currentPage = 1;
    renderSessionsPage();
}

/* ── RENDER ─────────────────────────────── */
function fmtDt(dt) {
    // Backend returns LocalDateTime array or ISO string
    if (!dt) return "—";
    if (Array.isArray(dt)) {
        // [year, month, day, hour, minute, second]
        const [yr, mo, dy, hr, mn] = dt;
        return `${yr}-${String(mo).padStart(2,"0")}-${String(dy).padStart(2,"0")} ${String(hr).padStart(2,"0")}:${String(mn).padStart(2,"0")}`;
    }
    return String(dt).substring(0, 16).replace("T", " ");
}

function scoreColor(s) {
    if (s >= 90) return "var(--success)";
    if (s >= 60) return "var(--warning)";
    return "var(--danger)";
}

function renderSessionsPage() {
    hide("sessLoading");
    if (filteredSess.length === 0) {
        hide("sessTableWrapper"); show("sessEmpty"); return;
    }
    hide("sessEmpty"); show("sessTableWrapper");

    const start = (currentPage - 1) * PAGE_SIZE;
    const paged = filteredSess.slice(start, start + PAGE_SIZE);

    document.getElementById("sessionsTableBody").innerHTML = paged.map(s => `
        <tr>
            <td><span style="color:var(--text-muted)">#${s.id}</span></td>
            <td>
                <span style="background:rgba(6,182,212,0.12);color:var(--accent);
                             padding:0.2rem 0.55rem;border-radius:99px;font-size:0.72rem;font-weight:600">
                    User ${s.userId}
                </span>
            </td>
            <td>
                <span style="background:rgba(124,58,237,0.12);color:#A78BFA;
                             padding:0.2rem 0.55rem;border-radius:99px;font-size:0.72rem;font-weight:600">
                    Deck ${s.deckId}
                </span>
            </td>
            <td style="color:var(--text-secondary);font-size:0.82rem">${fmtDt(s.startTime)}</td>
            <td style="color:var(--text-secondary);font-size:0.82rem">${fmtDt(s.endTime)}</td>
            <td>
                <span class="score-chip" style="background:${scoreColor(s.score)}22;
                             color:${scoreColor(s.score)};border:1px solid ${scoreColor(s.score)}44;
                             padding:0.2rem 0.55rem;border-radius:99px;font-size:0.78rem;font-weight:700">
                    ${s.score}
                </span>
            </td>
            <td>
                <div style="display:flex;gap:0.4rem">
                    <button class="tbl-btn tbl-btn-edit" title="Edit"
                        onclick="editSession(${s.id}, ${s.userId}, ${s.deckId}, '${dtForInput(s.startTime)}', '${dtForInput(s.endTime)}', ${s.score})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="tbl-btn tbl-btn-delete" title="Delete"
                        onclick="confirmDeleteSession(${s.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    renderSessionPagination();
}

function dtForInput(dt) {
    if (!dt) return "";
    if (Array.isArray(dt)) {
        const [yr, mo, dy, hr, mn] = dt;
        return `${yr}-${String(mo).padStart(2,"0")}-${String(dy).padStart(2,"0")}T${String(hr).padStart(2,"0")}:${String(mn).padStart(2,"0")}`;
    }
    return String(dt).substring(0, 16);
}

/* ── PAGINATION ─────────────────────────── */
function renderSessionPagination() {
    const total  = Math.ceil(filteredSess.length / PAGE_SIZE);
    const shown1 = Math.min((currentPage-1)*PAGE_SIZE+1, filteredSess.length);
    const shown2 = Math.min(currentPage*PAGE_SIZE, filteredSess.length);
    const row    = document.getElementById("sessPagination");

    row.innerHTML = `
        <span>Showing ${shown1}–${shown2} of ${filteredSess.length}</span>
        <div class="page-btns">
            <button class="page-btn" onclick="goPage(${currentPage-1})"
                ${currentPage===1?"disabled":""}>
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            ${Array.from({length:total},(_,i)=>
                `<button class="page-btn ${i+1===currentPage?"active":""}" onclick="goPage(${i+1})">${i+1}</button>`
            ).join("")}
            <button class="page-btn" onclick="goPage(${currentPage+1})"
                ${currentPage===total?"disabled":""}>
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>`;
}

function goPage(p) {
    const total = Math.ceil(filteredSess.length / PAGE_SIZE);
    if (p < 1 || p > total) return;
    currentPage = p; renderSessionsPage();
}

/* ── SAVE ───────────────────────────────── */
async function saveSession(isUpdate = false) {
    const userId    = parseInt(val("userId"));
    const deckId    = parseInt(val("deckId"));
    const startRaw  = val("startTime");
    const endRaw    = val("endTime");
    const score     = parseInt(val("score"));

    if (!userId || userId < 1)  { showToast("User ID is required.", "warning"); return; }
    if (!deckId || deckId < 1)  { showToast("Deck ID is required.", "warning"); return; }
    if (!startRaw)              { showToast("Start Time is required.", "warning"); return; }
    if (!endRaw)                { showToast("End Time is required.", "warning"); return; }
    if (isNaN(score) || score < 0) { showToast("Score must be ≥ 0.", "warning"); return; }
    if (new Date(endRaw) < new Date(startRaw)) {
        showToast("End time must be after start time.", "warning"); return;
    }

    // Backend expects LocalDateTime as ISO string (without timezone)
    // datetime-local gives "yyyy-MM-ddTHH:mm" — append :00 for seconds
    const startTime = startRaw.length === 16 ? startRaw + ":00" : startRaw;
    const endTime   = endRaw.length   === 16 ? endRaw   + ":00" : endRaw;

    const isEdit = isUpdate || (editingId !== null);

    // Session has no @GeneratedValue — must supply ID
    let id;
    if (isEdit) {
        id = editingId;
    } else {
        const manualId = val("sessionId").trim();
        id = manualId ? Number(manualId) : generateId();
    }

    const payload = { id, userId, deckId, startTime, endTime, score };

    const t = showToast(isEdit ? "Updating session…" : "Creating session…", "loading", 0);
    try {
        if (isEdit) {
            await apiCall(`/api/sessions/${id}`, "PUT", payload);
            showToast(`Session #${id} updated!`, "success");
        } else {
            await apiCall("/api/sessions", "POST", payload);
            showToast(`Session #${id} created!`, "success");
        }
        clearSessionForm();
        await loadSessions();
    } catch (e) {
        console.error("saveSession:", e);
        showToast(`Failed to save session: ${e.message}`, "error");
    } finally {
        _dismissToast(t);
    }
}

function generateId() {
    // Generate a time-based unique ID (fits in Long)
    return Math.floor(Date.now() / 100);
}

/* ── EDIT ───────────────────────────────── */
function editSession(id, userId, deckId, start, end, score) {
    editingId = id;
    setVal("sessionId",  id);
    setVal("userId",     userId);
    setVal("deckId",     deckId);
    setVal("startTime",  start);
    setVal("endTime",    end);
    setVal("score",      score);

    document.getElementById("sessionFormTitle").textContent = "Edit Session";
    document.getElementById("btnSave").disabled    = true;
    document.getElementById("btnUpdate").disabled  = false;
    document.getElementById("sessionId").disabled  = true;

    document.querySelector(".form-panel")?.scrollIntoView({ behavior: "smooth" });
    showToast(`Editing Session #${id}`, "info", 2500);
}

/* ── DELETE ─────────────────────────────── */
function confirmDeleteSession(id) {
    showConfirm(
        `Delete Study Session #${id}? This cannot be undone.`,
        () => deleteSession(id)
    );
}

async function deleteSession(id) {
    const t = showToast("Deleting session…", "loading", 0);
    try {
        await apiCall(`/api/sessions/${id}`, "DELETE");
        showToast(`Session #${id} deleted.`, "success");
        if (editingId === id) clearSessionForm();
        await loadSessions();
    } catch (e) {
        showToast(`Failed to delete session: ${e.message}`, "error");
    } finally {
        _dismissToast(t);
    }
}

/* ── CLEAR ──────────────────────────────── */
function clearSessionForm() {
    ["sessionId","userId","deckId","startTime","endTime","score"].forEach(id => setVal(id, ""));
    document.getElementById("sessionId").disabled  = false;
    document.getElementById("btnSave").disabled    = false;
    document.getElementById("btnUpdate").disabled  = true;
    document.getElementById("sessionFormTitle").textContent = "Log Session";
    editingId = null;
}

/* ── DOM helpers ────────────────────────── */
function val(id)      { return (document.getElementById(id)?.value || ""); }
function setVal(id,v) { const el = document.getElementById(id); if(el) el.value = v; }
function show(id)     { const el = document.getElementById(id); if(el) el.style.display = "block"; }
function hide(id)     { const el = document.getElementById(id); if(el) el.style.display = "none"; }

function _dismissToast(t) {
    if (!t || !t.parentNode) return;
    t.style.opacity = "0"; t.style.transform = "translateY(0.75rem)";
    t.style.transition = "all 0.3s ease";
    setTimeout(() => t?.remove(), 300);
}

document.addEventListener("DOMContentLoaded", loadSessions);
