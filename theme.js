/**
 * LangLoop – Global Theme & Layout Controller (v2 - Fixed)
 * ─────────────────────────────────────────────────────────
 * • All API calls use:  const BASE_URL = "http://localhost:8080"
 * • No WebSocket code
 * • CORS-safe (works when served from Live Server on :5500)
 */

const BASE_URL = "https://fullstackbackend-88h0.onrender.com";

/* ═══════════════════════════════════════════
   1.  SIDEBAR COLLAPSE
═══════════════════════════════════════════ */
function initSidebar() {
    const app       = document.querySelector(".app-container");
    const toggleBtn = document.getElementById("sidebarToggle");
    if (!app || !toggleBtn) return;

    if (localStorage.getItem("sidebarCollapsed") === "true") {
        app.classList.add("sidebar-collapsed");
    }

    toggleBtn.addEventListener("click", () => {
        app.classList.toggle("sidebar-collapsed");
        localStorage.setItem("sidebarCollapsed", app.classList.contains("sidebar-collapsed"));
    });

    // Mobile overlay close
    document.addEventListener("click", (e) => {
        if (window.innerWidth <= 992) {
            if (!e.target.closest(".sidebar") && !e.target.closest("#mobileSidebarBtn")) {
                app.classList.remove("sidebar-open");
            }
        }
    });

    const mobileBtn = document.getElementById("mobileSidebarBtn");
    if (mobileBtn) {
        mobileBtn.addEventListener("click", () => app.classList.toggle("sidebar-open"));
    }
}

/* ═══════════════════════════════════════════
   2.  LIVE CLOCK
═══════════════════════════════════════════ */
function initClock() {
    const clockEl = document.getElementById("navClock");
    const dateEl  = document.getElementById("navDate");
    if (!clockEl) return;

    const tick = () => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
        if (dateEl) dateEl.textContent = now.toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric"
        });
    };
    tick();
    setInterval(tick, 1000);
}

/* ═══════════════════════════════════════════
   3.  ACTIVE NAV LINK
═══════════════════════════════════════════ */
function initActiveNav() {
    const page = window.location.pathname.split("/").pop();
    document.querySelectorAll(".sidebar-menu a").forEach(link => {
        const href = (link.getAttribute("href") || "").split("/").pop();
        if (href === page) link.classList.add("active");
    });
}

/* ═══════════════════════════════════════════
   4.  DARK / LIGHT THEME TOGGLE
═══════════════════════════════════════════ */
function initTheme() {
    const btn = document.getElementById("themeToggleBtn");
    if (!btn) return;

    const saved = localStorage.getItem("langloopTheme") || "dark";
    if (saved === "light") {
        document.body.classList.add("theme-light");
        btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }

    btn.addEventListener("click", () => {
        const isLight = document.body.classList.toggle("theme-light");
        localStorage.setItem("langloopTheme", isLight ? "light" : "dark");
        btn.innerHTML = isLight
            ? '<i class="fa-solid fa-sun"></i>'
            : '<i class="fa-solid fa-moon"></i>';
    });
}

/* ═══════════════════════════════════════════
   5.  PROFILE DROPDOWN
═══════════════════════════════════════════ */
function initProfileDropdown() {
    const avatar   = document.getElementById("profileAvatar");
    const dropdown = document.getElementById("profileDropdown");
    if (!avatar || !dropdown) return;

    avatar.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("show");
    });

    document.addEventListener("click", () => dropdown.classList.remove("show"));
}

/* ═══════════════════════════════════════════
   6.  GLOBAL TOAST SYSTEM
   Usage:  showToast("message", "success|error|warning|info|loading", durationMs)
           Returns toast element so caller can dismiss it early.
═══════════════════════════════════════════ */
function initToasts() {
    if (document.getElementById("toastsContainer")) return;
    const c = document.createElement("div");
    c.id = "toastsContainer";
    c.className = "toasts-container";
    document.body.appendChild(c);
}

window.showToast = function (message, type = "info", duration = 4000) {
    const container = document.getElementById("toastsContainer");
    if (!container) return null;

    const icons = {
        success : "fa-solid fa-circle-check",
        error   : "fa-solid fa-triangle-exclamation",
        warning : "fa-solid fa-circle-exclamation",
        info    : "fa-solid fa-circle-info",
        loading : "fa-solid fa-spinner fa-spin"
    };

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="${icons[type] || icons.info}"></i>
        <span class="toast-text">${message}</span>
        <button class="toast-close" title="Dismiss">&times;</button>
    `;

    toast.querySelector(".toast-close").addEventListener("click", () => _dismissToast(toast));
    container.appendChild(toast);

    if (duration > 0) setTimeout(() => _dismissToast(toast), duration);
    return toast;
};

function _dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.opacity   = "0";
    toast.style.transform = "translateY(0.75rem)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast?.remove(), 300);
}

/* ═══════════════════════════════════════════
   7.  CUSTOM CONFIRM MODAL
   Usage:  showConfirm("Are you sure?", () => doDelete())
           Optional 3rd arg for custom title.
═══════════════════════════════════════════ */
function initConfirmModal() {
    if (document.getElementById("globalConfirmModal")) return;

    const modal = document.createElement("div");
    modal.id = "globalConfirmModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
        <div class="confirm-modal-box">
            <div class="modal-warning-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h3 class="modal-title" id="confirmModalTitle">Confirm Delete</h3>
            <p class="modal-message" id="confirmModalMsg">Are you sure you want to proceed?</p>
            <div class="modal-btn-row">
                <button id="confirmModalCancel" class="btn btn-secondary"
                    style="padding:0.7rem 1.2rem;border-radius:8px;border:1px solid var(--border-color);
                           background:var(--bg-input);color:var(--text-primary);font-family:var(--font-family);
                           cursor:pointer;font-weight:600;transition:var(--transition);">
                    Cancel
                </button>
                <button id="confirmModalOk" class="btn btn-danger"
                    style="padding:0.7rem 1.2rem;border-radius:8px;border:none;
                           background:linear-gradient(135deg,#EF4444,#DC2626);color:#fff;
                           font-family:var(--font-family);cursor:pointer;font-weight:600;transition:var(--transition);">
                    Delete
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("confirmModalCancel").addEventListener("click", () => {
        modal.classList.remove("show");
    });
    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("show");
    });
}

window.showConfirm = function (message, onConfirm, title = "Delete Confirmation") {
    const modal   = document.getElementById("globalConfirmModal");
    if (!modal) return;

    document.getElementById("confirmModalTitle").textContent = title;
    document.getElementById("confirmModalMsg").textContent   = message;
    modal.classList.add("show");

    // Clone to remove previous listener
    const okBtn = document.getElementById("confirmModalOk");
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);

    newOk.addEventListener("click", () => {
        modal.classList.remove("show");
        if (typeof onConfirm === "function") onConfirm();
    });
};

/* ═══════════════════════════════════════════
   8.  LOGOUT
═══════════════════════════════════════════ */
window.logout = function () {
    localStorage.removeItem("token");
    window.location.href = "login.html";
};

/* ═══════════════════════════════════════════
   9.  BOOTSTRAP
═══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
    initSidebar();
    initClock();
    initActiveNav();
    initTheme();
    initProfileDropdown();
    initToasts();
    initConfirmModal();
});
