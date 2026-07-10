/**
 * LangLoop – Flashcards Controller  (v2 – Fixed)
 * ───────────────────────────────────────────────
 * Entity fields: { id, frontContent, backContent, orderIndex, deckId }
 * NOTE: orderIndex uses @Positive — must be >= 1 (not 0)
 * API:  GET/POST/PUT/DELETE  /api/flashcards / /api/flashcards/{id}
 */

let allCards  = [];
let filteredC = [];

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
async function loadCards() {
    show("cardsLoading"); hide("cardsGrid"); hide("cardsEmpty");
    try {
        allCards = await apiCall("/api/flashcards");
        if (!Array.isArray(allCards)) allCards = [];
        filterCards();
        showToast("Flashcards loaded!", "success");
    } catch (e) {
        console.error("loadCards:", e);
        showToast("Failed to load flashcards — is the server running?", "error");
        hide("cardsLoading"); show("cardsEmpty");
    }
}

/* ── FILTER ─────────────────────────────── */
function filterCards() {
    const q    = (val("globalSearch")).toLowerCase();
    const deck = val("deckFilter").trim();

    filteredC = allCards.filter(c => {
        const matchQ    = !q || (c.frontContent || "").toLowerCase().includes(q)
                               || (c.backContent || "").toLowerCase().includes(q);
        const matchDeck = !deck || String(c.deckId) === deck;
        return matchQ && matchDeck;
    });

    renderCardsGrid();
}

/* ── RENDER FLIP CARDS ──────────────────── */
function renderCardsGrid() {
    hide("cardsLoading");

    if (filteredC.length === 0) {
        hide("cardsGrid"); show("cardsEmpty"); return;
    }
    hide("cardsEmpty");

    const grid = document.getElementById("cardsGrid");
    grid.style.display = "grid";

    grid.innerHTML = filteredC.map(c => `
        <div class="flip-card" id="card-${c.id}" onclick="flipCard(${c.id})">
            <div class="flip-card-inner">
                <!-- FRONT -->
                <div class="flip-card-front">
                    <div>
                        <span class="card-face-label front-label">Question</span>
                        <div class="card-face-content">${c.frontContent || "—"}</div>
                    </div>
                    <div class="card-face-meta">
                        <span class="deck-badge">Deck #${c.deckId}</span>
                        <div class="card-actions" onclick="event.stopPropagation()">
                            <button class="tbl-btn tbl-btn-edit" title="Edit"
                                onclick="openEditCard(${c.id}, ${escNum(c.frontContent)}, ${escNum(c.backContent)}, ${c.orderIndex}, ${c.deckId})">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="tbl-btn tbl-btn-delete" title="Delete"
                                onclick="confirmDeleteCard(${c.id})">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <!-- BACK -->
                <div class="flip-card-back">
                    <div>
                        <span class="card-face-label back-label">Answer</span>
                        <div class="card-face-content">${c.backContent || "—"}</div>
                    </div>
                    <div class="card-face-meta">
                        <span class="flip-hint"><i class="fa-solid fa-rotate"></i> Click to flip back</span>
                        <span style="font-size:0.72rem;color:var(--text-muted)">Order: ${c.orderIndex}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join("");
}

/* Helper to encode string for inline onclick attr */
function escNum(s) { return JSON.stringify(String(s || "")); }

/* ── FLIP ───────────────────────────────── */
function flipCard(id) {
    document.getElementById(`card-${id}`)?.classList.toggle("flipped");
}

/* ── OPEN MODAL ─────────────────────────── */
function openCardForm() {
    clearCardForm();
    document.getElementById("cardFormModalTitle").textContent = "Add Flashcard";
    document.getElementById("cardFormModal").classList.add("show");
}

function openEditCard(id, front, back, orderIndex, deckId) {
    setVal("cardId",       id);
    setVal("frontContent", front);
    setVal("backContent",  back);
    setVal("orderIndex",   orderIndex);
    setVal("deckId",       deckId);
    document.getElementById("cardFormModalTitle").textContent = "Edit Flashcard";
    document.getElementById("cardFormModal").classList.add("show");
    showToast(`Editing card #${id}`, "info", 2500);
}

function closeCardForm() {
    document.getElementById("cardFormModal").classList.remove("show");
    clearCardForm();
}

function clearCardForm() {
    ["cardId","frontContent","backContent","orderIndex","deckId"].forEach(id => setVal(id, ""));
}

/* ── SAVE ───────────────────────────────── */
async function saveCard() {
    const id         = val("cardId");
    const front      = val("frontContent").trim();
    const back       = val("backContent").trim();
    const orderIndex = parseInt(val("orderIndex")) || 1;
    const deckId     = parseInt(val("deckId"));

    if (!front)     { showToast("Front content is required.", "warning"); return; }
    if (!back)      { showToast("Back content is required.", "warning"); return; }
    if (!deckId || deckId < 1) { showToast("A valid Deck ID is required.", "warning"); return; }

    // orderIndex must be >= 1 (entity uses @Positive)
    const safeOrder = Math.max(1, orderIndex);

    const payload = {
        frontContent : front,
        backContent  : back,
        orderIndex   : safeOrder,
        deckId       : deckId
    };

    const t = showToast(id ? "Updating card…" : "Creating card…", "loading", 0);
    try {
        if (id) {
            await apiCall(`/api/flashcards/${id}`, "PUT", payload);
            showToast("Flashcard updated!", "success");
        } else {
            await apiCall("/api/flashcards", "POST", payload);
            showToast("Flashcard created!", "success");
        }
        closeCardForm();
        await loadCards();
    } catch (e) {
        console.error("saveCard:", e);
        showToast(`Failed to save flashcard: ${e.message}`, "error");
    } finally {
        _dismissToast(t);
    }
}

/* ── DELETE ─────────────────────────────── */
function confirmDeleteCard(id) {
    showConfirm(
        `Delete Flashcard #${id}? This cannot be undone.`,
        () => deleteCard(id)
    );
}

async function deleteCard(id) {
    const t = showToast("Deleting card…", "loading", 0);
    try {
        await apiCall(`/api/flashcards/${id}`, "DELETE");
        showToast("Flashcard deleted.", "success");
        await loadCards();
    } catch (e) {
        showToast(`Failed to delete flashcard: ${e.message}`, "error");
    } finally {
        _dismissToast(t);
    }
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

document.addEventListener("DOMContentLoaded", loadCards);