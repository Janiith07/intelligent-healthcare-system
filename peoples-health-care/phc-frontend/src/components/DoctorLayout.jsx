import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, Outlet, Link } from "react-router-dom";
import api from "../services/api";


const getLocalDateStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

// Map URL path → display name (used to auto-detect active page)
const PATH_TO_PAGE = {
  "/doctor/dashboard":         "Dashboard",
  "/doctor/appointments":      "My Schedule",
  "/doctor/prescriptions":     "Prescriptions",
  "/doctor/lab-requests":      "Lab Requests",
  "/doctor/lab-results":       "Lab Results",
  "/doctor/patients":          "Patient Records",
  "/doctor/analysis":          "Medical Analysis",
  "/doctor/medicine-analysis": "Medicine Analysis",
  "/doctor/settings":          "Settings",
  "/doctor/heart-predict":     "Heart Predictor",
  "/doctor/rag-assistant":      "Clinical Assistant",
  "/doctor/vitamin-predict":    "Vitamin Predictor",
};

// ─────────────────────────────────────────────────────────────────────────────
// LIQUID GLASS TOAST
// ─────────────────────────────────────────────────────────────────────────────

const TOAST_CFG = {
  critical:    { accent:"#ef4444", label:"Critical Alert",        badge:"URGENT",    badgeBg:"#ef4444" },
  lab:         { accent:"#8b5cf6", label:"Lab Result Ready",      badge:"NEW",       badgeBg:"#8b5cf6" },
  appointment: { accent:"#3b82f6", label:"New Appointment",       badge:"IMPORTANT", badgeBg:"#f97316" },
  prescription:{ accent:"#14b8a6", label:"Prescription Dispensed",badge:null,        badgeBg:null      },
  info:        { accent:"#64748b", label:"Notice",                badge:null,        badgeBg:null      },
};

// Inject progress-shrink keyframe once
if (typeof document !== "undefined" && !document.getElementById("__toast_kf")) {
  const s = document.createElement("style");
  s.id = "__toast_kf";
  s.textContent = `
    @keyframes toast-shrink { from { transform:scaleX(1); } to { transform:scaleX(0); } }
    .toast-progress { animation: toast-shrink linear forwards; transform-origin: left; }
  `;
  document.head.appendChild(s);
}

function LiquidToast({ toast, onDismiss }) {
  const cfg = TOAST_CFG[toast.type] ?? TOAST_CFG.info;
  const [out, setOut] = useState(false);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVis(true));
    const t = setTimeout(() => { setOut(true); setTimeout(() => onDismiss(toast.id), 420); }, toast.duration ?? 5200);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, []);

  const dismiss = () => { setOut(true); setTimeout(() => onDismiss(toast.id), 420); };

  return (
    <div style={{
      transform: vis && !out ? "translateX(0) scale(1)" : "translateX(115%) scale(0.9)",
      opacity:   vis && !out ? 1 : 0,
      transition:"transform 0.44s cubic-bezier(0.34,1.56,0.64,1), opacity 0.36s ease",
      background:"linear-gradient(135deg, rgba(186,225,255,0.60) 0%, rgba(147,197,253,0.45) 60%, rgba(186,225,255,0.35) 100%)",
      backdropFilter:"blur(28px) saturate(190%)",
      WebkitBackdropFilter:"blur(28px) saturate(190%)",
      border:"1.5px solid rgba(147,197,253,0.65)",
      boxShadow:"0 10px 40px rgba(59,130,246,0.18), 0 2px 10px rgba(0,0,0,0.09), inset 0 1px 0 rgba(255,255,255,0.65)",
      cursor:"pointer",
      width:"340px",
    }} className="rounded-[18px] px-4 pt-3.5 pb-4 relative overflow-hidden" onClick={dismiss}>

      {/* Glass shimmer overlay */}
      <div style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.38) 0%,rgba(255,255,255,0) 60%)", pointerEvents:"none" }}
        className="absolute inset-0 rounded-[18px]" />

      {/* ── Row 1: Icon · Type label · Badge · Close ── */}
      <div className="flex items-center gap-2 mb-2 relative">

        {/* Circular icon — matches patient's circular icon style */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative"
          style={{ background:`${cfg.accent}28`, border:`1.5px solid ${cfg.accent}55` }}>
          <span style={{ color: cfg.accent }} className="scale-90">
            {NOTIF_ICONS[toast.type] ?? NOTIF_ICONS.info}
          </span>
          {toast.type === "critical" && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white/80 animate-ping"
              style={{ background: cfg.accent }} />
          )}
        </div>

        {/* Type label */}
        <span className="text-[10px] font-black uppercase tracking-[0.11em] flex-1"
          style={{ color: cfg.accent }}>
          {cfg.label}
        </span>

        {/* Priority badge — orange "IMPORTANT" or red "URGENT" */}
        {cfg.badge && (
          <span className="text-[9px] font-black uppercase tracking-wide px-2 py-[3px] rounded-full text-white"
            style={{ background: cfg.badgeBg,
              boxShadow:`0 2px 6px ${cfg.badgeBg}55` }}>
            {cfg.badge}
          </span>
        )}

        {/* Close × */}
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          className="ml-0.5 flex-shrink-0 opacity-40 hover:opacity-70 transition-opacity text-gray-700">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
          </svg>
        </button>
      </div>

      {/* ── Row 2: Bold title ── */}
      <div className="text-[13.5px] font-bold leading-snug text-gray-800 relative mb-1.5 pr-1">
        {toast.title}
      </div>

      {/* ── Row 3: Body / subtitle — full text, not truncated ── */}
      {toast.subtitle && (
        <div className="text-[12px] text-gray-500/90 leading-relaxed relative">
          {toast.subtitle}
        </div>
      )}

      {/* ── Progress bar ── */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-[18px] overflow-hidden">
        <div className="h-full toast-progress"
          style={{ background:`linear-gradient(90deg, ${cfg.accent}, ${cfg.accent}bb)`,
            animationDuration:`${toast.duration ?? 5200}ms`,
            transformOrigin:"left" }} />
      </div>
    </div>
  );
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="fixed top-[72px] right-4 z-[300] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <LiquidToast toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return "Just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function hasCriticalFlag(result) {
  // results is { parameters: [{name, value, flag}, ...], checkboxFindings: [...] }
  return (result?.results?.parameters ?? []).some(p =>
    ["High", "Low", "Positive", "Reactive"].includes(p?.flag)
  );
}

function getCriticalSummary(result) {
  return (result?.results?.parameters ?? [])
    .filter(p => ["High", "Low", "Positive", "Reactive"].includes(p?.flag))
    .map(p => `${p.name}: ${p.flag}`)
    .slice(0, 2).join(" · ");
}

// SVG icons for each notification type
const NOTIF_ICONS = {
  critical: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  lab: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M6 2v6l-4 8a2 2 0 001.8 3h12.4A2 2 0 0018 16l-4-8V2"/>
      <line x1="6" y1="2" x2="18" y2="2"/>
      <circle cx="14" cy="14" r="1" fill="currentColor"/>
      <circle cx="10" cy="16" r="1" fill="currentColor"/>
    </svg>
  ),
  appointment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01"/>
    </svg>
  ),
  prescription: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="18" x2="12" y2="12"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
};

// ── Notification time-window logic ────────────────────────────────────────────
// Critical results  → max 1 day ago (yesterday midnight onwards)
// Today's items     → always show
// Yesterday's items → only if still unread (doctor may have missed them overnight)
// Older             → drop off
function isNotifRelevant(isoTime, type, id, unreadIds) {
  if (!isoTime) return false;
  const t          = new Date(isoTime);
  const now        = new Date();

  // Midnight boundaries in local time
  const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart - 86_400_000);

  if (type === "critical") return t >= yesterdayStart;      // max 1 day ago
  if (t >= todayStart)     return true;                     // today: always
  if (t >= yesterdayStart) return unreadIds.has(id);        // yesterday: unread only
  return false;                                             // older: drop off
}

function buildNotifications(labResults = [], appointments = [], prescriptions = [], unreadIds = new Set()) {
  const list = [];

  // ── Critical lab results — 48 h window (patient safety)
  labResults
    .filter(r => {
      const id = `crit-${r._id}`;
      return hasCriticalFlag(r) && isNotifRelevant(r.updatedAt || r.createdAt, "critical", id, unreadIds);
    })
    .forEach(r => {
      list.push({
        id: `crit-${r._id}`, type: "critical",
        title: `Critical Result — ${r.patientName || "Patient"}`,
        subtitle: getCriticalSummary(r),
        idLabel: r.labRequestRef || null,
        link: r.labRequestRef ? `/doctor/lab-results?open=${r._id}` : `/doctor/lab-results`,
        time: r.updatedAt || r.createdAt, raw: r,
      });
    });

  // ── Normal completed lab results — today + yesterday if unread
  labResults
    .filter(r => {
      const id = `lab-${r._id}`;
      return !hasCriticalFlag(r) && r.status === "completed" &&
        isNotifRelevant(r.updatedAt || r.createdAt, "lab", id, unreadIds);
    })
    .forEach(r => {
      list.push({
        id: `lab-${r._id}`, type: "lab",
        title: `Lab Results Ready — ${r.patientName || "Patient"}`,
        subtitle: r.testName,
        idLabel: r.labRequestRef || null,
        link: `/doctor/lab-results?open=${r._id}`,
        time: r.updatedAt || r.createdAt, raw: r,
      });
    });

  // ── Today's pending appointments (API already scopes to today)
  appointments
    .filter(a => a.status === "Pending")
    .slice(0, 10)
    .forEach(a => {
      list.push({
        id: `apt-${a._id}`, type: "appointment",
        title: `New Appointment — ${a.patientName || "Patient"}`,
        subtitle: `${a.session || ""} Session${a.estimatedTime ? " · " + a.estimatedTime : ""}`,
        idLabel: a.appointmentId || null,
        link: `/doctor/appointments`,
        time: a.createdAt, raw: a,
      });
    });

  // ── Dispensed prescriptions — today + yesterday if unread
  prescriptions
    .filter(p => {
      const id  = `rx-${p._id}`;
      const iso = p.dispensedAt || p.updatedAt || p.createdAt;
      return p.pharmacyStatus === "dispensed" && isNotifRelevant(iso, "prescription", id, unreadIds);
    })
    .slice(0, 10)
    .forEach(p => {
      list.push({
        id: `rx-${p._id}`, type: "prescription",
        title: `Prescription Dispensed — ${p.patientName || "Patient"}`,
        subtitle: null,
        idLabel: p.prescriptionId,
        link: `/doctor/prescriptions?open=${p.prescriptionId}`,
        time: p.dispensedAt || p.updatedAt || p.createdAt, raw: p,
      });
    });

  // Sort: critical first → then newest
  return list.sort((a, b) => {
    if (a.type === "critical" && b.type !== "critical") return -1;
    if (b.type === "critical" && a.type !== "critical") return 1;
    return new Date(b.time) - new Date(a.time);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION PANEL DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

const NSTYLE = {
  critical:    { bg:"bg-red-50",    iconBg:"bg-red-100",    dot:"bg-red-500",    text:"text-red-800",   idColor:"text-red-600 bg-red-100 border-red-200"      },
  lab:         { bg:"",            iconBg:"bg-purple-100", dot:"bg-purple-500", text:"text-gray-800",  idColor:"text-purple-700 bg-purple-50 border-purple-200" },
  appointment: { bg:"",            iconBg:"bg-blue-100",   dot:"bg-blue-500",   text:"text-gray-800",  idColor:"text-blue-700 bg-blue-50 border-blue-200"       },
  prescription:{ bg:"",            iconBg:"bg-teal-100",   dot:"bg-teal-500",   text:"text-gray-800",  idColor:"text-teal-700 bg-teal-50 border-teal-200"       },
  info:        { bg:"",            iconBg:"bg-gray-100",   dot:"bg-gray-400",   text:"text-gray-800",  idColor:"text-gray-600 bg-gray-50 border-gray-200"       },
};

function NotifRow({ n, isUnread }) {
  const s = NSTYLE[n.type] ?? NSTYLE.info;
  const isCrit = n.type === "critical";
  const cfg = TOAST_CFG[n.type] ?? TOAST_CFG.info;

  return (
    <div className="px-3 py-2.5 border-b border-white/40 last:border-0">
      <div className="rounded-[14px] px-3.5 py-3 relative overflow-hidden transition-all duration-200"
        style={{
          background: isCrit
            ? "linear-gradient(135deg,rgba(254,202,202,0.55),rgba(252,165,165,0.35))"
            : "linear-gradient(135deg,rgba(186,225,255,0.48),rgba(147,197,253,0.30))",
          border: isCrit
            ? "1px solid rgba(252,165,165,0.6)"
            : "1px solid rgba(147,197,253,0.5)",
          backdropFilter:"blur(12px)",
          WebkitBackdropFilter:"blur(12px)",
          boxShadow: isUnread
            ? `0 2px 12px ${cfg.accent}22, inset 0 1px 0 rgba(255,255,255,0.55)`
            : "inset 0 1px 0 rgba(255,255,255,0.45)",
        }}>

        {/* Glass shimmer */}
        <div style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.32),rgba(255,255,255,0))", pointerEvents:"none" }}
          className="absolute inset-0 rounded-[14px]" />

        {/* Row 1: icon · label · badge · time · unread dot */}
        <div className="flex items-center gap-2 mb-1.5 relative">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background:`${cfg.accent}28`, border:`1.5px solid ${cfg.accent}50` }}>
            <span style={{ color: cfg.accent }} className="scale-75">
              {NOTIF_ICONS[n.type] ?? NOTIF_ICONS.info}
            </span>
          </div>

          <span className="text-[9.5px] font-black uppercase tracking-[0.1em] flex-1" style={{ color: cfg.accent }}>
            {cfg.label}
          </span>

          {/* URGENT/IMPORTANT badge */}
          {cfg.badge && (isCrit || n.type === "appointment") && (
            <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full text-white"
              style={{ background: cfg.badgeBg }}>
              {cfg.badge}
            </span>
          )}

          <span className="text-[10px] text-gray-400/80 whitespace-nowrap flex-shrink-0 font-medium">
            {timeAgo(n.time)}
          </span>

          {isUnread && (
            <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: cfg.accent }} />
          )}
        </div>

        {/* Row 2: Title */}
        <div className="text-[12.5px] font-bold leading-snug text-gray-800 relative mb-1 pr-1">
          {n.title}
        </div>

        {/* Row 3: Subtitle */}
        {n.subtitle && (
          <div className={`text-[11px] leading-relaxed relative ${isCrit ? "text-red-600 font-medium" : "text-gray-500/90"}`}>
            {n.subtitle}
          </div>
        )}

        {/* ID pill link */}
        {n.idLabel && n.link && (
          <a href={n.link} onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-lg border text-[10.5px] font-bold font-mono hover:opacity-75 transition"
            style={{ color: cfg.accent, borderColor:`${cfg.accent}40`, background:`${cfg.accent}12` }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5">
              <path d="M2 8h12M8 2l6 6-6 6"/>
            </svg>
            {n.idLabel}
          </a>
        )}
      </div>
    </div>
  );
}

function NotificationPanel({ notifs, loading, unreadCount, unreadIds, onMarkAllRead }) {
  const criticals = notifs.filter(n => n.type === "critical");
  const others    = notifs.filter(n => n.type !== "critical");

  return (
    <div className="absolute right-0 top-12 w-[400px] rounded-2xl border z-50 overflow-hidden"
      style={{
        background:"linear-gradient(160deg,rgba(219,234,254,0.92) 0%,rgba(239,246,255,0.95) 100%)",
        backdropFilter:"blur(20px) saturate(160%)",
        WebkitBackdropFilter:"blur(20px) saturate(160%)",
        border:"1.5px solid rgba(147,197,253,0.55)",
        boxShadow:"0 24px 60px rgba(59,130,246,0.15), 0 4px 16px rgba(0,0,0,0.08)",
      }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between"
        style={{ background:"linear-gradient(135deg,#0D2137,#1565C0)" }}>
        <div>
          <div className="text-white font-semibold text-sm">Today's Notifications</div>
          <div className="text-white/50 text-xs mt-0.5">
            {loading ? "Refreshing…" : `${notifs.length} today · ${unreadCount} unread`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead}
              className="text-[11px] text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition font-medium">
              Mark all read
            </button>
          )}
          {loading && (
            <svg className="w-4 h-4 animate-spin text-white/60" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {/* Criticals */}
        {criticals.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-100">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-600">⚡ Critical Alerts</span>
            </div>
            {criticals.map(n => <NotifRow key={n.id} n={n} isUnread={unreadIds.has(n.id)} />)}
          </div>
        )}

        {/* Others */}
        {others.length > 0 && (
          <div>
            {criticals.length > 0 && (
              <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Activity</span>
              </div>
            )}
            {others.map(n => <NotifRow key={n.id} n={n} isUnread={unreadIds.has(n.id)} />)}
          </div>
        )}

        {/* Empty */}
        {notifs.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-gray-400">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </div>
            <div className="text-sm font-semibold text-gray-600">All clear</div>
            <div className="text-xs text-gray-400 mt-1">No new notifications right now</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT MODAL
// ─────────────────────────────────────────────────────────────────────────────
function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-80 mx-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-red-500">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </div>
        <h3 className="text-center text-gray-800 font-bold text-lg mb-1">Sign Out</h3>
        <p className="text-center text-gray-500 text-sm mb-6">Are you sure you want to log out?</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FONT + NAV
// ─────────────────────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

const NAV_ITEMS = [
  { label:"Dashboard",        href:"/doctor/dashboard",         icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>) },
  { label:"My Schedule",      href:"/doctor/appointments",      icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>) },
  { label:"Prescriptions",    href:"/doctor/prescriptions",     icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>) },
  { label:"Lab Requests",     href:"/doctor/lab-requests",      icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10m-10 0v4a2 2 0 002 2h4m4-10v10a2 2 0 01-2 2h-4m0 0H9"/></svg>) },
  { label:"Lab Results",      href:"/doctor/lab-results",       icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>) },
  { label:"Patient Records",  href:"/doctor/patients",          icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>) },
  { label:"Medical Analysis", href:"/doctor/analysis",    badge:"AI", icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>) },
  { label:"Heart Predictor",    href:"/doctor/heart-predict",  badge:"AI", icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>) },
  { label:"Clinical Assistant", href:"/doctor/rag-assistant",   badge:"AI", icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>) },
  { label:"Vitamin Predictor",   href:"/doctor/vitamin-predict", badge:"AI", icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>) },
  { label:"Medicine Analysis",href:"/doctor/medicine-analysis",  icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10m-10 0v4a2 2 0 002 2h4"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>) },
];

const LAST_READ_KEY = "doctor_notif_last_read";

function getInitials(name) {
  if (!name) return "DR";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
function getStoredUser() {
  try { const s = sessionStorage.getItem("user"); return s ? JSON.parse(s) : null; } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LAYOUT
// ─────────────────────────────────────────────────────────────────────────────
export default function DoctorLayout() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const activePage  = PATH_TO_PAGE[location.pathname] || "Dashboard";
  const [sidebarOpen, setSidebarOpen]     = useState(() => localStorage.getItem("doctor_sidebar") !== "closed");
  const [notifOpen,   setNotifOpen]       = useState(false);
  const [showLogout,  setShowLogout]      = useState(false);

  // Notification state
  const [notifs,      setNotifs]          = useState([]);
  const [unreadIds,   setUnreadIds]       = useState(new Set());
  const [loadingN,    setLoadingN]        = useState(false);
  const [toasts,      setToasts]          = useState([]);
  const prevIdsRef                        = useRef(new Set());
  const toastIdRef                        = useRef(0);
  const unreadIdsRef                      = useRef(new Set()); // mirror of unreadIds for async access

  const user        = getStoredUser();
  const displayName = user?.name || "Doctor";
  const initials    = getInitials(user?.name);
  const expYears    = parseInt(user?.doctorDetails?.workingExperience, 10);
  const subtitle    = !isNaN(expYears) && expYears > 0 ? `${expYears}+ yrs experience` : "Doctor";
  const today       = new Date().toLocaleDateString("en-US",{ weekday:"long",year:"numeric",month:"long",day:"numeric" });

  // ── Fetch notifications ──────────────────────────────────────
  const fetchNotifs = useCallback(async (showToasts = false) => {
    if (!showToasts) setLoadingN(true);   // only show spinner on initial load
    try {
      const todayStr = getLocalDateStr();
      const [lrRes, aptRes, rxRes] = await Promise.allSettled([
        api.get("/lab-results?status=completed&limit=50"),
        api.get(`/appointments/today?date=${todayStr}`),
        api.get("/prescriptions?limit=50"),
      ]);

      const labResults   = lrRes.status  === "fulfilled" ? (lrRes.value.data.results ?? [])              : [];
      const appointments = aptRes.status === "fulfilled" ? (aptRes.value.data.appointments ?? [])        : [];
      const prescriptions= rxRes.status  === "fulfilled" ? (rxRes.value.data.prescriptions ?? [])        : [];

      // Pass current unreadIds so yesterday's items only show if still unread
      const built = buildNotifications(labResults, appointments, prescriptions, unreadIdsRef.current);
      setNotifs(built);

      const builtIds = new Set(built.map(n => n.id));

      // Detect new ones for toast
      if (showToasts) {
        const newItems = built.filter(n => !prevIdsRef.current.has(n.id));
        // Show critical toasts immediately, limit others to 2
        const critNew = newItems.filter(n => n.type === "critical");
        const otherNew = newItems.filter(n => n.type !== "critical").slice(0, 2);
        [...critNew, ...otherNew].forEach(n => {
          const id = ++toastIdRef.current;
          setToasts(prev => [...prev.slice(-3), { ...n, id, duration: n.type === "critical" ? 8000 : 5200 }]);
        });
        // Add new unread IDs, and prune IDs for notifications that no longer exist
        setUnreadIds(prev => {
          const pruned = new Set([...prev].filter(id => builtIds.has(id)));
          newItems.forEach(n => pruned.add(n.id));
          unreadIdsRef.current = pruned;
          return pruned;
        });
      } else {
        // First load — only mark as unread those newer than last time the panel was opened
        const lastRead = localStorage.getItem(LAST_READ_KEY);
        if (lastRead) {
          const lastReadTime = new Date(lastRead);
          const ids = new Set(built.filter(n => new Date(n.time) > lastReadTime).map(n => n.id));
          unreadIdsRef.current = ids;
          setUnreadIds(ids);
        } else {
          unreadIdsRef.current = builtIds;
          setUnreadIds(new Set(builtIds));
        }
      }
      prevIdsRef.current = builtIds;
    } catch (e) {
      console.error("Notification fetch failed:", e);
    } finally {
      setLoadingN(false);
    }
  }, []);

  // ── Notification polling ────────────────────────────────────
  // Phase 1 (immediate): silent baseline — sets prevIdsRef, no toasts
  // Phase 2 (500ms later): fire toasts for anything already unread on login
  // Then poll every 10s silently for new items
  useEffect(() => {
    let dead = false;
    fetchNotifs(false);                                        // baseline immediately
    const phase2 = setTimeout(() => {
      if (!dead) fetchNotifs(true);                           // toasts after 500ms
    }, 500);
    const interval = setInterval(() => {
      if (!dead) fetchNotifs(true);
    }, 10_000);                                               // poll every 10s
    return () => { dead = true; clearTimeout(phase2); clearInterval(interval); };
  }, [fetchNotifs]);

  // Close dropdown when clicking outside
  const notifRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = () => {
    unreadIdsRef.current = new Set();
    setUnreadIds(new Set());
    localStorage.setItem(LAST_READ_KEY, new Date().toISOString());
  };
  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  const unreadCount = unreadIds.size;

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'DM Sans', sans-serif" }} className="flex h-screen bg-gray-50 overflow-hidden">
      {showLogout && <LogoutModal onConfirm={handleLogout} onCancel={() => setShowLogout(false)} />}

      {/* Liquid glass toasts */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── SIDEBAR ── */}
      <aside className={`relative flex flex-col bg-[#0D2137] text-white transition-all duration-300 flex-shrink-0 ${sidebarOpen ? "w-64" : "w-20"}`}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden">
            <img src="/Logo.png" alt="PHC" className="w-full h-full object-contain"/>
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:600, fontSize:"0.85rem", lineHeight:1.2 }}>People's Health Care</div>
              <div className="text-white/40 text-xs">Doctor Portal</div>
            </div>
          )}
        </div>

        {sidebarOpen && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              {user?.photo
                ? <img src={user.photo} alt={displayName} className="w-9 h-9 rounded-full object-cover"/>
                : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-sm font-bold">{initials}</div>
              }
              <div className="overflow-hidden">
                <div className="text-sm font-semibold truncate">{displayName}</div>
                <div className="text-white/40 text-xs truncate">{subtitle}</div>
              </div>
              <div className="ml-auto w-2 h-2 rounded-full bg-green-400 flex-shrink-0"/>
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 mt-6 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = activePage === item.label;
            return (
              <Link key={item.label} to={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg" : "text-white/60 hover:bg-white/10 hover:text-white"}
                  ${!sidebarOpen ? "justify-center" : ""}`}>
                <span className="flex-shrink-0">{item.icon}</span>
                {sidebarOpen && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && <span className="text-xs bg-cyan-500 text-white px-2 py-0.5 rounded-full font-bold">{item.badge}</span>}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <Link to="/doctor/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${!sidebarOpen ? "justify-center" : ""} ${
              activePage === "Settings"
                ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            {sidebarOpen && <span>Settings</span>}
          </Link>
          <button onClick={() => setShowLogout(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition ${!sidebarOpen ? "justify-center" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>

        <button onClick={() => { const next = !sidebarOpen; setSidebarOpen(next); localStorage.setItem('doctor_sidebar', next ? 'open' : 'closed'); }}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-10 rounded-full bg-[#0D2137] border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-all duration-200 shadow-lg z-10">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
            {sidebarOpen ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}
          </svg>
        </button>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
          <div>
            <div className="text-xs text-gray-400">Doctor Portal</div>
            <div className="font-semibold text-gray-800">{activePage}</div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden md:block text-sm text-gray-400">{today}</div>

            {/* Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setNotifOpen(o => !o); if (!notifOpen) { markAllRead(); } }}
                className="relative p-2 rounded-xl hover:bg-gray-100 transition text-gray-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
                {/* Badge */}
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                {/* Has critical pulse ring — only while unread */}
                {notifs.some(n => n.type === "critical" && unreadIds.has(n.id)) && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500/30 animate-ping"/>
                )}
              </button>

              {notifOpen && (
                <NotificationPanel
                  notifs={notifs}
                  loading={loadingN}
                  unreadCount={unreadCount}
                  unreadIds={unreadIds}
                  onMarkAllRead={markAllRead}
                />
              )}
            </div>

            {/* Avatar */}
            <Link to="/doctor/settings" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition">
              {user?.photo
                ? <img src={user.photo} alt={displayName} className="w-9 h-9 rounded-xl object-cover"/>
                : <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-sm font-bold">{initials}</div>
              }
              <div className="hidden md:block">
                <div className="text-sm font-semibold text-gray-800">{displayName}</div>
                <div className="text-xs text-gray-400">{subtitle}</div>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}