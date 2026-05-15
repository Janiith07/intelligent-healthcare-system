import { useState, useCallback, useEffect, useRef } from "react";

// ── Liquid Glass Toast ────────────────────────────────────────────────────────
// Called from anywhere via window.__cashierToast({ rx, patientId, patientName, medicines })
export function LiquidGlassToast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    window.__cashierToast = (data) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, ...data }]);
      // Also save to persistent notifications in localStorage
      const saved = JSON.parse(localStorage.getItem("cashier_notifications") || "[]");
      saved.unshift({
        id,
        type:        data.type        || "pharmacy",
        billId:      data.billId      || null,
        rx:          data.rx,
        patientId:   data.patientId,
        patientName: data.patientName,
        medicines:   data.medicines,
        tests:       data.tests       || [],
        doctorName:  data.doctorName  || "",
        priority:    data.priority    || "",
        time:        new Date().toISOString(),
        read:        false,
      });
      // cap at 50
      localStorage.setItem("cashier_notifications", JSON.stringify(saved.slice(0, 50)));
      // dispatch event so bell updates
      window.dispatchEvent(new Event("cashier_notifications_updated"));
    };
    return () => { delete window.__cashierToast; };
  }, []);

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <>
      <style>{`
        @keyframes lgSlideIn {
          from { opacity: 0; transform: translateX(110%) scale(0.92); }
          to   { opacity: 1; transform: translateX(0)   scale(1); }
        }
        @keyframes lgProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        @keyframes lgPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(1,87,155,0.35); }
          50%       { box-shadow: 0 0 0 8px rgba(1,87,155,0); }
        }
      `}</style>
      <div style={{
        position: "fixed", top: 20, right: 20, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 12,
        pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <PharmacyToast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </>
  );
}

function PharmacyToast({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);

  const isLab = toast.type === "lab_request";

  // Both pharmacy and lab use the same blue theme
  const accent1   = "#01579B";
  const accent2   = "#0288D1";
  const shadowRgb = "1,87,155";

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 350);
    }, 6000);
    return () => clearTimeout(timerRef.current);
  }, [onDismiss]);

  const handleDismiss = () => {
    clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(onDismiss, 350);
  };

  const itemList = isLab
    ? (Array.isArray(toast.tests) ? toast.tests : [])
    : (Array.isArray(toast.medicines)
        ? toast.medicines
        : typeof toast.medicines === "string"
          ? toast.medicines.split(",").map(m => m.trim())
          : []);

  return (
    <div
      onClick={handleDismiss}
      style={{
        pointerEvents: "auto",
        cursor: "pointer",
        width: 340,
        borderRadius: 20,
        overflow: "hidden",
        background: "rgba(255,255,255,0.22)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.45)",
        boxShadow: `
          0 8px 32px rgba(${shadowRgb},0.18),
          0 2px 8px rgba(0,0,0,0.08),
          inset 0 1px 0 rgba(255,255,255,0.6)
        `,
        animation: exiting
          ? "lgSlideIn 0.35s ease reverse forwards"
          : "lgSlideIn 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards",
      }}
    >
      {/* Glass shimmer top strip */}
      <div style={{
        height: 3,
        background: "linear-gradient(90deg, #01579B, #0288D1, #4FC3F7, #01579B)",
        backgroundSize: "200% 100%",
        animation: "lgProgress 6s linear forwards",
      }} />

      <div style={{ padding: "14px 16px 16px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* Icon */}
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
            background: `linear-gradient(135deg, ${accent1}, ${accent2})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 12px rgba(${shadowRgb},0.35)`,
            animation: "lgPulse 2s ease-in-out 3",
            fontSize: 20,
          }}>
            {isLab ? "🧪" : "💊"}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: `rgba(${shadowRgb},0.85)`,
              marginBottom: 2,
            }}>
              {isLab ? "🔬 Doctor — Lab Request" : "💬 Pharmacy — Medicines Ready"}
            </div>
            <div style={{
              fontSize: 14.5, fontWeight: 700,
              color: "#0D2137",
              lineHeight: 1.25,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {toast.patientName || "Patient"}
            </div>
          </div>

          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            style={{
              flexShrink: 0, width: 24, height: 24, borderRadius: 8,
              background: "rgba(0,0,0,0.08)", border: "none",
              color: "#555", fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Info pills */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
            background: `rgba(${shadowRgb},0.1)`,
            border: `1px solid rgba(${shadowRgb},0.2)`,
            color: accent1,
          }}>
            📋 {toast.rx}
          </span>
          {toast.patientId && toast.patientId !== "—" && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
              background: `rgba(${shadowRgb},0.08)`,
              border: `1px solid rgba(${shadowRgb},0.2)`,
              color: accent2,
            }}>
              🪪 {toast.patientId}
            </span>
          )}
          {isLab && toast.priority === "Urgent" && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
              color: "#dc2626",
            }}>
              🚨 Urgent
            </span>
          )}
        </div>

        {/* Items list (medicines or tests) */}
        {itemList.length > 0 && (
          <div style={{
            marginTop: 10,
            background: `rgba(${shadowRgb},0.05)`,
            border: `1px solid rgba(${shadowRgb},0.12)`,
            borderRadius: 12,
            padding: "8px 10px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: accent2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
              {isLab ? "Requested Tests" : "Dispensed Medicines"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {itemList.map((m, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 20,
                  background: "rgba(255,255,255,0.6)",
                  border: `1px solid rgba(${shadowRgb},0.15)`,
                  color: "#0D2137", fontWeight: 500,
                }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div style={{ marginTop: 8, fontSize: 10, color: "rgba(0,0,0,0.38)", display: "flex", alignItems: "center", gap: 4 }}>
          <span>💡</span> Tap to dismiss · Saved in notifications
        </div>
      </div>
    </div>
  );
}

// ── Notification Panel ────────────────────────────────────────────────────────
function NotificationPanel({ onClose }) {
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = useCallback(() => {
    const saved = JSON.parse(localStorage.getItem("cashier_notifications") || "[]");
    setNotifications(saved);
  }, []);

  useEffect(() => {
    loadNotifications();
    window.addEventListener("cashier_notifications_updated", loadNotifications);
    return () => window.removeEventListener("cashier_notifications_updated", loadNotifications);
  }, [loadNotifications]);

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    localStorage.setItem("cashier_notifications", JSON.stringify(updated));
    setNotifications(updated);
  };

  const clearAll = () => {
    localStorage.removeItem("cashier_notifications");
    setNotifications([]);
  };

  const markRead = (id) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    localStorage.setItem("cashier_notifications", JSON.stringify(updated));
    setNotifications(updated);
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 998 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: "absolute", top: "calc(100% + 10px)", right: 0,
        zIndex: 999, width: 360,
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(32px) saturate(200%)",
        WebkitBackdropFilter: "blur(32px) saturate(200%)",
        border: "1px solid rgba(255,255,255,0.55)",
        borderRadius: 20,
        boxShadow: "0 20px 60px rgba(1,87,155,0.2), 0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
        overflow: "hidden",
        animation: "lgSlideIn 0.28s cubic-bezier(0.34,1.36,0.64,1)",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 16px",
          background: "linear-gradient(135deg, rgba(13,33,55,0.96), rgba(1,87,155,0.92))",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ fontSize: 18 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: 14 }}>Cashier Notifications</div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1 }}>
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 8,
                background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)",
                color: "white", cursor: "pointer",
              }}>Mark all read</button>
            )}
            {notifications.length > 0 && (
              <button onClick={clearAll} style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 8,
                background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5", cursor: "pointer",
              }}>Clear all</button>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {notifications.length === 0 ? (
            <div style={{ padding: "36px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7280" }}>No notifications yet</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Pharmacy dispatches and lab requests will appear here</div>
            </div>
          ) : (
            notifications.map((n, idx) => {
              const isLab = n.type === "lab_request";
              const accent      = "#01579B";
              const accentLight = "1,87,155";
              const iconBg      = "linear-gradient(135deg, #01579B, #0288D1)";
              const icon        = isLab ? "🧪" : "💊";

              const items = isLab
                ? (Array.isArray(n.tests) ? n.tests : [])
                : (Array.isArray(n.medicines)
                    ? n.medicines
                    : typeof n.medicines === "string"
                      ? n.medicines.split(",").map(m => m.trim())
                      : []);

              return (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: idx < notifications.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                    background: n.read ? "transparent" : `rgba(${accentLight},0.04)`,
                    cursor: "pointer",
                    transition: "background 0.15s",
                    position: "relative",
                  }}
                >
                  {/* Unread dot */}
                  {!n.read && (
                    <div style={{
                      position: "absolute", top: 16, right: 16,
                      width: 8, height: 8, borderRadius: "50%",
                      background: accent,
                      boxShadow: `0 0 0 2px rgba(${accentLight},0.2)`,
                    }} />
                  )}

                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {/* Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                      background: iconBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17,
                      opacity: n.read ? 0.65 : 1,
                    }}>{icon}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Patient name + time */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0D2137", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {n.patientName || "Patient"}
                        </span>
                        <span style={{ fontSize: 10, color: "#9CA3AF", flexShrink: 0 }}>{formatTime(n.time)}</span>
                      </div>

                      {/* Message */}
                      <div style={{ fontSize: 12, color: "#4B5563", marginTop: 2, lineHeight: 1.4 }}>
                        {isLab
                          ? `Lab request submitted${n.doctorName ? ` by Dr. ${n.doctorName}` : ""} — ready for billing`
                          : "Medicines received & ready for billing"}
                      </div>

                      {/* Pills row */}
                      <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                          background: `rgba(${accentLight},0.1)`, border: `1px solid rgba(${accentLight},0.18)`,
                          color: accent,
                        }}>📋 {n.rx}</span>
                        {n.patientId && n.patientId !== "—" && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                            background: `rgba(${accentLight},0.08)`, border: `1px solid rgba(${accentLight},0.18)`,
                            color: accent,
                          }}>🪪 {n.patientId}</span>
                        )}
                        {isLab && n.priority === "Urgent" && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                            color: "#dc2626",
                          }}>🚨 Urgent</span>
                        )}
                      </div>

                      {/* Items (medicines or tests) */}
                      {items.length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                          {items.map((m, i) => (
                            <span key={i} style={{
                              fontSize: 10, padding: "1px 7px", borderRadius: 20,
                              background: "rgba(16,185,129,0.08)",
                              border: "1px solid rgba(16,185,129,0.2)",
                              color: "#065f46",
                              fontWeight: 500,
                            }}>
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Glass footer shimmer */}
        <div style={{
          height: 3,
          background: "linear-gradient(90deg, transparent, rgba(1,87,155,0.25), transparent)",
        }} />
      </div>
    </>
  );
}

// ── Notification Bell ─────────────────────────────────────────────────────────
function NotificationBell() {
  const [count, setCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const bellRef = useRef(null);

  const refreshCount = useCallback(() => {
    const saved = JSON.parse(localStorage.getItem("cashier_notifications") || "[]");
    setCount(saved.filter(n => !n.read).length);
  }, []);

  useEffect(() => {
    refreshCount();
    window.addEventListener("cashier_notifications_updated", refreshCount);
    return () => window.removeEventListener("cashier_notifications_updated", refreshCount);
  }, [refreshCount]);

  return (
    <div ref={bellRef} style={{ position: "relative" }}>
      <style>{`
        @keyframes bellRing {
          0%,100% { transform: rotate(0deg); }
          15%      { transform: rotate(18deg); }
          30%      { transform: rotate(-16deg); }
          45%      { transform: rotate(12deg); }
          60%      { transform: rotate(-8deg); }
          75%      { transform: rotate(5deg); }
        }
        .bell-animate { animation: bellRing 0.7s ease; }
      `}</style>

      <button
        onClick={() => {
          setPanelOpen(o => !o);
          if (!panelOpen) {
            // ring animation
            const el = bellRef.current?.querySelector(".bell-icon");
            if (el) {
              el.classList.remove("bell-animate");
              void el.offsetWidth;
              el.classList.add("bell-animate");
            }
          }
        }}
        style={{
          position: "relative",
          width: 38, height: 38, borderRadius: 12,
          background: panelOpen
            ? "linear-gradient(135deg, #01579B, #0277BD)"
            : "rgba(1,87,155,0.08)",
          border: panelOpen
            ? "1px solid rgba(1,87,155,0.4)"
            : "1px solid rgba(1,87,155,0.15)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
          color: panelOpen ? "white" : "#01579B",
        }}
        title="Pharmacy Notifications"
      >
        <svg className="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 18, height: 18 }}>
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>

        {count > 0 && (
          <div style={{
            position: "absolute", top: -5, right: -5,
            background: "linear-gradient(135deg, #ef4444, #dc2626)",
            color: "white", borderRadius: "50%",
            width: 18, height: 18,
            fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid white",
            boxShadow: "0 2px 6px rgba(239,68,68,0.4)",
            lineHeight: 1,
          }}>
            {count > 9 ? "9+" : count}
          </div>
        )}
      </button>

      {panelOpen && (
        <NotificationPanel onClose={() => setPanelOpen(false)} />
      )}
    </div>
  );
}

// ── Logout Modal ──────────────────────────────────────────────────────────────
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
        <p className="text-center text-gray-500 text-sm mb-6">Are you sure you want to log out of your account?</p>
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

// ── Nav Items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/cashier/dashboard",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    label: "Sales & Billing",
    href: "/cashier/billing",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  },
  {
    label: "Billing Turnover",
    href: "/cashier/billing-turnover",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  },
];

const ACCENT_FROM = "#01579B";
const ACCENT_TO   = "#0277BD";

// ── Main Layout ───────────────────────────────────────────────────────────────
export default function CashierLayout({ children, activePage = "Dashboard" }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLogout, setShowLogout]   = useState(false);

  const user = (() => { try { return JSON.parse(sessionStorage.getItem("user")) || {}; } catch { return {}; } })();
  const initials = user.name?.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase() || "CS";

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Global liquid glass toast renderer */}
      <LiquidGlassToast />

      {showLogout && <LogoutModal onConfirm={handleLogout} onCancel={() => setShowLogout(false)} />}

      {/* Sidebar */}
      <aside
        className={`relative flex flex-col text-white transition-all duration-300 flex-shrink-0 ${sidebarOpen ? "w-64" : "w-20"}`}
        style={{ background: "linear-gradient(180deg, #0D2137 0%, #0a1a2e 100%)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden">
            <img src="/Logo.png" alt="PHC" className="w-full h-full object-contain" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: "0.85rem", lineHeight: 1.2 }}>
                People's Health Care
              </div>
              <div className="text-white/40 text-xs">Cashier Portal</div>
            </div>
          )}
        </div>

        {/* Staff mini-card */}
        {sidebarOpen && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${ACCENT_FROM}, ${ACCENT_TO})` }}>
                {initials}
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-semibold truncate">{user.name || "Cashier"}</div>
                <div className="text-white/40 text-xs">Cashier Staff</div>
              </div>
              <div className="ml-auto w-2 h-2 rounded-full bg-green-400 flex-shrink-0"/>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 mt-6 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = activePage === item.label;
            return (
              <a key={item.label} href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive ? "text-white shadow-lg" : "text-white/60 hover:bg-white/10 hover:text-white"
                } ${!sidebarOpen ? "justify-center" : ""}`}
                style={isActive ? { background: `linear-gradient(135deg, ${ACCENT_FROM}, ${ACCENT_TO})` } : {}}>
                <span className="flex-shrink-0">{item.icon}</span>
                {sidebarOpen && <span className="flex-1">{item.label}</span>}
              </a>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button onClick={() => setShowLogout(true)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition w-full ${!sidebarOpen ? "justify-center" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-10 rounded-full bg-[#0D2137] border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-all duration-200 shadow-lg z-10">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
            {sidebarOpen ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}
          </svg>
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
          <div>
            <div className="text-xs text-gray-400">Cashier Portal</div>
            <div className="font-semibold text-gray-800">{activePage}</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden md:block text-sm text-gray-400">{today}</div>

            {/* ── Notification Bell ── */}
            <NotificationBell />

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                style={{ background: `linear-gradient(135deg, ${ACCENT_FROM}, ${ACCENT_TO})` }}>
                {initials}
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-semibold text-gray-800">{user.name || "Cashier"}</div>
                <div className="text-xs text-gray-400">Cashier Staff</div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
