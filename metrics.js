/**
 * LangLoop – Metrics Controller  (v2 – Fixed)
 * ────────────────────────────────────────────
 * Reads from:
 *   GET /api/sessions  → { id, userId, deckId, startTime, endTime, score }
 *   GET /api/metrics   → { id, easeFactor, intervalDays, nextReviewDate }
 *
 * NOTE: metric entity has no userId/deckId — it is a standalone spaced-repetition record.
 * All session-level stats (total, avgScore, highScore, activeUsers) come from /api/sessions.
 * Ease factor & interval stats come from /api/metrics.
 *
 * Element IDs (match metrics.html):
 *   mTotalSessions, mAvgScore, mHighScore, mActiveUsers
 *   mEaseBar, mEaseVal
 *   mRetBar, mRetVal
 *   mPerfBar, mPerfVal
 *   mIntBar, mIntVal
 *   metricsLoading, metricsEmpty, metricsTableWrapper, metricsTableBody
 */

/* ── API helper ─────────────────────────── */
const BASE_URL = "https://fullstackbackend-88h0.onrender.com";
async function apiCall(path) {
    const res  = await fetch(BASE_URL + path, {
        headers: { "Content-Type": "application/json" }
    });
    if (res.status === 204) return [];
    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    const data = text ? JSON.parse(text) : [];
    return Array.isArray(data) ? data : [];
}

/* ── HELPERS ────────────────────────────── */
function animateCount(elId, target, suffix = "") {
    const el = document.getElementById(elId);
    if (!el) return;
    const start = performance.now();
    const update = (ts) => {
        const p = Math.min((ts - start) / 700, 1);
        el.textContent = Math.round(p * target) + suffix;
        if (p < 1) requestAnimationFrame(update);
        else el.textContent = target + suffix;
    };
    requestAnimationFrame(update);
}

function setBar(barId, valId, pct, label) {
    const bar = document.getElementById(barId);
    const lbl = document.getElementById(valId);
    if (bar) {
        setTimeout(() => { bar.style.width = Math.min(100, Math.max(0, pct)) + "%"; }, 150);
    }
    if (lbl) lbl.textContent = label;
}

function fmtDt(dt) {
    if (!dt) return "—";
    if (Array.isArray(dt)) {
        const [yr, mo, dy] = dt;
        return `${yr}-${String(mo).padStart(2,"0")}-${String(dy).padStart(2,"0")}`;
    }
    return String(dt).substring(0, 10);
}

function calcDuration(start, end) {
    try {
        const s = Array.isArray(start)
            ? new Date(start[0], start[1]-1, start[2], start[3]||0, start[4]||0)
            : new Date(start);
        const e = Array.isArray(end)
            ? new Date(end[0], end[1]-1, end[2], end[3]||0, end[4]||0)
            : new Date(end);
        const mins = Math.floor((e - s) / 60000);
        if (isNaN(mins) || mins < 0) return "—";
        if (mins < 1) return "< 1 min";
        if (mins < 60) return `${mins} min`;
        return `${Math.floor(mins/60)}h ${mins%60}m`;
    } catch { return "—"; }
}

function scoreClass(s) {
    if (s >= 90) return "score-high";
    if (s >= 60) return "score-medium";
    return "score-low";
}

/* ── MAIN LOAD ──────────────────────────── */
async function loadMetrics() {
    show("metricsLoading"); hide("metricsTableWrapper"); hide("metricsEmpty");

    const loadingT = showToast("Loading metrics…", "loading", 0);
    try {
        const [sessions, metrics] = await Promise.all([
            apiCall("/api/sessions"),
            apiCall("/api/metrics")
        ]);

        _dismissToast(loadingT);
        processMetrics(sessions, metrics);
    } catch (e) {
        _dismissToast(loadingT);
        console.error("loadMetrics:", e);
        showToast(`Failed to load metrics: ${e.message}`, "error");
        hide("metricsLoading"); show("metricsEmpty");
    }
}

/* ── PROCESS & RENDER ───────────────────── */
function processMetrics(sessions, metrics) {
    hide("metricsLoading");

    /* ── Stat Cards ── */
    const total    = sessions.length;
    const scores   = sessions.map(s => Number(s.score) || 0);
    const sumScore = scores.reduce((a, b) => a + b, 0);
    const avgScore = total > 0 ? Math.round(sumScore / total) : 0;
    const maxScore = total > 0 ? Math.max(...scores) : 0;
    const activeUsers = new Set(sessions.map(s => s.userId)).size;

    animateCount("mTotalSessions", total);
    animateCount("mAvgScore",      avgScore, "%");
    animateCount("mHighScore",     maxScore);
    animateCount("mActiveUsers",   activeUsers);

    /* ── Progress Bars ── */
    // 1. Average Ease Factor (from /api/metrics)
    let avgEase = 2.5, avgInterval = 10;
    if (metrics.length > 0) {
        avgEase     = metrics.reduce((a, m) => a + (Number(m.easeFactor) || 0), 0) / metrics.length;
        avgInterval = metrics.reduce((a, m) => a + (Number(m.intervalDays) || 0), 0) / metrics.length;
    }
    // Ease: scale 1.0–3.0 → 0–100%
    const easePct = Math.round(Math.max(0, Math.min(100, ((avgEase - 1.0) / 2.0) * 100)));
    setBar("mEaseBar", "mEaseVal", easePct, `${avgEase.toFixed(2)} / 3.00  (${easePct}%)`);

    // 2. Estimated retention rate (avgScore * 0.95, capped)
    const retPct = Math.max(0, Math.min(100, Math.round(avgScore * 0.95)));
    setBar("mRetBar", "mRetVal", retPct, `${retPct}%`);

    // 3. Perfect sessions (score ≥ 90)
    const perfect    = sessions.filter(s => (Number(s.score) || 0) >= 90).length;
    const perfectPct = total > 0 ? Math.round((perfect / total) * 100) : 0;
    setBar("mPerfBar", "mPerfVal", perfectPct, `${perfectPct}%  (${perfect} / ${total})`);

    // 4. Interval optimality (avg interval / 20 days * 100%)
    const intPct = Math.max(0, Math.min(100, Math.round((avgInterval / 20) * 100)));
    setBar("mIntBar", "mIntVal", intPct, `${avgInterval.toFixed(1)} days avg  (${intPct}%)`);

    /* ── Recent Sessions Table ── */
    if (sessions.length === 0) {
        show("metricsEmpty"); return;
    }
    show("metricsTableWrapper");

    const recent = [...sessions].sort((a, b) => b.id - a.id).slice(0, 10);
    document.getElementById("metricsTableBody").innerHTML = recent.map(s => `
        <tr>
            <td>
                <span style="background:rgba(79,70,229,0.12);color:#818CF8;
                             padding:0.2rem 0.55rem;border-radius:99px;font-size:0.72rem;font-weight:600">
                    #${s.id}
                </span>
            </td>
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
            <td style="color:var(--text-secondary);font-size:0.82rem">
                <i class="fa-regular fa-clock" style="margin-right:4px"></i>
                ${calcDuration(s.startTime, s.endTime)}
            </td>
            <td style="color:var(--text-secondary);font-size:0.82rem">${fmtDt(s.startTime)}</td>
            <td><span class="${scoreClass(s.score)}" style="font-weight:700">${s.score}</span></td>
        </tr>
    `).join("");

    showToast("Metrics loaded!", "success");
}

/* ── DOM helpers ────────────────────────── */
function show(id) { const el = document.getElementById(id); if(el) el.style.display = "block"; }
function hide(id) { const el = document.getElementById(id); if(el) el.style.display = "none"; }

function _dismissToast(t) {
    if (!t || !t.parentNode) return;
    t.style.opacity = "0"; t.style.transform = "translateY(0.75rem)";
    t.style.transition = "all 0.3s ease";
    setTimeout(() => t?.remove(), 300);
}

document.addEventListener("DOMContentLoaded", loadMetrics);
