/**
 * LiquidGlassToast — Apple liquid glass toast system
 *
 * Exports:
 *   ToastProvider        — wrap your app once
 *   useToast()           — toast.success/error/warning/info(title, msg, notifType)
 *   NotificationPanel    — bell dropdown panel showing notification history
 *   useNotifStore()      — access { notifications, unreadCount, markAllRead }
 *   NotificationBell     — bell icon + panel trigger
 *   PreCheckStack        — floating liquid-glass lab pre-check cards (patient-only)
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import api from "../services/api";

const NotifStoreCtx = createContext(null);
export function useNotifStore() {
  const ctx = useContext(NotifStoreCtx);
  if (!ctx) throw new Error("useNotifStore must be used inside ToastProvider");
  return ctx;
}

const ToastCtx = createContext(null);
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

const TYPE_CFG = {
  success: { badge:"SUCCESS", badgeBg:"rgba(52,199,89,0.22)", badgeColor:"#1a7f37", gradStart:"#06B6D4", gradEnd:"#34C759", barColor:"#34C759", labelColor:"#0891b2", label:"NOTIFICATION" },
  error:   { badge:"ERROR",   badgeBg:"rgba(255,59,48,0.22)",  badgeColor:"#c0392b", gradStart:"#FF3B30", gradEnd:"#FF6B35", barColor:"#FF3B30", labelColor:"#c0392b", label:"ALERT" },
  warning: { badge:"IMPORTANT",badgeBg:"rgba(124,58,237,0.20)",badgeColor:"#6d28d9",gradStart:"#7C3AED", gradEnd:"#06B6D4", barColor:"#7C3AED", labelColor:"#0891b2", label:"ACTION REQUIRED" },
  info:    { badge:"IMPORTANT",badgeBg:"rgba(124,58,237,0.20)",badgeColor:"#6d28d9",gradStart:"#06B6D4", gradEnd:"#7C3AED", barColor:"#06B6D4", labelColor:"#0891b2", label:"NOTIFICATION" },
};

function typeIconPath(t) {
  switch (t) {
    case "lab_request_created":  return "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10m-10 0v4a2 2 0 002 2h4";
    case "payment_confirmed":    return "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z";
    case "results_uploaded":     return "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z";
    case "equipment_alert_sent": return "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z";
    case "equipment_added":      return "M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16";
    case "equipment_restocked":  return "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4";
    case "service_acknowledged": return "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z";
    default:                     return "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9";
  }
}

// ─── Toast Card ────────────────────────────────────────────────────────────
const TOAST_DURATION = 5000;
function ToastCard({ id, type="info", notifType, title, message, onRemove }) {
  const [phase, setPhase] = useState("entering");
  const cfg = TYPE_CFG[type] || TYPE_CFG.info;
  const dismiss = useCallback(() => { setPhase("exiting"); setTimeout(() => onRemove(id), 360); }, [id, onRemove]);
  useEffect(() => {
    const t0 = setTimeout(() => setPhase("visible"), 16);
    const t1 = setTimeout(dismiss, TOAST_DURATION);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, [dismiss]);
  return (
    <div style={{
      width:"360px", borderRadius:"18px", overflow:"hidden", position:"relative", pointerEvents:"all",
      background:"rgba(255,255,255,0.86)", backdropFilter:"blur(40px) saturate(2.2)", WebkitBackdropFilter:"blur(40px) saturate(2.2)",
      border:"1px solid rgba(255,255,255,0.70)",
      boxShadow:"0 10px 36px rgba(0,0,0,0.18), 0 3px 10px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8)",
      transform: phase==="entering"?"translateY(-20px) scale(0.92)":phase==="exiting"?"translateY(-16px) scale(0.90)":"translateY(0) scale(1)",
      opacity: phase==="visible"?1:0,
      transition: phase==="entering"?"transform 0.40s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s ease":
                  phase==="exiting" ?"transform 0.34s ease-in, opacity 0.28s ease-in":"none",
    }}>
      <div style={{ display:"flex", gap:"13px", padding:"14px 14px 12px 14px", alignItems:"flex-start" }}>
        <div style={{ width:"44px", height:"44px", borderRadius:"12px", flexShrink:0, background:`linear-gradient(135deg,${cfg.gradStart},${cfg.gradEnd})`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 12px rgba(0,0,0,0.20)" }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={typeIconPath(notifType||type)}/></svg>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"7px", marginBottom:"4px", flexWrap:"wrap" }}>
            <span style={{ fontSize:"10px", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:cfg.labelColor }}>{cfg.label}</span>
            <span style={{ fontSize:"10px", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", background:cfg.badgeBg, color:cfg.badgeColor, padding:"2px 8px", borderRadius:"20px", border:`1px solid ${cfg.badgeColor}44` }}>{cfg.badge}</span>
          </div>
          <div style={{ fontWeight:700, fontSize:"13.5px", color:"#0f172a", lineHeight:1.3, marginBottom:message?"3px":0 }}>{title}</div>
          {message && <div style={{ fontSize:"12px", color:"#475569", lineHeight:1.5 }}>{message}</div>}
        </div>
        <button onClick={dismiss} style={{ width:"22px", height:"22px", borderRadius:"7px", border:"none", background:"rgba(0,0,0,0.07)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"15px", color:"#64748b", flexShrink:0, padding:0, lineHeight:1 }}>×</button>
      </div>
      <div style={{ position:"absolute", bottom:0, left:0, height:"3px", background:cfg.barColor, opacity:0.85, animation:`lgBarShrink ${TOAST_DURATION}ms linear forwards` }}/>
    </div>
  );
}

// ─── Notification Panel ────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff/60000), hrs = Math.floor(diff/3600000), days = Math.floor(diff/86400000);
  if (days>0) return `${days}d ago`; if (hrs>0) return `${hrs}h ago`; if (mins>0) return `${mins}m ago`; return "just now";
}

// ── Per-type accent config (same accent reused for icon ring, label, badge, card tint) ──
const NOTIF_ROW_CFG = {
  lab_request_created:  { accent:"#0D47A1", label:"LAB REQUEST",   badge:"NEW",          icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10m-10 0v4a2 2 0 002 2h4"/></svg> },
  payment_confirmed:    { accent:"#059669", label:"PAYMENT",       badge:"CONFIRMED",    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg> },
  results_uploaded:     { accent:"#7C3AED", label:"RESULTS READY", badge:"COMPLETED",    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
  equipment_alert_sent: { accent:"#DC2626", label:"EQUIPMENT",     badge:"URGENT",       icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> },
  equipment_added:      { accent:"#0891B2", label:"EQUIPMENT",     badge:"ADDED",        icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg> },
  equipment_restocked:  { accent:"#059669", label:"STOCK",         badge:"RESTOCKED",    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg> },
  service_acknowledged: { accent:"#D97706", label:"SERVICE",       badge:"ACKNOWLEDGED", icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
  default:              { accent:"#6B7280", label:"NOTIFICATION",  badge:"INFO",         icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg> },
};

function getRowCfg(type) { return NOTIF_ROW_CFG[type] || NOTIF_ROW_CFG.default; }

// ── Portal themes ──────────────────────────────────────────────────────────
export const NOTIF_THEME_LAB = {
  headerFrom: "#0D2137", headerTo: "#1565C0",
  panelBg:    "linear-gradient(160deg,rgba(219,234,254,0.93) 0%,rgba(239,246,255,0.96) 100%)",
  panelBorder:"rgba(96,165,250,0.55)",
  shadow:     "0 24px 60px rgba(13,71,161,0.15), 0 4px 16px rgba(0,0,0,0.08)",
};
export const NOTIF_THEME_ADMIN = {
  headerFrom: "#0D2137", headerTo: "#283593",
  panelBg:    "linear-gradient(160deg,rgba(224,231,255,0.93) 0%,rgba(238,242,255,0.96) 100%)",
  panelBorder:"rgba(129,140,248,0.55)",
  shadow:     "0 24px 60px rgba(26,35,126,0.15), 0 4px 16px rgba(0,0,0,0.08)",
};

// ── Glass notification row card (doctor-style) ─────────────────────────────
function NotifRow({ n }) {
  const cfg     = getRowCfg(n.type);
  const isUrgent = n.type === "equipment_alert_sent";
  const accent   = cfg.accent;

  return (
    <div className="px-3 py-2 border-b border-black/5 last:border-0">
      <div className="rounded-[14px] px-3.5 py-3 relative overflow-hidden"
        style={{
          background: isUrgent
            ? "linear-gradient(135deg,rgba(254,202,202,0.55),rgba(252,165,165,0.35))"
            : `linear-gradient(135deg,${accent}14,${accent}08)`,
          border: isUrgent
            ? "1px solid rgba(252,165,165,0.6)"
            : `1px solid ${accent}40`,
          backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
          boxShadow:`inset 0 1px 0 rgba(255,255,255,0.55)`,
        }}>
        {/* shimmer */}
        <div className="absolute inset-0 rounded-[14px] pointer-events-none"
          style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.30),rgba(255,255,255,0))" }}/>

        {/* row 1: icon · label · badge · time */}
        <div className="flex items-center gap-2 mb-1.5 relative">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background:`${accent}22`, border:`1.5px solid ${accent}50` }}>
            <span style={{ color: accent }}>{cfg.icon}</span>
          </div>
          <span className="text-[9.5px] font-black uppercase tracking-[0.1em] flex-1"
            style={{ color: accent }}>{cfg.label}</span>
          <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full text-white"
            style={{ background: accent }}>{cfg.badge}</span>
          <span className="text-[10px] text-gray-400 whitespace-nowrap font-medium flex-shrink-0">
            {timeAgo(n.createdAt)}
          </span>
        </div>

        {/* title */}
        <div className="text-[12.5px] font-bold leading-snug text-gray-800 relative mb-0.5">{n.title}</div>

        {/* message */}
        {n.message && (
          <div className={`text-[11px] leading-relaxed relative ${isUrgent ? "text-red-600 font-medium" : "text-gray-500"}`}>
            {n.message}
          </div>
        )}
      </div>
    </div>
  );
}

// ── NotificationPanel — doctor-style, themed per portal ───────────────────
export function NotificationPanel({ onClose, theme = NOTIF_THEME_LAB }) {
  const { notifications, unreadCount, markAllRead } = useNotifStore();
  const urgent = notifications.filter(n => n.type === "equipment_alert_sent");
  const other  = notifications.filter(n => n.type !== "equipment_alert_sent");

  return (
    <div className="absolute right-0 top-full mt-2 w-[400px] rounded-2xl z-50 overflow-hidden"
      style={{
        background:   theme.panelBg,
        backdropFilter:"blur(20px) saturate(160%)", WebkitBackdropFilter:"blur(20px) saturate(160%)",
        border:`1.5px solid ${theme.panelBorder}`,
        boxShadow: theme.shadow,
      }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between"
        style={{ background:`linear-gradient(135deg,${theme.headerFrom},${theme.headerTo})` }}>
        <div>
          <div className="text-white font-semibold text-sm">Today's Notifications</div>
          <div className="text-white/50 text-xs mt-0.5">
            {notifications.length} today · {unreadCount} unread
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="text-[11px] text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition font-medium">
              Mark all read
            </button>
          )}
          <button onClick={onClose}
            className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition text-base leading-none">
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto" style={{ scrollbarWidth:"none" }}>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-white/60 flex items-center justify-center mb-3 shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-gray-400">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </div>
            <div className="text-sm font-semibold text-gray-600">All clear</div>
            <div className="text-xs text-gray-400 mt-1">No new notifications right now</div>
          </div>
        ) : (
          <div>
            {urgent.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-600">⚡ Critical Alerts</span>
                </div>
                {urgent.map(n => <NotifRow key={n._id} n={n} />)}
              </div>
            )}
            {other.length > 0 && (
              <div>
                {urgent.length > 0 && (
                  <div className="px-5 py-2 bg-white/50 border-b border-black/5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Activity</span>
                  </div>
                )}
                {other.map(n => <NotifRow key={n._id} n={n} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-black/5 text-center">
        <span className="text-xs text-gray-400">Real-time · Powered by People's Health Care</span>
      </div>
    </div>
  );
}

// ── NotificationBell — accepts optional theme ──────────────────────────────
export function NotificationBell({ theme = NOTIF_THEME_LAB }) {
  const { unreadCount } = useNotifStore();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition text-gray-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow"
            style={{ background: theme.headerTo }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationPanel onClose={() => setOpen(false)} theme={theme} />}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
}

// ─── Pre-Check Glass Card ──────────────────────────────────────────────────
function fmt12(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true });
}
function calcRemaining(readyAtIso) {
  if (!readyAtIso) return null;
  const ms = Math.max(0, new Date(readyAtIso).getTime() - Date.now());
  if (ms === 0) return null;
  const hrs = Math.floor(ms/3600000), mins = Math.floor((ms%3600000)/60000);
  return { str:`${hrs}h ${mins}m`, ms };
}

function PreCheckGlassCard({ notif, onDismiss, phase }) {
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t=>t+1), 60000); return () => clearInterval(id); }, []);

  const isReady    = notif.fastingHours === 0 || (notif.readyAt && new Date(notif.readyAt) <= new Date());
  const hasFasting = notif.fastingHours > 0;
  const rem        = isReady ? null : calcRemaining(notif.readyAt);

  const gradStart = isReady ? "rgba(16,185,129,0.90)" : "rgba(6,182,212,0.90)";
  const gradEnd   = isReady ? "rgba(52,199,89,0.80)"  : "rgba(124,58,237,0.85)";

  return (
    <div style={{
      width:"340px", borderRadius:"22px", overflow:"hidden", position:"relative", pointerEvents:"all",
      background:`linear-gradient(140deg,${gradStart},${gradEnd})`,
      backdropFilter:"blur(48px) saturate(2.4)", WebkitBackdropFilter:"blur(48px) saturate(2.4)",
      border:"1px solid rgba(255,255,255,0.38)",
      boxShadow:"0 16px 48px rgba(0,0,0,0.22), 0 4px 14px rgba(0,0,0,0.14), inset 0 1.5px 0 rgba(255,255,255,0.45)",
      padding:"14px 14px 13px 14px",
      transform: phase==="entering"?"translateX(30px) scale(0.94)":phase==="exiting"?"translateX(30px) scale(0.92)":"translateX(0) scale(1)",
      opacity: phase==="visible"?1:0,
      transition: phase==="entering"?"transform 0.42s cubic-bezier(0.34,1.56,0.64,1), opacity 0.30s ease":
                  phase==="exiting" ?"transform 0.30s ease-in, opacity 0.24s ease-in":"none",
    }}>
      <div style={{ display:"flex", gap:"11px", alignItems:"flex-start" }}>
        {/* Icon */}
        <div style={{ width:"42px", height:"42px", borderRadius:"13px", flexShrink:0, background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.38)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.35)" }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            {isReady ? <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/> : <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10m-10 0v4a2 2 0 002 2h4"/>}
          </svg>
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          {/* Label row */}
          <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"4px", flexWrap:"wrap" }}>
            <span style={{ fontSize:"9.5px", fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"rgba(255,255,255,0.82)" }}>LAB PRE-CHECK REQUIRED</span>
            <span style={{ fontSize:"9.5px", fontWeight:700, textTransform:"uppercase", background:"rgba(255,255,255,0.22)", color:"white", padding:"1.5px 8px", borderRadius:"20px", border:"1px solid rgba(255,255,255,0.42)" }}>
              {isReady ? "✓ READY" : "IMPORTANT"}
            </span>
          </div>
          {/* Test name */}
          <div style={{ fontWeight:700, fontSize:"14px", color:"white", lineHeight:1.25, marginBottom:"3px" }}>{notif.testName}</div>
          {/* Description */}
          <div style={{ fontSize:"12px", color:"rgba(255,255,255,0.82)", lineHeight:1.45 }}>
            {isReady ? "You may submit your sample now"
              : hasFasting ? `${notif.fastingHours}-hour fasting required before sample collection`
              : "Please review pre-conditions before visiting the lab"}
          </div>
          {/* Timer — only when waiting */}
          {!isReady && hasFasting && (
            <div style={{ marginTop:"10px", background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.24)", borderRadius:"13px", padding:"8px 12px", display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ fontSize:"16px", lineHeight:1 }}>⏱</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"9px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"rgba(255,255,255,0.70)" }}>Time Remaining</div>
                <div style={{ fontSize:"19px", fontWeight:800, color:"white", fontFamily:"'SF Mono','Fira Code',monospace", lineHeight:1.1 }}>{rem ? rem.str : "Calculating…"}</div>
              </div>
              {notif.readyAt && (
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:"9px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"rgba(255,255,255,0.70)" }}>Submit After</div>
                  <div style={{ fontSize:"14px", fontWeight:700, color:"white" }}>{fmt12(notif.readyAt)}</div>
                </div>
              )}
            </div>
          )}
          {/* Link */}
          <div style={{ marginTop:"8px" }}>
            <span style={{ fontSize:"11px", fontWeight:600, color:"rgba(255,255,255,0.92)", cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.40)", paddingBottom:"1px" }}>
              {isReady ? "Visit the lab now →" : "Tap to view pre-conditions →"}
            </span>
          </div>
          {/* Test ID */}
          <div style={{ marginTop:"5px", fontSize:"10px", fontFamily:"monospace", color:"rgba(255,255,255,0.45)" }}>{notif.testId}</div>
        </div>

        {/* Close */}
        <button onClick={() => onDismiss(notif._id)} style={{ width:"22px", height:"22px", borderRadius:"7px", border:"none", background:"rgba(255,255,255,0.20)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"15px", color:"rgba(255,255,255,0.85)", flexShrink:0, padding:0, lineHeight:1 }}>×</button>
      </div>
    </div>
  );
}

// ─── PreCheckStack ─────────────────────────────────────────────────────────
export function PreCheckStack({ headerHeight = 72 }) {
  const [notifications, setNotifications] = useState([]);
  const [dismissed,     setDismissed]     = useState(new Set());
  const [phases,        setPhases]        = useState({});

  const doFetch = useCallback(async () => {
    try {
      const res = await api.get("/lab-results/patient-notifications");
      const all = res.data.notifications || [];
      setNotifications(all);
      setPhases(prev => {
        const next = { ...prev };
        all.forEach(n => { if (!next[n._id]) next[n._id] = "entering"; });
        return next;
      });
      setTimeout(() => {
        setPhases(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(id => { if (next[id]==="entering") next[id]="visible"; });
          return next;
        });
      }, 60);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    doFetch();
    const id = setInterval(doFetch, 60000);
    return () => clearInterval(id);
  }, [doFetch]);

  const handleDismiss = useCallback((id) => {
    setPhases(prev => ({ ...prev, [id]: "exiting" }));
    setTimeout(() => setDismissed(prev => new Set([...prev, id])), 340);
  }, []);

  const visible = notifications.filter(n => !dismissed.has(n._id));
  if (visible.length === 0) return null;

  return (
    <div style={{ position:"fixed", top:`${headerHeight + 14}px`, right:"18px", zIndex:9500, display:"flex", flexDirection:"column", gap:"10px", alignItems:"flex-end", pointerEvents:"none" }}>
      {visible.map(n => (
        <div key={n._id} style={{ pointerEvents:"all" }}>
          <PreCheckGlassCard notif={n} onDismiss={handleDismiss} phase={phases[n._id] ?? "visible"}/>
        </div>
      ))}
    </div>
  );
}

// ─── Provider ──────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts,        setToasts]        = useState([]);
  const [notifications, setNotifications] = useState([]);
  const counterRef = useRef(0);

  const show = useCallback((type, title, message, notifType) => {
    const id  = ++counterRef.current;
    const nid = `local-${id}-${Date.now()}`;
    setToasts(p => [...p, { id, type, title, message, notifType: notifType||type }]);
    setNotifications(p => [{ _id:nid, type:notifType||type, title, message, createdAt:new Date().toISOString() }, ...p].slice(0,100));
  }, []);

  const toast = useMemo(() => ({
    success:(t,m,nt)=>show("success",t,m,nt),
    error:  (t,m,nt)=>show("error",  t,m,nt),
    warning:(t,m,nt)=>show("warning",t,m,nt),
    info:   (t,m,nt)=>show("info",   t,m,nt),
  }), [show]);

  const removeToast = useCallback(id => setToasts(p=>p.filter(t=>t.id!==id)), []);
  const markAllRead = useCallback(() => setNotifications([]), []);
  const unreadCount = notifications.length;
  const store = useMemo(() => ({ notifications, unreadCount, markAllRead }), [notifications, unreadCount, markAllRead]);

  return (
    <NotifStoreCtx.Provider value={store}>
      <ToastCtx.Provider value={toast}>
        {children}
        <style>{`@keyframes lgBarShrink{0%{width:100%}100%{width:0%}}`}</style>
        {/* Toast stack — TOP RIGHT */}
        <div style={{ position:"fixed", top:"18px", right:"18px", zIndex:99999, display:"flex", flexDirection:"column", gap:"10px", alignItems:"flex-end", pointerEvents:"none" }}>
          {toasts.slice(-5).map(t => <ToastCard key={t.id} {...t} onRemove={removeToast}/>)}
        </div>
      </ToastCtx.Provider>
    </NotifStoreCtx.Provider>
  );
}