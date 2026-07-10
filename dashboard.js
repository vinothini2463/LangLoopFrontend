/**
 * LangLoop – Dashboard Controller  (v2 – Fixed)
 * ───────────────────────────────────────────────
 * Fetches all entities in parallel, populates stat cards,
 * draws HTML5 Canvas charts, and renders recent activity.
 *
 * Entity awareness:
 *   /api/users       → { id, username, role }
 *   /api/decks       → { id, title, description, capacity, mentorName, ownerId }
 *   /api/flashcards  → { id, frontContent, backContent, orderIndex, deckId }
 *   /api/sessions    → { id, userId, deckId, startTime, endTime, score }
 *   LocalDateTime fields may arrive as arrays [yr, mo, dy, hr, mn, sc] or ISO strings
 */

/* ── helpers ─────────────────────────────── */
async function apiGet(path) {
    const res = await fetch(BASE_URL + path, {
        headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    const text = await res.text();
    const data = text ? JSON.parse(text) : [];
    return Array.isArray(data) ? data : [];
}

function animateCount(el, target, duration = 800) {
    const start = performance.now();
    const tick  = (ts) => {
        const p = Math.min((ts - start) / duration, 1);
        el.textContent = Math.round(p * target).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

function dtToDate(dt) {
    if (!dt) return null;
    if (Array.isArray(dt)) {
        const [yr, mo, dy] = dt;
        return `${yr}-${String(mo).padStart(2,"0")}-${String(dy).padStart(2,"0")}`;
    }
    return String(dt).substring(0, 10);
}

/* ── STAT CARDS ──────────────────────────── */
function renderStats(users, decks, cards, sessions) {
    const grid = document.getElementById("statsGrid");
    const data = [
        { label: "Total Users",    value: users.length,    icon: "fa-users",            color: "indigo" },
        { label: "Language Decks", value: decks.length,    icon: "fa-layer-group",      color: "cyan"   },
        { label: "Flashcards",     value: cards.length,    icon: "fa-cards-blank",      color: "green"  },
        { label: "Study Sessions", value: sessions.length, icon: "fa-clock-rotate-left",color: "purple" }
    ];

    grid.innerHTML = data.map(d => `
        <div class="stat-card ${d.color}">
            <div class="stat-icon"><i class="fa-solid ${d.icon}"></i></div>
            <div class="stat-value" data-target="${d.value}">0</div>
            <div class="stat-label">${d.label}</div>
        </div>
    `).join("");

    grid.querySelectorAll(".stat-value").forEach(el => {
        animateCount(el, parseInt(el.dataset.target));
    });
}

/* ── LINE CHART (sessions by day) ────────── */
function drawLineChart(sessions) {
    const canvas = document.getElementById("lineChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width  = canvas.offsetWidth || 480;
    canvas.height = 240;

    const buckets = {};
    sessions.forEach(s => {
        const d = dtToDate(s.startTime);
        if (d) buckets[d] = (buckets[d] || 0) + 1;
    });

    let labels = Object.keys(buckets).sort().slice(-7);
    let vals   = labels.map(l => buckets[l]);

    if (labels.length === 0) {
        labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
        vals   = [2, 5, 3, 6, 4, 7, 3];
    } else {
        labels = labels.map(l => l.slice(5)); // "MM-DD"
    }

    _drawLine(ctx, canvas, labels, vals);
}

function _drawLine(ctx, canvas, labels, vals) {
    const W = canvas.width, H = canvas.height;
    const pad = { t:20, r:20, b:40, l:48 };
    const cW  = W - pad.l - pad.r;
    const cH  = H - pad.t - pad.b;
    const max = Math.max(...vals, 1);
    const isLight = document.body.classList.contains("theme-light");
    const grid  = isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.05)";
    const lbl   = isLight ? "#64748B" : "#94A3B8";

    ctx.clearRect(0, 0, W, H);

    // Grid lines + Y labels
    [0, 0.25, 0.5, 0.75, 1].forEach(p => {
        const y = pad.t + cH * (1 - p);
        ctx.strokeStyle = grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        ctx.fillStyle = lbl; ctx.font = "11px Inter,sans-serif"; ctx.textAlign = "right";
        ctx.fillText(Math.round(max * p), pad.l - 8, y + 4);
    });

    const pts = labels.map((_, i) => ({
        x: pad.l + (labels.length > 1 ? (i / (labels.length - 1)) * cW : cW / 2),
        y: pad.t + cH * (1 - vals[i] / max)
    }));

    // Fill gradient
    const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    grad.addColorStop(0, "rgba(6,182,212,0.28)");
    grad.addColorStop(1, "rgba(6,182,212,0.0)");
    ctx.beginPath();
    ctx.moveTo(pts[0].x, H - pad.b);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, H - pad.b);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = "#06B6D4"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();

    // Dots
    pts.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#06B6D4"; ctx.fill();
        ctx.strokeStyle = isLight ? "#fff" : "#070B14"; ctx.lineWidth = 2; ctx.stroke();
    });

    // X labels
    ctx.fillStyle = lbl; ctx.font = "11px Inter,sans-serif"; ctx.textAlign = "center";
    labels.forEach((l, i) => ctx.fillText(l, pts[i].x, H - pad.b + 18));
}

/* ── BAR CHART (avg score by deck) ──────── */
function drawBarChart(sessions) {
    const canvas = document.getElementById("barChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width  = canvas.offsetWidth || 480;
    canvas.height = 240;

    const map = {};
    sessions.forEach(s => {
        const k = `Dk ${s.deckId}`;
        if (!map[k]) map[k] = { sum: 0, cnt: 0 };
        map[k].sum += Number(s.score) || 0;
        map[k].cnt++;
    });

    let labels = Object.keys(map).slice(0, 6);
    let vals   = labels.map(k => Math.round(map[k].sum / map[k].cnt));

    if (labels.length === 0) {
        labels = ["Dk 1","Dk 2","Dk 3","Dk 4","Dk 5"];
        vals   = [75, 88, 64, 92, 80];
    }

    _drawBar(ctx, canvas, labels, vals);
}

function _drawBar(ctx, canvas, labels, vals) {
    const W = canvas.width, H = canvas.height;
    const pad = { t:20, r:20, b:40, l:48 };
    const cW  = W - pad.l - pad.r;
    const cH  = H - pad.t - pad.b;
    const max = Math.max(...vals, 100);
    const bW  = (cW / labels.length) * 0.55;
    const isLight = document.body.classList.contains("theme-light");
    const grid = isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.05)";
    const lbl  = isLight ? "#64748B" : "#94A3B8";
    const clrs = ["#4F46E5","#7C3AED","#06B6D4","#10B981","#F59E0B","#EF4444"];

    ctx.clearRect(0, 0, W, H);

    [0, 0.25, 0.5, 0.75, 1].forEach(p => {
        const y = pad.t + cH * (1 - p);
        ctx.strokeStyle = grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        ctx.fillStyle = lbl; ctx.font = "11px Inter,sans-serif"; ctx.textAlign = "right";
        ctx.fillText(Math.round(max * p), pad.l - 8, y + 4);
    });

    labels.forEach((l, i) => {
        const slot = cW / labels.length;
        const x    = pad.l + i * slot + (slot - bW) / 2;
        const bH   = (vals[i] / max) * cH;
        const y    = pad.t + cH - bH;

        const g = ctx.createLinearGradient(0, y, 0, y + bH);
        g.addColorStop(0, clrs[i % clrs.length]);
        g.addColorStop(1, clrs[i % clrs.length] + "44");

        ctx.beginPath();
        ctx.roundRect(x, y, bW, bH, [5, 5, 0, 0]);
        ctx.fillStyle = g; ctx.fill();

        ctx.fillStyle = lbl; ctx.font = "bold 11px Inter,sans-serif"; ctx.textAlign = "center";
        ctx.fillText(vals[i], x + bW/2, y - 6);
        ctx.font = "11px Inter,sans-serif";
        ctx.fillText(l, x + bW/2, H - pad.b + 18);
    });
}

/* ── ACTIVITY LIST ───────────────────────── */
function renderActivity(sessions) {
    const list = document.getElementById("activityList");
    if (!list) return;

    const recent = [...sessions].sort((a,b) => b.id - a.id).slice(0, 6);
    if (recent.length === 0) {
        list.innerHTML = `
            <div class="empty-state-card">
                <div class="empty-state-symbol">⏱</div>
                <p class="empty-state-msg-title">No Activity Yet</p>
                <p class="empty-state-msg-desc">Create study sessions to see activity here.</p>
            </div>`;
        return;
    }

    const dotColors = [
        ["rgba(79,70,229,0.15)","#818CF8"],
        ["rgba(6,182,212,0.15)","#06B6D4"],
        ["rgba(16,185,129,0.15)","#34D399"],
        ["rgba(245,158,11,0.15)","#FCD34D"]
    ];

    list.innerHTML = recent.map((s, i) => {
        const [bg, fg] = dotColors[i % 4];
        return `
            <div class="activity-item">
                <div class="activity-dot" style="background:${bg};color:${fg}">
                    <i class="fa-solid fa-clock"></i>
                </div>
                <div class="activity-info">
                    <div class="activity-title">
                        Session #${s.id} — User ${s.userId}, Deck ${s.deckId}
                    </div>
                    <div class="activity-time">
                        Score: ${s.score} &nbsp;•&nbsp; ${dtToDate(s.startTime) || "—"}
                    </div>
                </div>
                <span style="font-size:1.1rem;font-weight:700;color:var(--accent)">${s.score}</span>
            </div>`;
    }).join("");
}

/* ── GREETING ────────────────────────────── */
function setGreeting() {
    const el = document.querySelector(".page-intro h1");
    if (!el) return;
    const hr = new Date().getHours();
    const greet = hr < 12 ? "Good Morning" : hr < 17 ? "Good Afternoon" : "Good Evening";
    el.textContent = `${greet} 👋`;
}

/* ── MAIN BOOTSTRAP ──────────────────────── */
async function loadDashboard() {
    const t = showToast("Loading dashboard…", "loading", 0);
    try {
        const [users, decks, cards, sessions] = await Promise.all([
            apiGet("/api/users").catch(() => []),
            apiGet("/api/decks").catch(() => []),
            apiGet("/api/flashcards").catch(() => []),
            apiGet("/api/sessions").catch(() => [])
        ]);

        _dismissToast(t);
        setGreeting();
        renderStats(users, decks, cards, sessions);
        renderActivity(sessions);

        // Wait for layout to settle before measuring canvas width
        setTimeout(() => {
            drawLineChart(sessions);
            drawBarChart(sessions);
        }, 180);

        showToast("Dashboard loaded!", "success");
    } catch (e) {
        _dismissToast(t);
        console.error("loadDashboard:", e);
        showToast("Dashboard error — check server connection.", "error");
    }
}

// Redraw on resize
let _resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
        apiGet("/api/sessions").then(s => { drawLineChart(s); drawBarChart(s); }).catch(() => {});
    }, 200);
});

function _dismissToast(t) {
    if (!t || !t.parentNode) return;
    t.style.opacity = "0"; t.style.transform = "translateY(0.75rem)";
    t.style.transition = "all 0.3s ease";
    setTimeout(() => t?.remove(), 300);
}

document.addEventListener("DOMContentLoaded", loadDashboard);
