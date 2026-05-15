import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";


const getLocalDateStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

// ── Helpers ────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function getDoctorName() {
  try { return JSON.parse(sessionStorage.getItem("user"))?.name || "Doctor"; }
  catch { return "Doctor"; }
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatRelativeTime(iso) {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return "Just now";
  if (diff < 120)  return "1 min ago";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return formatTime(iso);
}

// Convert "HH:MM" string → total minutes from midnight
function toMins(hhmm = "00:00") {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Format "HH:MM" → "7:00 AM" / "5:00 PM"
function fmtSessionTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Returns current time in minutes since midnight
function nowMins() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

// ── Session state machine ──────────────────────────────────────
// Returns: 'before' | 'live' | 'ended'
function getSessionPhase(startHHMM, endHHMM) {
  const now   = nowMins();
  const start = toMins(startHHMM);
  const end   = toMins(endHHMM);
  if (now < start) return "before";
  if (now < end)   return "live";
  return "ended";
}

// ── Auto-detect which tab should be active ─────────────────────
// Skips holiday sessions — if morning is a holiday, jump straight to Evening
function detectActiveSession(morningStart, morningEnd, eveningStart, morningHoliday = false, eveningHoliday = false) {
  const now = nowMins();
  // If morning is a holiday, always show Evening
  if (morningHoliday) return "Evening";
  // If evening is a holiday, always show Morning
  if (eveningHoliday) return "Morning";
  // Normal time-based logic
  if (now < toMins(morningEnd)) return "Morning";
  return "Evening";
}

// Format minutes remaining into "Xh Ym" or "Ym"
function fmtCountdown(startHHMM) {
  const diff = toMins(startHHMM) - nowMins();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Status config ──────────────────────────────────────────────
const APPT_STATUS = {
  Pending:       { pill: "bg-amber-50 text-amber-700 border border-amber-200",  dot: "bg-amber-400" },
  "In Progress": { pill: "bg-blue-50 text-blue-700 border border-blue-200",     dot: "bg-blue-500"  },
  Completed:     { pill: "bg-green-50 text-green-700 border border-green-200",  dot: "bg-green-500" },
  Cancelled:     { pill: "bg-gray-100 text-gray-500 border border-gray-200",    dot: "bg-gray-400"  },
};

const RX_STATUS = {
  pending:     { pill: "bg-orange-50 text-orange-600 border border-orange-200", label: "Pending"     },
  in_progress: { pill: "bg-blue-50 text-blue-700 border border-blue-200",       label: "In Progress" },
  dispensed:   { pill: "bg-green-50 text-green-700 border border-green-200",    label: "Dispensed"   },
};

// ── SVG icons ──────────────────────────────────────────────────
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
);
const PrescriptionIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const LabIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
    <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10m-10 0v4a2 2 0 002 2h4"/>
  </svg>
);
const PatientsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const QA_ICONS = {
  prescription: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[18px] h-[18px]">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="18" x2="12" y2="12"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
  ),
  lab: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[18px] h-[18px]">
      <path d="M6 2v6l-4 8a2 2 0 001.8 3h12.4A2 2 0 0018 16l-4-8V2"/>
      <line x1="6" y1="2" x2="18" y2="2"/>
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[18px] h-[18px]">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  patient: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[18px] h-[18px]">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
};

// ── Skeleton loaders ───────────────────────────────────────────
const SkeletonRow = () => (
  <div className="flex items-center gap-4 px-6 py-3.5 animate-pulse">
    <div className="w-14 h-4 bg-gray-100 rounded"/>
    <div className="w-9 h-9 bg-gray-100 rounded-xl"/>
    <div className="flex-1 space-y-1.5">
      <div className="w-32 h-3.5 bg-gray-100 rounded"/>
      <div className="w-24 h-3 bg-gray-100 rounded"/>
    </div>
    <div className="w-20 h-6 bg-gray-100 rounded-full"/>
    <div className="w-16 h-7 bg-gray-100 rounded-xl"/>
  </div>
);

const SkeletonCard = () => (
  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse">
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 bg-gray-100 rounded-xl"/>
      <div className="w-10 h-5 bg-gray-100 rounded-full"/>
    </div>
    <div className="w-16 h-8 bg-gray-100 rounded mb-2"/>
    <div className="w-28 h-3.5 bg-gray-100 rounded mb-1"/>
    <div className="w-20 h-3 bg-gray-100 rounded"/>
  </div>
);

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════
export default function DoctorDashboard() {
  const navigate   = useNavigate();
  const doctorName = getDoctorName();

  // ── Session config — start & end times ───────────────────────
  const [morningStart, setMorningStart] = useState("07:00");
  const [morningEnd,   setMorningEnd]   = useState("08:00");
  const [eveningStart, setEveningStart] = useState("17:00");
  const [eveningEnd,   setEveningEnd]   = useState("20:00");

  // ── Active session tab ─────────────────────────────────────
  const [activeSession, setActiveSession] = useState(null);

  // ── Holiday flags for today's sessions ───────────────────
  const [morningHoliday, setMorningHoliday] = useState(false);
  const [eveningHoliday, setEveningHoliday] = useState(false);

  // ── Clock tick — re-evaluate session phase every minute ───
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-switch tab when session changes ──────────────────
  // Runs on every tick and whenever config loads.
  // Only auto-switches if doctor hasn't manually overridden.
  const [manualTabOverride, setManualTabOverride] = useState(false);
  useEffect(() => {
    if (!morningStart || !morningEnd || !eveningStart) return;
    if (manualTabOverride) return;
    const suggested = detectActiveSession(morningStart, morningEnd, eveningStart, morningHoliday, eveningHoliday);
    setActiveSession(suggested);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, morningStart, morningEnd, eveningStart, morningHoliday, eveningHoliday]);

  // Manual tab click — doctor picks a tab explicitly
  const handleTabClick = (key) => {
    setManualTabOverride(true);
    setActiveSession(key);
    // Release the override after 10 min so auto-switch resumes
    setTimeout(() => setManualTabOverride(false), 10 * 60 * 1000);
  };

  // ── Data state ────────────────────────────────────────────
  const [appointments, setAppointments]     = useState([]);
  const [apptStats, setApptStats]           = useState({ total: 0, pending: 0, inProgress: 0, completed: 0, remaining: 0 });
  const [recentRx, setRecentRx]             = useState([]);
  const [labPending, setLabPending]         = useState(0);
  const [labAlerts, setLabAlerts]           = useState([]);
  const [loadingAlerts, setLoadingAlerts]   = useState(true);
  const [monthlyRxCount, setMonthlyRxCount] = useState(0);
  const [loadingAppts, setLoadingAppts]     = useState(true);
  const [loadingRx, setLoadingRx]           = useState(true);
  const [startingId, setStartingId]             = useState(null);
  const [toast, setToast]                       = useState(null);
  const [earlyStarting, setEarlyStarting]       = useState(false);
  const [sessionConfigLoaded, setSessionConfigLoaded] = useState(false);

  // ── Toast ─────────────────────────────────────────────────
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch session config ──────────────────────────────────
  const loadSessionConfig = useCallback(async (silent = false) => {
    try {
      const today = getLocalDateStr();

      // Use dedicated holidays endpoint — session-info returns 400 for
      // multiple reasons (session ended, Sunday, etc.), not just holidays.
      const [mRes, eRes, holRes] = await Promise.allSettled([
        api.get(`/appointments/session-info?date=${today}&session=Morning`),
        api.get(`/appointments/session-info?date=${today}&session=Evening`),
        api.get("/appointments/holidays"),
      ]);

      // ── Detect holidays from the holidays list, not from session-info errors ──
      const holidays = holRes.status === "fulfilled" ? (holRes.value.data.holidays ?? []) : [];
      const todayHols = holidays.filter(h => h.date === today);
      const mIsHoliday = todayHols.some(h => h.session === "Both" || h.session === "Morning");
      const eIsHoliday = todayHols.some(h => h.session === "Both" || h.session === "Evening");
      setMorningHoliday(mIsHoliday);
      setEveningHoliday(eIsHoliday);

      const mStart = mRes.status === "fulfilled" ? mRes.value.data?.data?.startTime || "07:00" : "07:00";
      const eStart = eRes.status === "fulfilled" ? eRes.value.data?.data?.startTime || "17:00" : "17:00";
      setMorningStart(mStart);
      setEveningStart(eStart);
      setSessionConfigLoaded(true);
    } catch { /* use defaults */ }
  }, []);

  // ── Fetch today's appointments ────────────────────────────
  const loadAppointments = useCallback(async (silent = false) => {
    try {
      const res = await api.get(`/appointments/today?date=${getLocalDateStr()}`);
      const appts = res.data.appointments || [];
      setAppointments(appts);

      // Compute stats from the list
      const total      = appts.length;
      const pending    = appts.filter(a => a.status === "Pending").length;
      const inProgress = appts.filter(a => a.status === "In Progress").length;
      const completed  = appts.filter(a => a.status === "Completed").length;
      const remaining  = pending + inProgress;
      setApptStats({ total, pending, inProgress, completed, remaining });
    } catch {
      showToast("Failed to load today's schedule", "error");
    } finally {
      if (!silent) setLoadingAppts(false);
    }
  }, []);

  // ── Fetch recent prescriptions ────────────────────────────
  const loadRecentRx = useCallback(async (silent = false) => {
    try {
      const res = await api.get("/prescriptions?recent=true&limit=8");
      setRecentRx(res.data.prescriptions || []);
    } catch { /* silently ignore */ }
    finally { if (!silent) setLoadingRx(false); }
  }, []);

  // ── Fetch lab pending count ───────────────────────────────
  const loadLabStats = useCallback(async () => {
    try {
      const res = await api.get("/lab-requests?status=pending");
      setLabPending(res.data.count || 0);
    } catch { /* keep 0 */ }
  }, []);

  // ── Fetch lab alerts — completed results in last 30 mins ─────
  const loadLabAlerts = useCallback(async (silent = false) => {
    if (!silent) setLoadingAlerts(true);
    try {
      const res = await api.get("/lab-results?status=completed&limit=50");
      const results = res.data.results || [];
      const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
      const recent = results.filter(r =>
        new Date(r.completedAt).getTime() > thirtyMinsAgo
      );
      setLabAlerts(
        recent.map(r => ({
          ...r,
          alertType: r.results?.parameters?.some(p =>
            ["High", "Low", "Positive", "Reactive"].includes(p.flag)
          ) ? "abnormal" : "ready",
        }))
      );
    } catch { /* keep empty */ }
    finally { if (!silent) setLoadingAlerts(false); }
  }, []);

  // ── Fetch this-month prescription count ───────────────────
  const loadMonthlyRx = useCallback(async () => {
    try {
      const res = await api.get("/prescriptions?limit=200");
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const count = (res.data.prescriptions || []).filter(
        rx => new Date(rx.createdAt) >= monthStart
      ).length;
      setMonthlyRxCount(count);
    } catch { /* keep 0 */ }
  }, []);

  // ── Initial load ─────────────────────────────────────────
  useEffect(() => {
    loadSessionConfig();
    loadAppointments();
    loadRecentRx();
    loadLabStats();
    loadLabAlerts();
    loadMonthlyRx();
  }, [loadSessionConfig, loadAppointments, loadRecentRx, loadLabStats, loadLabAlerts, loadMonthlyRx]);

  // ── Auto-refresh every 30 seconds ─────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      loadAppointments(true);
      loadRecentRx(true);
      loadLabStats(true);
      loadLabAlerts(true);
      loadMonthlyRx(true);
      loadSessionConfig(true);
    }, 5_000);
    return () => clearInterval(interval);
  }, [loadAppointments, loadRecentRx, loadLabStats, loadLabAlerts, loadMonthlyRx]);

  // ── Filtered list by selected session tab ─────────────────
  // Evening tab also surfaces any Morning Pending patients who
  // weren't seen — doctor attends to them without any DB change.
  const sessionAppointments = activeSession === "Evening"
    ? appointments.filter(a =>
        a.session === "Evening" ||
        (a.session === "Morning" && a.status === "Pending")
      )
    : appointments.filter(a => a.session === "Morning");

  // Per-session counts for tab badges
  const morningAppts     = appointments.filter(a => a.session === "Morning");
  const eveningAppts     = appointments.filter(a => a.session === "Evening");
  const morningRemaining = morningAppts.filter(a => a.status === "Pending" || a.status === "In Progress").length;
  const eveningRemaining = eveningAppts.filter(a => a.status === "Pending" || a.status === "In Progress").length;

  // ── Session phases (re-computed on every tick) ─────────────
  const morningPhase = getSessionPhase(morningStart, morningEnd);   // 'before' | 'live' | 'ended'
  const eveningPhase = getSessionPhase(eveningStart, eveningEnd);

  // Countdown until a session starts
  const morningCountdown = morningPhase === "before" ? fmtCountdown(morningStart) : null;
  const eveningCountdown = eveningPhase === "before" ? fmtCountdown(eveningStart) : null;

  // ── Build prefill URL params from an appointment ──────────
  const buildPrefillParams = (appt) =>
    new URLSearchParams({
      prefill:       "1",
      appointmentId: appt.appointmentId,
      patientName:   appt.patientName,
      patientId:     appt.patientId || "",

    }).toString();

  // ── START: Pending → In Progress, then open Rx form ───────
  const handleStart = async (appt) => {
    setStartingId(appt._id);
    try {
      const res     = await api.patch(`/appointments/${appt._id}/start`);
      const updated = res.data.appointment;
      setAppointments(prev => prev.map(a => a._id === updated._id ? updated : a));
      setApptStats(prev => ({
        ...prev,
        pending:    Math.max(0, prev.pending - 1),
        inProgress: prev.inProgress + 1,
      }));
      navigate(`/doctor/prescriptions?${buildPrefillParams(updated)}`);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to start appointment", "error");
    } finally {
      setStartingId(null);
    }
  };

  // ── CONTINUE: In Progress → reopen Rx form ────────────────
  const handleContinue = (appt) => {
    navigate(`/doctor/prescriptions?${buildPrefillParams(appt)}`);
  };

  // ── EARLY START ────────────────────────────────────────────
  // Updates local state immediately (instant UI flip before→live)
  // AND persists to backend so the 5-sec polling interval doesn't
  // overwrite local state with the old time and revert the phase.
  const handleEarlyStart = async () => {
    const now  = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const field = activeSession === "Morning" ? "morningSessionStart" : "eveningSessionStart";
    if (activeSession === "Morning") setMorningStart(hhmm);
    else setEveningStart(hhmm);
    setEarlyStarting(true);
    try {
      await api.patch("/appointments/config", { [field]: hhmm });
      showToast(`${activeSession} session started early at ${fmtSessionTime(hhmm)}`, "success");
    } catch {
      showToast("Started locally — could not save to server", "success");
    } finally {
      setEarlyStarting(false);
    }
  };

  // ── Stat cards ────────────────────────────────────────────
  const STAT_CARDS = [
    {
      label: "Today's Appointments",
      value: loadingAppts ? "—" : apptStats.total,
      sub:   loadingAppts ? "Loading…" : `${apptStats.remaining} remaining`,
      icon: <CalendarIcon />,
      color: "#1565C0", bg: "#E3F2FD",
      trend: `+${apptStats.completed || 0}`,
      trendUp: (apptStats.completed || 0) > 0,
    },
    {
      label: "Prescriptions Issued",
      value: monthlyRxCount || "—",
      sub:   "This month",
      icon: <PrescriptionIcon />,
      color: "#00897B", bg: "#E0F2F1",
      trend: `+${recentRx.length}`,
      trendUp: recentRx.length > 0,
    },
    {
      label: "Lab Requests",
      value: labPending || "—",
      sub:   `${labPending} pending results`,
      icon: <LabIcon />,
      color: "#1565C0", bg: "#E3F2FD",
      trend: `${labPending || 0}`,
      trendUp: false,
    },
    {
      label: "Patients Seen",
      value: loadingAppts ? "—" : apptStats.completed,
      sub:   "Today",
      icon: <PatientsIcon />,
      color: "#E65100", bg: "#FFF3E0",
      trend: `+${apptStats.completed || 0}`,
      trendUp: (apptStats.completed || 0) > 0,
    },
  ];

  // ── Session tab definitions ───────────────────────────────
  const SESSION_TABS = [
    {
      key:       "Morning",
      label:     "Morning Session",
      timeRange: `${fmtSessionTime(morningStart)} – ${fmtSessionTime(morningEnd)}`,
      phase:     morningHoliday ? "holiday" : morningPhase,
      countdown: morningCountdown,
      remaining: morningRemaining,
      count:     morningAppts.length,
      sunIcon:   true,
      isHoliday: morningHoliday,
    },
    {
      key:       "Evening",
      label:     "Evening Session",
      timeRange: `${fmtSessionTime(eveningStart)} – ${fmtSessionTime(eveningEnd)}`,
      phase:     eveningHoliday ? "holiday" : eveningPhase,
      countdown: eveningCountdown,
      remaining: eveningRemaining,
      count:     eveningAppts.length,
      sunIcon:   false,
      isHoliday: eveningHoliday,
    },
  ];

  // Phase label config
  const PHASE_BADGE = {
    before:  { text: "Upcoming",  cls: "bg-amber-50 text-amber-600 border border-amber-200"  },
    live:    { text: "Live Now",  cls: "bg-green-50 text-green-700 border border-green-200"  },
    ended:   { text: "Ended",     cls: "bg-gray-100 text-gray-500 border border-gray-200"    },
    holiday: { text: "Holiday",   cls: "bg-red-50 text-red-500 border border-red-200"         },
  };

  // ── Derive the active session's phase for the start button ─
  const activePhase = activeSession === "Morning" ? morningPhase : eveningPhase;
  const activeCountdown = activeSession === "Morning" ? morningCountdown : eveningCountdown;
  const activeStart  = activeSession === "Morning" ? morningStart : eveningStart;

  return (
  <>

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-xl border shadow-lg text-sm font-medium transition-all ${
          toast.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.type === "success" ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      <div className="p-6 space-y-6">

        {/* ── Welcome Banner ──────────────────────────────── */}
        <div
          className="rounded-2xl p-6 flex items-center justify-between overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, #0D2137 0%, #1565C0 60%, #00ACC1 100%)" }}
        >
          <div className="absolute right-0 top-0 bottom-0 w-64 opacity-10 pointer-events-none">
            <svg viewBox="0 0 200 200" fill="white">
              <circle cx="150" cy="100" r="80"/>
              <circle cx="50" cy="50" r="50"/>
            </svg>
          </div>
          <div className="relative">
            <p className="text-white/70 text-sm">{getGreeting()},</p>
            <h2 className="text-white font-bold text-2xl mt-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>
              Dr. {doctorName} 👋
            </h2>
            <p className="text-white/60 text-sm mt-1.5">
              {loadingAppts ? (
                <span className="animate-pulse">Loading schedule…</span>
              ) : (
                <>
                  You have{" "}
                  <span className="text-cyan-300 font-bold">
                    {apptStats.remaining} appointment{apptStats.remaining !== 1 ? "s" : ""}
                  </span>{" "}
                  remaining today
                  {labPending > 0 && (
                    <span className="ml-2 text-white/60">· {labPending} pending lab results</span>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="hidden md:flex gap-3 relative">
            <a href="/doctor/appointments"
              className="px-5 py-2.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl text-white text-sm font-medium hover:bg-white/25 transition">
              View Schedule
            </a>
            <a href="/doctor/prescriptions?prefill=1"
              className="px-5 py-2.5 bg-white text-blue-800 rounded-xl text-sm font-semibold hover:bg-blue-50 transition">
              New Prescription
            </a>
          </div>
        </div>

        {/* ── Stat Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingAppts
            ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
            : STAT_CARDS.map((card) => (
              <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 rounded-xl" style={{ background: card.bg, color: card.color }}>
                    {card.icon}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    card.trendUp ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                  }`}>
                    {card.trend}
                  </span>
                </div>
                <div className="font-bold" style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.8rem", color: "#0D2137" }}>
                  {card.value}
                </div>
                <div className="text-gray-500 text-sm mt-0.5">{card.label}</div>
                <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
              </div>
            ))
          }
        </div>

        {/* ── Main Grid ──────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Today's Schedule (2 cols) ──────────────── */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Card header + session tabs */}
            <div className="px-6 pt-4 border-b border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">Today's Schedule</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                </div>
                <a href="/doctor/appointments" className="text-sm text-blue-600 font-medium hover:underline mt-0.5">
                  View All
                </a>
              </div>

              {/* ── Session Tabs ─────────────────────────── */}
              <div className="flex gap-1">
                {SESSION_TABS.map((tab) => {
                  const isActive = activeSession === tab.key;
                  const badge    = PHASE_BADGE[tab.phase];

                  return (
                    <button
                      key={tab.key}
                      onClick={() => handleTabClick(tab.key)}
                      className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all border-b-2 ${
                        isActive
                          ? "border-blue-600 text-blue-700 bg-blue-50/50"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {/* Sun / Moon icon */}
                      {tab.sunIcon ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                          className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-amber-500" : "text-gray-400"}`}>
                          <circle cx="12" cy="12" r="4"/>
                          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                          className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-indigo-500" : "text-gray-400"}`}>
                          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                        </svg>
                      )}

                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          {tab.label}
                          {/* Phase badge — shown on active tab */}
                          {isActive && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
                              {tab.phase === "live" && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />
                              )}
                              {badge.text}
                            </span>
                          )}
                        </div>
                        <div className={`text-xs font-normal leading-none mt-0.5 ${isActive ? "text-blue-500" : "text-gray-400"}`}>
                          {tab.timeRange}
                        </div>
                      </div>

                      {/* Remaining count badge */}
                      {tab.remaining > 0 && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ml-1 ${
                          isActive ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                        }`}>
                          {tab.remaining}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Session phase banner (before / ended) ────── */}
            {/* sessionConfigLoaded guard prevents the banner flashing on refresh
                before the real session times are fetched from the backend */}
            {sessionConfigLoaded && activePhase === "before" && (
              <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 border-b border-amber-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-amber-500 flex-shrink-0">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="text-xs text-amber-700 font-medium flex-1">
                  {activeSession} session starts at <strong>{fmtSessionTime(activeStart)}</strong>
                  {activeCountdown && <> — starts in <strong>{activeCountdown}</strong></>}
                </span>
                <button
                  onClick={handleEarlyStart}
                  disabled={earlyStarting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition disabled:opacity-60 flex-shrink-0 shadow-sm"
                >
                  {earlyStarting ? (
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
                    </svg>
                  )}
                  {earlyStarting ? "Starting…" : "Start Early"}
                </button>
              </div>
            )}

            {activePhase === "ended" && (() => {
              const activeSessionRemaining = activeSession === "Morning" ? morningRemaining : eveningRemaining;
              return (
                <div className={`flex items-center gap-3 px-6 py-3 border-b ${
                  activeSessionRemaining > 0
                    ? "bg-amber-50 border-amber-100"
                    : "bg-gray-50 border-gray-100"
                }`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                    className={`w-4 h-4 flex-shrink-0 ${activeSessionRemaining > 0 ? "text-amber-500" : "text-gray-400"}`}>
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span className={`text-xs font-medium ${activeSessionRemaining > 0 ? "text-amber-700" : "text-gray-500"}`}>
                    {activeSession} session ended at <strong>{fmtSessionTime(activeSession === "Morning" ? morningEnd : eveningEnd)}</strong>
                    {activeSessionRemaining > 0
                      ? <> — <strong>{activeSessionRemaining} patient{activeSessionRemaining !== 1 ? "s" : ""} still in queue</strong>. Continuing until queue is clear.</>
                      : ". All patients seen."}
                  </span>
                </div>
              );
            })()}

            {/* Appointments list */}
            {loadingAppts ? (
              <div className="divide-y divide-gray-50">
                {Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : sessionAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3 text-2xl">
                  {activeSession === "Morning" ? "🌤️" : "🌙"}
                </div>
                <p className="text-gray-500 font-medium">
                  No {activeSession?.toLowerCase()} appointments today
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {activeSession === "Morning"
                    ? `Morning session: ${fmtSessionTime(morningStart)} – ${fmtSessionTime(morningEnd)}`
                    : `Evening session: ${fmtSessionTime(eveningStart)} – ${fmtSessionTime(eveningEnd)}`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">

                {/* Mini summary strip */}
                <div className="flex items-center gap-5 px-6 py-2 bg-gray-50/60 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>
                    {sessionAppointments.filter(a => a.status === "Pending").length} Pending
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block"/>
                    {sessionAppointments.filter(a => a.status === "In Progress").length} In Progress
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
                    {sessionAppointments.filter(a => a.status === "Completed").length} Completed
                  </span>
                </div>

                {sessionAppointments.map((appt) => {
                  const statusStyle  = APPT_STATUS[appt.status] || APPT_STATUS.Pending;
                  const isStarting   = startingId === appt._id;
                  const isInProgress = appt.status === "In Progress";

                  // Lock Start only while session hasn't started yet.
                  // Once live or past end time, always allow — queue
                  // naturally continues until the last patient is seen.
                  const sessionLocked = activePhase === "before";
                  const lockReason    = activePhase === "before"
                    ? `Session starts at ${fmtSessionTime(activeStart)}${activeCountdown ? ` (in ${activeCountdown})` : ""}`
                    : null;

                  return (
                    <div
                      key={appt._id}
                      className={`flex items-center gap-3 px-6 py-3.5 transition ${
                        isInProgress
                          ? "bg-blue-50/30 border-l-2 border-l-blue-400 hover:bg-blue-50/50"
                          : "hover:bg-gray-50/70"
                      }`}
                    >
                      {/* Estimated time */}
                      <div className="text-sm font-medium text-gray-500 w-14 flex-shrink-0 tabular-nums">
                        {appt.estimatedTime || "—"}
                      </div>

                      {/* Appointment ID badge */}
                      <div className={`px-2 py-1 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 border font-mono ${
                        isInProgress
                          ? "bg-blue-100 text-blue-700 border-blue-200"
                          : "bg-blue-50 text-blue-700 border-blue-100"
                      }`}>
                        {appt.appointmentId?.split("-").pop() || "—"}
                      </div>

                      {/* Patient info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm font-semibold text-gray-800 truncate">{appt.patientName}</div>
                          {activeSession === "Evening" && appt.session === "Morning" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0 whitespace-nowrap">
                              AM carry-over
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                          {appt.patientId && (
                            <span className="font-mono">{appt.patientId}</span>
                          )}
                          {appt.patientId && <span className="text-gray-200">·</span>}
                          <span className="font-mono truncate">{appt.appointmentId}</span>
                        </div>
                      </div>

                      {/* Status pill */}
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${statusStyle.pill}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                          isInProgress ? `${statusStyle.dot} animate-pulse` : statusStyle.dot
                        }`}/>
                        {appt.status}
                      </span>

                      {/* ── Action button ──────────────────────── */}

                      {/* START — Pending only */}
                      {appt.status === "Pending" && (
                        sessionLocked ? (
                          // Locked button with tooltip
                          <div className="relative group flex-shrink-0">
                            <button
                              disabled
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                              </svg>
                              {activePhase === "before" ? "Not Yet" : "Ended"}
                            </button>
                            {/* Tooltip */}
                            <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                              {lockReason}
                              <div className="absolute top-full right-3 -mt-1 border-4 border-transparent border-t-gray-800" />
                            </div>
                          </div>
                        ) : (
                          // Active start button
                          <button
                            onClick={() => handleStart(appt)}
                            disabled={isStarting || startingId !== null}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white flex-shrink-0 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                            style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}
                          >
                            {isStarting ? (
                              <>
                                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                                Starting…
                              </>
                            ) : (
                              <>
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
                                </svg>
                                Start
                              </>
                            )}
                          </button>
                        )
                      )}

                      {/* CONTINUE — In Progress (always available regardless of session time) */}
                      {isInProgress && (
                        <button
                          onClick={() => handleContinue(appt)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white flex-shrink-0 transition shadow-sm hover:opacity-90"
                          style={{ background: "linear-gradient(135deg, #0D47A1, #1976D2)" }}
                          title="Reopen prescription form for this patient"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                          </svg>
                          Continue
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right sidebar ──────────────────────────── */}
          <div className="space-y-5">

            {/* ── Recent Prescriptions ─────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Recent Prescriptions</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Issued in last 30 minutes</p>
                </div>
                <a href="/doctor/prescriptions" className="text-xs text-blue-600 font-medium hover:underline flex-shrink-0">
                  View All
                </a>
              </div>

              {loadingRx ? (
                <div className="divide-y divide-gray-50">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={i} className="px-5 py-3.5 animate-pulse space-y-2">
                      <div className="flex justify-between">
                        <div className="w-28 h-3.5 bg-gray-100 rounded"/>
                        <div className="w-16 h-5 bg-gray-100 rounded-full"/>
                      </div>
                      <div className="w-20 h-3 bg-gray-100 rounded"/>
                      <div className="w-32 h-3 bg-gray-100 rounded"/>
                    </div>
                  ))}
                </div>
              ) : recentRx.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-5 text-center">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-2">
                    <PrescriptionIcon />
                  </div>
                  <p className="text-gray-400 text-xs">No prescriptions in the last 30 min</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentRx.map((rx) => {
                    const rxSt = RX_STATUS[rx.pharmacyStatus] || RX_STATUS.pending;
                    return (
                      <div key={rx._id} className="px-5 py-3 hover:bg-gray-50 transition cursor-pointer">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-800 truncate mr-2">{rx.patientName}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 border ${rxSt.pill}`}>
                            {rxSt.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                          {rx.patientId && (
                            <span className="font-mono bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                              {rx.patientId}
                            </span>
                          )}
                          {rx.appointmentId && (
                            <span className="font-mono bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded text-blue-600">
                              {rx.appointmentId}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <button
                            onClick={() => navigate(`/doctor/prescriptions?open=${rx.prescriptionId}`)}
                            className="text-xs font-mono text-blue-500 hover:text-blue-700 hover:underline transition text-left"
                            title="View this prescription"
                          >
                            {rx.prescriptionId}
                          </button>
                          <span className="text-xs text-gray-400">{formatRelativeTime(rx.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Quick Actions ────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 text-sm mb-4">Quick Actions</h3>
              <div className="space-y-1.5">
                {[
                  { label: "Issue Prescription", href: "/doctor/prescriptions?prefill=1", color: "#1565C0", bg: "#E3F2FD", icon: QA_ICONS.prescription },
                  { label: "Request Lab Test",    href: "/doctor/lab-requests?new=1",       color: "#7B1FA2", bg: "#F3E5F5", icon: QA_ICONS.lab },
                  { label: "View Lab Results",    href: "/doctor/lab-results",  color: "#00897B", bg: "#E0F2F1", icon: QA_ICONS.chart },
                  { label: "Patient History",     href: "/doctor/patients",      color: "#E65100", bg: "#FFF3E0", icon: QA_ICONS.patient },
                ].map((action) => (
                  <a key={action.label} href={action.href}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: action.bg, color: action.color }}>
                      {action.icon}
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 flex-1">
                      {action.label}
                    </span>
                    <svg viewBox="0 0 20 20" fill="currentColor"
                      className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-transform group-hover:translate-x-0.5">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* ── Lab Alerts ───────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800 text-sm">Lab Alerts</h3>
                    {labAlerts.filter(a => a.alertType === "abnormal").length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
                        {labAlerts.filter(a => a.alertType === "abnormal").length}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Completed in last 30 minutes</p>
                </div>
                <a href="/doctor/lab-results" className="text-xs text-blue-600 font-medium hover:underline flex-shrink-0">
                  View All
                </a>
              </div>

              {loadingAlerts ? (
                <div className="divide-y divide-gray-50">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={i} className="px-5 py-3.5 animate-pulse space-y-1.5">
                      <div className="w-36 h-3.5 bg-gray-100 rounded"/>
                      <div className="w-24 h-3 bg-gray-100 rounded"/>
                      <div className="w-28 h-3 bg-gray-100 rounded"/>
                    </div>
                  ))}
                </div>
              ) : labAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-5 text-center">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-2">
                    <LabIcon />
                  </div>
                  <p className="text-gray-500 text-xs font-medium">No alerts</p>
                  <p className="text-gray-400 text-xs mt-0.5">No results completed in the last 30 min</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {labAlerts.map((alert) => {
                    const isAbnormal = alert.alertType === "abnormal";
                    const abnormalParams = alert.results?.parameters?.filter(p =>
                      ["High", "Low", "Positive", "Reactive"].includes(p.flag)
                    ) || [];
                    const patientName = alert.patientName || "Unknown Patient";
                    const completedAt = alert.completedAt
                      ? new Date(alert.completedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                      : "—";

                    return (
                      <div
                        key={alert._id}
                        className={`px-5 py-3.5 hover:bg-gray-50 transition cursor-pointer border-l-2 ${
                          isAbnormal ? "border-l-red-400" : "border-l-green-400"
                        }`}
                        onClick={() => navigate(`/doctor/lab-results?open=${alert.testId}`)}
                      >
                        {/* Top row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-base flex-shrink-0">{isAbnormal ? "⚠️" : "🧪"}</span>
                            <span className="text-xs font-semibold text-gray-800 truncate">{patientName}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 border ${
                            isAbnormal
                              ? "bg-red-50 text-red-600 border-red-200"
                              : "bg-green-50 text-green-700 border-green-200"
                          }`}>
                            {isAbnormal ? "Abnormal" : "Ready"}
                          </span>
                        </div>

                        {/* Test info */}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-blue-600 font-mono">{alert.testId}</span>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-500">{alert.testName}</span>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400">{completedAt}</span>
                        </div>

                        {/* Abnormal flags */}
                        {isAbnormal && abnormalParams.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {abnormalParams.slice(0, 3).map((p, i) => (
                              <span key={i} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                ["High", "Positive", "Reactive"].includes(p.flag)
                                  ? "bg-red-50 text-red-600 border-red-200"
                                  : "bg-blue-50 text-blue-600 border-blue-200"
                              }`}>
                                {p.name}: {p.value} {p.unit} ↑
                              </span>
                            ))}
                            {abnormalParams.length > 3 && (
                              <span className="text-[10px] text-gray-400">+{abnormalParams.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
  </>
  );
}