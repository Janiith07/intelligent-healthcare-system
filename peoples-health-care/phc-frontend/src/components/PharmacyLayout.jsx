import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePharmacyNotifications } from "../hooks/usePharmacyNotifications";
import { formatTimeAgo, getNotificationColors, getStatusBadge } from "../utils/notificationUtils";

const API   = "http://localhost:5001/api";
const token = () => sessionStorage.getItem("token");
const authH = () => ({ Authorization: `Bearer ${token()}` });

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/pharmacy/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Dispensing Queue",
    href: "/pharmacy/queue",
    badgeKey: "pendingCount", // resolved dynamically
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: "Inventory",
    href: "/pharmacy/inventory",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
];

const ACCENT_FROM = "#263238";
const ACCENT_TO   = "#37474F";

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

export default function PharmacyLayout({ children, activePage = "Dashboard" }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [showLogout,  setShowLogout]  = useState(false);
  const [pendingCount, setPendingCount] = useState(null); // null = loading
  const navigate = useNavigate();
  
  // Use the new notifications hook
  const { notifications, summary, loading: notifLoading } = usePharmacyNotifications();

  // Fetch real pending count + refresh every 30 seconds
  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const res  = await fetch(`${API}/pharmacy/dashboard`, { headers: authH() });
        const data = await res.json();
        if (!cancelled && data.success) {
          const pending = data.dashboard?.prescriptionQueue?.pending ?? 0;
          setPendingCount(pending);
        }
      } catch {
        // silently keep previous count on network error
      }
    };

    fetchCount(); // immediate on mount
    const interval = setInterval(fetchCount, 30000); // every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="flex h-screen bg-gray-50 overflow-hidden">
      {showLogout && <LogoutModal onConfirm={handleLogout} onCancel={() => setShowLogout(false)} />}

      {/* ── SIDEBAR ── */}
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
              <div className="text-white/40 text-xs">Pharmacy Portal</div>
            </div>
          )}
        </div>

        {/* Staff mini-card */}
        {sidebarOpen && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${ACCENT_FROM}, ${ACCENT_TO})` }}>
                PH
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-semibold truncate">Pharmacist</div>
                <div className="text-white/40 text-xs">Pharmacy Staff</div>
              </div>
              <div className="ml-auto w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 mt-6 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.label;

            // Resolve badge value
            let badgeValue = null;
            if (item.badgeKey === "pendingCount" && pendingCount !== null && pendingCount > 0) {
              badgeValue = pendingCount > 99 ? "99+" : String(pendingCount);
            }

            return (
              <a key={item.label} href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive ? "text-white shadow-lg" : "text-white/60 hover:bg-white/10 hover:text-white"
                } ${!sidebarOpen ? "justify-center" : ""}`}
                style={isActive ? { background: `linear-gradient(135deg, ${ACCENT_FROM}, ${ACCENT_TO})` } : {}}>
                <span className="flex-shrink-0 relative">
                  {item.icon}
                  {/* Collapsed sidebar: show dot badge on icon */}
                  {!sidebarOpen && badgeValue && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {pendingCount > 9 ? "9+" : badgeValue}
                    </span>
                  )}
                </span>
                {sidebarOpen && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {badgeValue && (
                      <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center transition-all">
                        {badgeValue}
                      </span>
                    )}
                    {/* Show pulsing dot while loading */}
                    {item.badgeKey === "pendingCount" && pendingCount === null && (
                      <span className="w-2 h-2 rounded-full bg-white/30 animate-pulse" />
                    )}
                  </>
                )}
              </a>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-white/10">
          <button onClick={() => setShowLogout(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition ${!sidebarOpen ? "justify-center" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>

        {/* Sidebar collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-10 rounded-full bg-[#0D2137] border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-all duration-200 shadow-lg z-10"
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3 transition-transform">
            {sidebarOpen
              ? <polyline points="15 18 9 12 15 6" />
              : <polyline points="9 18 15 12 9 6" />
            }
          </svg>
        </button>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
          <div>
            <div className="text-xs text-gray-400">Pharmacy Portal</div>
            <div className="font-semibold text-gray-800">{activePage}</div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden md:block text-sm text-gray-400">{today}</div>
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-xl hover:bg-gray-100 transition text-gray-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                {(summary.total > 0) && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden max-h-[600px] flex flex-col">
                  {/* Header */}
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                    <span className="font-semibold text-sm text-gray-800">Notifications</span>
                    {summary.total > 0 && (
                      <span className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-full font-medium">
                        {summary.total} {summary.total === 1 ? "alert" : "alerts"}
                      </span>
                    )}
                  </div>

                  {/* Notifications List */}
                  <div className="flex-1 overflow-y-auto">
                    {notifLoading ? (
                      <div className="p-6 text-center text-gray-400">
                        <div className="animate-spin inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                        <p className="mt-2 text-sm">Loading notifications...</p>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-6 text-center">
                        <div className="text-3xl mb-2">📭</div>
                        <p className="text-sm text-gray-500">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((notif, index) => {
                        const colors = getNotificationColors(notif.type);
                        const statusBadge = notif.type === "prescription" ? getStatusBadge(notif.status) : null;

                        return (
                          <div 
                            key={`${notif.id}-${index}`}
                            className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition ${colors.bg}`}
                            onClick={() => {
                              if (notif.type === "prescription") {
                                setNotifOpen(false);
                                navigate("/pharmacy/queue");
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              {/* Icon */}
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 bg-white">
                                {notif.icon}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="text-sm font-semibold text-gray-800 truncate">
                                    {notif.message}
                                  </div>
                                  {statusBadge && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${statusBadge.bg} ${statusBadge.text}`}>
                                      {statusBadge.label}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">{notif.details}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {formatTimeAgo(notif.time)}
                                </p>

                                {/* Low stock specific info */}
                                {notif.type === "low_stock" && notif.expiryDate && (
                                  <p className="text-xs text-orange-600 mt-1">
                                    Expires: {new Date(notif.expiryDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="p-3 border-t border-gray-100 bg-gray-50">
                      <button
                        onClick={() => {
                          setNotifOpen(false);
                          navigate("/pharmacy/queue");
                        }}
                        className="w-full text-xs font-medium text-blue-600 hover:text-blue-700 py-1 px-2 rounded hover:bg-blue-50 transition"
                      >
                        View All →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                style={{ background: `linear-gradient(135deg, ${ACCENT_FROM}, ${ACCENT_TO})` }}>
                PH
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-semibold text-gray-800">Pharmacist</div>
                <div className="text-xs text-gray-400">Pharmacy Staff</div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}