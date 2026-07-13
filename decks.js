/**
 * LangLoop – Decks Controller  (v2 – Fixed)
 * ──────────────────────────────────────────
 * Entity fields:  { id, title, description, capacity, mentorName, ownerId }
 * NOTE: "ownerId" is a flat Long on the entity — NOT owner.id (no nested object)
 * API:  GET/POST/PUT/DELETE  /api/decks / /api/decks/{id}
 */

const PAGE_SIZE = 6;

let allDecks   = [];
let filteredDk = [];
let currentPage = 1;

/* ── API helper ─────────────────────────── */
const BASE_URL = "https://fullstackbackend-88h0.onrender.com";
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
async function loadDecks() {
    show("deckLoading"); hide("deckTableWrapper"); hide("deckEmpty");
    try {
        allDecks = await apiCall("/api/decks");
        if (!Array.isArray(allDecks)) allDecks = [];
        filteredDk = [...allDecks];
        filterDecks();
        showToast("Decks loaded!", "success");
    } catch (e) {
        console.error("loadDecks:", e);
        showToast("Failed to load decks — is the server running?", "error");
        hide("deckLoading"); show("deckEmpty");
    }
}

/* ── FILTER / SEARCH ────────────────────── */
function filterDecks() {
    const q = (val("globalSearch")).toLowerCase();
    filteredDk = allDecks.filter(d =>
        !q ||
        (d.title || "").toLowerCase().includes(q) ||
        (d.mentorName || "").toLowerCase().includes(q) ||
        String(d.id).includes(q)
    );
    currentPage = 1;
    renderDecksPage();
}

/* ── RENDER ─────────────────────────────── */
function renderDecksPage() {
    hide("deckLoading");

    if (filteredDk.length === 0) {
        hide("deckTableWrapper"); show("deckEmpty"); return;
    }
    hide("deckEmpty"); show("deckTableWrapper");

    const start = (currentPage - 1) * PAGE_SIZE;
    const paged = filteredDk.slice(start, start + PAGE_SIZE);

    document.getElementById("deckTableBody").innerHTML = paged.map(d => `
        <tr>
            <td><span style="color:var(--text-muted)">#${d.id}</span></td>
            <td style="font-weight:500;color:var(--text-primary)">${d.title || "—"}</td>
            <td style="color:var(--text-secondary);font-size:0.83rem;max-width:160px;
                       overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${d.description || "—"}
            </td>
            <td>
                <span style="background:rgba(6,182,212,0.12);color:var(--accent);
                             padding:0.2rem 0.55rem;border-radius:99px;font-size:0.72rem;font-weight:600">
                    ${d.capacity}
                </span>
            </td>
            <td style="color:var(--text-secondary)">${d.mentorName || "—"}</td>
            <td><span style="color:var(--text-muted)">#${d.ownerId ?? "—"}</span></td>
            <td>
                <div style="display:flex;gap:0.4rem">
                    <button class="tbl-btn tbl-btn-edit" title="Edit"
                        onclick="editDeck(${d.id})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="tbl-btn tbl-btn-delete" title="Delete"
                        onclick="confirmDeleteDeck(${d.id}, '${escStr(d.title)}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    renderDeckPagination();
}

/* ── PAGINATION ─────────────────────────── */
function renderDeckPagination() {
    const total = Math.ceil(filteredDk.length / PAGE_SIZE);
    const shown1 = Math.min((currentPage-1)*PAGE_SIZE+1, filteredDk.length);
    const shown2 = Math.min(currentPage*PAGE_SIZE, filteredDk.length);
    const row = document.getElementById("deckPagination");

    row.innerHTML = `
        <span>Showing ${shown1}–${shown2} of ${filteredDk.length}</span>
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
    const total = Math.ceil(filteredDk.length / PAGE_SIZE);
    if (p < 1 || p > total) return;
    currentPage = p; renderDecksPage();
}

/* ── SAVE ───────────────────────────────── */
async function saveDeck(e) {
    e.preventDefault();

    const id          = val("deckId");
    const title       = val("title").trim();
    const description = val("description").trim();
    const capacity    = Number(val("capacity"));
    const mentorName  = val("mentorName").trim();
    const ownerId     = Number(val("ownerId"));

    if (!title)       { showToast("Title is required.",   "warning"); return; }
    if (!description) { showToast("Description is required.", "warning"); return; }
    if (!capacity || capacity < 1) { showToast("Capacity must be > 0.", "warning"); return; }
    if (!mentorName)  { showToast("Mentor name is required.", "warning"); return; }
    if (!ownerId || ownerId < 1)   { showToast("Owner ID is required.", "warning"); return; }

    // Payload matches entity fields exactly
    const payload = { title, description, capacity, mentorName, ownerId };

    const t = showToast(id ? "Updating deck…" : "Creating deck…", "loading", 0);
    try {
        if (id) {
            await apiCall(`/api/decks/${id}`, "PUT", payload);
            showToast(`Deck "${title}" updated!`, "success");
        } else {
            await apiCall("/api/decks", "POST", payload);
            showToast(`Deck "${title}" created!`, "success");
        }
        resetDeckForm();
        await loadDecks();
    } catch (err) {
        console.error("saveDeck:", err);
        showToast(`Failed to save deck: ${err.message}`, "error");
    } finally {
        _dismissToast(t);
    }
}

/* ── EDIT ───────────────────────────────── */
async function editDeck(id) {
    const t = showToast("Loading deck data…", "loading", 0);
    try {
        const deck = await apiCall(`/api/decks/${id}`);
        _dismissToast(t);
        setVal("deckId",      deck.id);
        setVal("title",       deck.title);
        setVal("description", deck.description);
        setVal("capacity",    deck.capacity);
        setVal("mentorName",  deck.mentorName);
        // Entity has flat ownerId, not nested owner object
        setVal("ownerId",     deck.ownerId);
        document.getElementById("deckFormTitle").textContent = "Edit Deck";
        document.getElementById("submitBtnText").textContent = "Update Deck";
        document.querySelector(".form-panel")?.scrollIntoView({ behavior: "smooth" });
        showToast(`Editing Deck #${id}`, "info", 2500);
    } catch (e) {
        _dismissToast(t);
        showToast("Failed to load deck data.", "error");
    }
}

/* ── DELETE ─────────────────────────────── */
function confirmDeleteDeck(id, title) {
    showConfirm(
        `Delete deck "${title}" (ID #${id})?`,
        () => deleteDeck(id, title)
    );
}

async function deleteDeck(id, title) {
    const t = showToast("Deleting deck…", "loading", 0);
    try {
        await apiCall(`/api/decks/${id}`, "DELETE");
        showToast(`Deck "${title}" deleted.`, "success");
        await loadDecks();
    } catch (e) {
        showToast(`Failed to delete deck: ${e.message}`, "error");
    } finally {
        _dismissToast(t);
    }
}

/* ── RESET FORM ─────────────────────────── */
function resetDeckForm() {
    document.getElementById("deckForm")?.reset();
    setVal("deckId", "");
    document.getElementById("deckFormTitle").textContent = "Add Deck";
    document.getElementById("submitBtnText").textContent = "Add Deck";
}

/* ── DOM helpers ────────────────────────── */
function val(id)      { return (document.getElementById(id)?.value || ""); }
function setVal(id,v) { const el = document.getElementById(id); if(el) el.value = v; }
function show(id)     { const el = document.getElementById(id); if(el) el.style.display = "block"; }
function hide(id)     { const el = document.getElementById(id); if(el) el.style.display = "none"; }
function escStr(s)    { return (s || "").replace(/'/g, "\\'"); }

function _dismissToast(t) {
    if (!t || !t.parentNode) return;
    t.style.opacity = "0"; t.style.transform = "translateY(0.75rem)";
    t.style.transition = "all 0.3s ease";
    setTimeout(() => t?.remove(), 300);
}

document.addEventListener("DOMContentLoaded", loadDecks);
