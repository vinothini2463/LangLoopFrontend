/**
 * LangLoop – Users Controller  (v2 – Fixed)
 * ─────────────────────────────────────────
 * Entity fields: { id, username, password, role }
 * Roles:  ADMIN | LEARNER | LINGUIST
 * API:    GET/POST/PUT/DELETE  /api/users / /api/users/{id}
 * Auth:   All routes are permitAll in Spring Security
 * Note:   User.id uses @GeneratedValue – never send id on POST
 *         Password is BCrypt-encoded by the backend on POST
 *         On PUT, backend re-encodes if password field is sent
 */

const PAGE_SIZE = 6;

let allUsers    = [];
let filteredU   = [];
let currentPage = 1;

/* ── api helper ─────────────────────────── */
async function apiCall(path, method = "GET", body = null) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" }
    };
    if (body !== null) opts.body = JSON.stringify(body);

    const res = await fetch(BASE_URL + path, opts);

    // Handle 204 No Content
    if (res.status === 204) return null;

    const text = await res.text();
    if (!res.ok) {
        throw new Error(text || `HTTP ${res.status}`);
    }
    return text ? JSON.parse(text) : null;
}

/* ── LOAD ───────────────────────────────── */
async function loadUsers() {
    show("loadingState"); hide("tableWrapper"); hide("emptyState");
    try {
        allUsers = await apiCall("/api/users");
        if (!Array.isArray(allUsers)) allUsers = [];
        filterUsers();
        showToast("Users loaded!", "success");
    } catch (e) {
        console.error("loadUsers:", e);
        showToast("Failed to load users — is the server running on port 8080?", "error");
        hide("loadingState"); show("emptyState");
    }
}

/* ── FILTER / SEARCH / SORT ─────────────── */
function filterUsers() {
    const q    = (val("globalSearch")).toLowerCase();
    const role = val("roleFilter");
    const sort = val("sortBy") || "id";

    filteredU = allUsers.filter(u => {
        const matchQ    = !q || String(u.id).includes(q) || (u.username || "").toLowerCase().includes(q);
        const matchRole = !role || u.role === role;
        return matchQ && matchRole;
    });

    filteredU.sort((a, b) => {
        if (sort === "username") return (a.username || "").localeCompare(b.username || "");
        if (sort === "role")     return (a.role || "").localeCompare(b.role || "");
        return (a.id || 0) - (b.id || 0);
    });

    currentPage = 1;
    renderPage();
}

/* ── RENDER TABLE ───────────────────────── */
function renderPage() {
    hide("loadingState");

    if (filteredU.length === 0) {
        hide("tableWrapper"); show("emptyState"); return;
    }
    hide("emptyState"); show("tableWrapper");

    const start = (currentPage - 1) * PAGE_SIZE;
    const paged = filteredU.slice(start, start + PAGE_SIZE);

    const roleClass = { ADMIN: "role-admin", LEARNER: "role-learner", LINGUIST: "role-linguist" };

    document.getElementById("usersTableBody").innerHTML = paged.map(u => `
        <tr>
            <td><span style="color:var(--text-muted)">#${u.id}</span></td>
            <td>
                <div style="display:flex;align-items:center;gap:0.6rem">
                    <div style="width:30px;height:30px;border-radius:50%;
                                background:linear-gradient(135deg,var(--primary),var(--secondary));
                                display:flex;align-items:center;justify-content:center;
                                color:#fff;font-weight:700;font-size:0.75rem;flex-shrink:0">
                        ${(u.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <span style="font-weight:500;color:var(--text-primary)">${u.username || "—"}</span>
                </div>
            </td>
            <td><span class="role-badge ${roleClass[u.role] || ''}">${u.role || "—"}</span></td>
            <td>
                <div style="display:flex;gap:0.4rem">
                    <button class="tbl-btn tbl-btn-edit" title="Edit"
                        onclick="editUser(${u.id}, '${escStr(u.username)}', '${u.role}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="tbl-btn tbl-btn-delete" title="Delete"
                        onclick="confirmDeleteUser(${u.id}, '${escStr(u.username)}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    renderPagination();
}

/* ── PAGINATION ─────────────────────────── */
function renderPagination() {
    const total = Math.ceil(filteredU.length / PAGE_SIZE);
    const row   = document.getElementById("paginationRow");
    const shown1 = Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredU.length);
    const shown2 = Math.min(currentPage * PAGE_SIZE, filteredU.length);

    row.innerHTML = `
        <span>Showing ${shown1}–${shown2} of ${filteredU.length}</span>
        <div class="page-btns">
            <button class="page-btn" onclick="goPage(${currentPage - 1})"
                ${currentPage === 1 ? "disabled" : ""}>
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            ${Array.from({length: total}, (_, i) =>
                `<button class="page-btn ${i+1===currentPage?"active":""}" onclick="goPage(${i+1})">${i+1}</button>`
            ).join("")}
            <button class="page-btn" onclick="goPage(${currentPage + 1})"
                ${currentPage === total ? "disabled" : ""}>
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>`;
}

function goPage(p) {
    const total = Math.ceil(filteredU.length / PAGE_SIZE);
    if (p < 1 || p > total) return;
    currentPage = p;
    renderPage();
}

/* ── SAVE (create OR update) ────────────── */
async function saveUser() {
    const id       = val("userId");
    const username = val("username").trim();
    const password = val("password");
    const role     = val("role");

    if (!username) { showToast("Username is required.", "warning"); return; }
    if (!role)     { showToast("Role is required.", "warning"); return; }
    if (!id && !password) { showToast("Password is required for new users.", "warning"); return; }

    // Build payload — only include password if provided
    const payload = { username, role };
    if (password) payload.password = password;

    const t = showToast(id ? "Updating user…" : "Creating user…", "loading", 0);
    try {
        if (id) {
            // PUT /api/users/{id}
            await apiCall(`/api/users/${id}`, "PUT", payload);
            showToast(`User "${username}" updated!`, "success");
        } else {
            // POST /api/users  — id auto-generated by backend
            await apiCall("/api/users", "POST", payload);
            showToast(`User "${username}" created!`, "success");
        }
        clearForm();
        await loadUsers();
    } catch (e) {
        console.error("saveUser:", e);
        showToast(`Failed to save user: ${e.message}`, "error");
    } finally {
        _dismissToast(t);
    }
}

/* ── EDIT ───────────────────────────────── */
function editUser(id, username, role) {
    setVal("userId",   id);
    setVal("username", username);
    setVal("password", "");      // don't pre-fill password
    setVal("role",     role);
    document.getElementById("formTitle").textContent = "Edit User";
    document.querySelector(".form-panel")?.scrollIntoView({ behavior: "smooth" });
    showToast(`Editing User #${id}`, "info", 2500);
}

/* ── DELETE ─────────────────────────────── */
function confirmDeleteUser(id, username) {
    showConfirm(
        `Delete user "${username}" (ID #${id})? This cannot be undone.`,
        () => deleteUser(id, username)
    );
}

async function deleteUser(id, username) {
    const t = showToast("Deleting user…", "loading", 0);
    try {
        await apiCall(`/api/users/${id}`, "DELETE");
        showToast(`User "${username}" deleted.`, "success");
        if (val("userId") == id) clearForm();
        await loadUsers();
    } catch (e) {
        showToast(`Failed to delete User #${id}: ${e.message}`, "error");
    } finally {
        _dismissToast(t);
    }
}

/* ── CLEAR ──────────────────────────────── */
function clearForm() {
    ["userId","username","password","role"].forEach(id => setVal(id, ""));
    document.getElementById("formTitle").textContent = "Add User";
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

document.addEventListener("DOMContentLoaded", loadUsers);