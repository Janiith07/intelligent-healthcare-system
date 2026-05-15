import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";


const getLocalDateStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const DAYS   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const STATUS_COLORS = {
  Completed:    { bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200",  bar: "bg-green-400"  },
  "In Progress":{ bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200",   bar: "bg-blue-400"   },
  Pending:      { bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200",  bar: "bg-amber-400"  },
  Cancelled:    { bg: "bg-red-100",    text: "text-red-600",    border: "border-red-200",    bar: "bg-red-400"    },
};

function getInitials(name = "") {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function normalise(appt) {
  return {
    id:         appt._id,
    apptId:    appt.appointmentId || appt._id,
    patient:    appt.patientName   ?? "Unknown",
    date:       appt.date,
    time:       appt.estimatedTime ?? "—",
    session:    appt.session,
    status:     appt.status,
  };
}

// Derive display label for a holiday entry on the calendar
function getHolidayIcon(h) {
  const r = (h.reason || h.label || "").toLowerCase();
  if (r.includes("poya")) return "🌕";
  if (h.type === "holiday") return "🔴";
  return "⚠️"; // doctor unavailable
}

// ── Appointment detail modal ──────────────────────────────────────────────────
function AppointmentDetailModal({ appt, onClose, onStatusChange, onNavigate }) {
  if (!appt) return null;
  const statusStyle = STATUS_COLORS[appt.status] ?? STATUS_COLORS.Pending;
  const [loading, setLoading]         = useState(false);
  const [prescription, setPrescription] = useState(null);
  const [labRequest, setLabRequest]     = useState(null);
  const [loadingRx, setLoadingRx]       = useState(false);

  useEffect(() => {
    if (!appt.apptId) return;
    setLoadingRx(true);
    Promise.all([
      api.get(`/prescriptions?appointmentId=${appt.apptId}&limit=1`).catch(() => null),
      api.get(`/prescriptions?appointmentId=${appt.id}&limit=1`).catch(() => null),
      api.get(`/lab-requests?appointmentNumber=${appt.apptId}&limit=1`).catch(() => null),
    ]).then(async ([rx1Res, rx2Res, lrRes]) => {
      const rx = rx1Res?.data?.prescriptions?.[0] ?? rx2Res?.data?.prescriptions?.[0] ?? null;
      setPrescription(rx);
      if (rx?.labRequestRef) {
        try {
          const r = await api.get(`/lab-requests/${rx.labRequestRef}`);
          setLabRequest(r?.data?.labRequest ?? null);
        } catch {
          setLabRequest(null);
        }
      } else {
        setLabRequest(lrRes?.data?.labRequests?.[0] ?? null);
      }
    }).finally(() => setLoadingRx(false));
  }, [appt.apptId]);

  const handleStart = async () => {
    setLoading(true);
    try {
      await api.patch(`/appointments/${appt.id}/start`);
      onStatusChange(appt.id, "In Progress");
      onClose();
    } catch (err) {
      alert(err.response?.data?.message ?? "Failed to start appointment");
    } finally { setLoading(false); }
  };

  const handleContinue = () => {
    onNavigate(appt);
    onClose();
  };

  const RX_PILL = {
    pending:     "bg-amber-50 text-amber-700 border-amber-200",
    in_progress: "bg-blue-50 text-blue-700 border-blue-200",
    dispensed:   "bg-green-50 text-green-700 border-green-200",
    cancelled:   "bg-gray-100 text-gray-500 border-gray-200",
  };
  const LR_PILL = {
    pending:     "bg-amber-50 text-amber-700 border-amber-200",
    in_progress: "bg-blue-50 text-blue-700 border-blue-200",
    completed:   "bg-green-50 text-green-700 border-green-200",
  };

  const isPending = appt.status === "Pending";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0D2137, #1565C0)" }}>
          <div>
            <p className="text-white/60 text-xs">Appointment Details</p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              Appointment #{appt.apptId}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Patient card */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
              {getInitials(appt.patient)}
            </div>
            <div>
              <div className="font-bold text-gray-800">{appt.patient}</div>
              <div className="text-sm text-gray-500">{appt.session} Session</div>
            </div>
            <div className="ml-auto">
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                {appt.status}
              </span>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                label: "Date", value: appt.date,
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-blue-500">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                ),
              },
              {
                label: "Est. Time", value: appt.time,
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-blue-500">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                ),
              },
              {
                label: "Session", value: appt.session,
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-blue-500">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                ),
              },
              {
                label: "Appointment ID", value: appt.apptId,
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-blue-500">
                    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/>
                    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                  {item.icon}
                  <span className="text-xs">{item.label}</span>
                </div>
                <div className="text-sm font-semibold text-gray-800">{item.value}</div>
              </div>
            ))}
          </div>

          {/* Medical Records Section */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-blue-600">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Medical Records</span>
              {loadingRx && (
                <svg className="w-3.5 h-3.5 animate-spin text-blue-400 ml-auto" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
            </div>

            <div className="divide-y divide-gray-50">

              {/* Prescription row */}
              <div className="flex items-center justify-between px-4 py-3.5 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-blue-600">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400 mb-0.5">Prescription</div>
                    {isPending ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>
                        Pending — not yet issued
                      </span>
                    ) : loadingRx ? (
                      <div className="w-28 h-3.5 bg-gray-100 rounded animate-pulse"/>
                    ) : prescription ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-blue-700">{prescription.prescriptionId}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RX_PILL[prescription.pharmacyStatus] ?? RX_PILL.pending}`}>
                          {prescription.pharmacyStatus?.replace("_", " ")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No prescription issued</span>
                    )}
                  </div>
                </div>
                {!isPending && prescription && (
                  <a href={`/doctor/prescriptions?open=${prescription.prescriptionId}`}
                    className="flex-shrink-0 text-xs text-blue-600 font-semibold hover:underline whitespace-nowrap">
                    View →
                  </a>
                )}
              </div>

              {/* Lab Request row */}
              <div className="flex items-center justify-between px-4 py-3.5 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-teal-600">
                      <path d="M6 2v6l-4 8a2 2 0 001.8 3h12.4A2 2 0 0018 16l-4-8V2"/>
                      <line x1="6" y1="2" x2="18" y2="2"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400 mb-0.5">Lab Request</div>
                    {isPending ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>
                        Pending — not yet requested
                      </span>
                    ) : loadingRx ? (
                      <div className="w-28 h-3.5 bg-gray-100 rounded animate-pulse"/>
                    ) : labRequest ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-teal-700">{labRequest.labRequestId}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${LR_PILL[labRequest.status] ?? LR_PILL.pending}`}>
                          {labRequest.status?.replace("_", " ")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No lab tests requested</span>
                    )}
                  </div>
                </div>
                {!isPending && labRequest && (
                  <a href={`/doctor/lab-requests?open=${labRequest.labRequestId}`}
                    className="flex-shrink-0 text-xs text-teal-600 font-semibold hover:underline whitespace-nowrap">
                    View →
                  </a>
                )}
              </div>

            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {appt.status === "Pending" && (
              <button disabled={loading} onClick={handleStart}
                className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
                {loading ? "Starting…" : "Start Consultation"}
              </button>
            )}
            {appt.status === "In Progress" && (
              <button onClick={handleContinue}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold shadow-lg hover:opacity-90 transition"
                style={{ background: "linear-gradient(135deg, #0D47A1, #1976D2)" }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                </svg>
                Continue Treatment
              </button>
            )}
            <button onClick={onClose}
              className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Unavailability Manager Modal ──────────────────────────────────────────────
function UnavailabilityManagerModal({ holidays, onClose, onRefresh, initialDate }) {
  const todayStr = getLocalDateStr();
  const [list, setList]           = useState([...holidays]);
  const [newDate, setNewDate]     = useState(initialDate && initialDate >= todayStr ? initialDate : todayStr);
  const [newReason, setNewReason] = useState("");
  const [newSession, setNewSession] = useState("Both");
  const [newType, setNewType]     = useState("unavailable");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [listFilter, setListFilter] = useState("all");

  const HOLIDAY_SUGGESTIONS = [
    "Poya Day",
    "National Day",
    "Christmas Day",
    "New Year's Day",
    "Sinhala & Tamil New Year",
    "Eid al-Fitr",
    "Eid al-Adha",
    "Deepavali",
    "Good Friday",
    "Special Public Holiday",
  ];

  const UNAVAILABLE_SUGGESTIONS = [
    "Medical conference",
    "CME / Training",
    "Personal leave",
    "Sick leave",
    "Emergency",
    "Annual leave",
    "Out of station",
    "Family commitment",
    "Hospital duty elsewhere",
  ];

  const suggestions = newType === "holiday" ? HOLIDAY_SUGGESTIONS : UNAVAILABLE_SUGGESTIONS;
  const filteredSuggestions = newReason.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(newReason.toLowerCase()))
    : suggestions;

  const addEntry = async () => {
    if (!newDate)          { setError("Please select a date.");       return; }
    if (!newReason.trim()) { setError("Please enter a reason/name."); return; }
    const dup = list.find(h => h.date === newDate && (h.session === newSession || h.session === "Both" || newSession === "Both"));
    if (dup) { setError("This date/session combination is already blocked."); return; }

    setSaving(true);
    try {
      const res = await api.post("/appointments/holidays", {
        date: newDate,
        reason: newReason.trim(),
        session: newSession,
        type: newType,
      });
      const saved = res.data.holiday;
      const updated = [...list, { date: saved.date, reason: saved.reason, session: saved.session, type: saved.type }]
        .sort((a, b) => a.date.localeCompare(b.date) || a.session.localeCompare(b.session));
      setList(updated);
      onRefresh(updated); // ✅ sync parent immediately
      setNewDate(getLocalDateStr()); setNewReason(""); setNewSession("Both"); setNewType("unavailable"); setShowSuggestions(false); setError("");
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to add entry.");
    } finally { setSaving(false); }
  };

  const removeEntry = async (date, session) => {
    try {
      await api.delete(`/appointments/holidays/${date}?session=${session}`);
      const updated = list.filter(h => !(h.date === date && h.session === session));
      setList(updated);
      onRefresh(updated); // ✅ sync parent immediately
    } catch (err) {
      alert(err.response?.data?.message ?? "Failed to remove entry.");
    }
  };

  const entryIcon = (h) => {
    const r = (h.reason || "").toLowerCase();
    if (r.includes("poya")) return "🌕";
    if (h.type === "holiday") return "🔴";
    return "⚠️";
  };

  const entryBadgeColor = (session) => {
    if (session === "Both")    return "bg-red-100 text-red-700";
    if (session === "Morning") return "bg-amber-100 text-amber-700";
    return "bg-indigo-100 text-indigo-700";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0D2137, #1565C0)" }}>
          <div>
            <p className="text-white/60 text-xs uppercase tracking-wide">Doctor Schedule</p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              Manage Unavailability
            </h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Add form */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Block a Date / Session</p>

            {/* Type selector */}
            <div className="flex gap-2">
              {[
                { value: "holiday",     label: "Public / Poya Holiday" },
                { value: "unavailable", label: "Doctor Unavailable" },
              ].map(opt => (
                <button key={opt.value}
                  onClick={() => { setNewType(opt.value); setNewReason(""); setShowSuggestions(false); }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                    newType === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Date */}
            <input
              type="date" value={newDate}
              min={todayStr}
              onChange={e => { setNewDate(e.target.value); setError(""); }}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            {/* Reason */}
            <div className="relative">
              <input
                type="text"
                placeholder={newType === "holiday" ? "e.g. Poya Day, National Holiday…" : "e.g. Medical conference, Urgent matter…"}
                value={newReason}
                onChange={e => { setNewReason(e.target.value); setError(""); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <svg viewBox="0 0 20 20" fill="currentColor"
                className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {filteredSuggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={() => { setNewReason(s); setShowSuggestions(false); setError(""); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition flex items-center gap-2"
                    >
                      <span className="text-xs">{newType === "holiday" ? "🔴" : "⚠️"}</span>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Session selector */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Affected session</p>
              <div className="flex gap-2">
                {[
                  { value: "Both",    label: "Full Day" },
                  { value: "Morning", label: "Morning only" },
                  { value: "Evening", label: "Evening only" },
                ].map(opt => (
                  <button key={opt.value}
                    onClick={() => setNewSession(opt.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                      newSession === opt.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {newSession !== "Both" && (
                <p className="text-xs text-amber-600 mt-1.5">
                  Only the <strong>{newSession}</strong> session will be blocked. The other session remains bookable.
                </p>
              )}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button onClick={addEntry} disabled={saving}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
              {saving ? "Saving…" : "Block This Date / Session"}
            </button>
          </div>

          {/* List */}
          <div>
            {/* Filter tabs */}
            <div className="flex gap-2 mb-3">
              {[
                { value: "all",         label: "All" },
                { value: "holiday",     label: "🔴 Public Holidays" },
                { value: "unavailable", label: "⚠️ Unavailability" },
              ].map(f => (
                <button key={f.value} onClick={() => setListFilter(f.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    listFilter === f.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
            {(() => {
              const filtered = listFilter === "all" ? list : list.filter(h => h.type === listFilter);
              return (
            <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {listFilter === "all" ? "All Blocked Dates" : listFilter === "holiday" ? "Public Holidays" : "Doctor Unavailability"} ({filtered.length} {filtered.length === 1 ? "entry" : "entries"})
            </p>
            <div className="space-y-2">
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-xl">
                  No entries found.
                </p>
              )}
              {filtered.map((h, i) => (
                <div key={`${h.date}-${h.session}-${i}`}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{entryIcon(h)}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{h.reason || "Unavailable"}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{h.date}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${entryBadgeColor(h.session)}`}>
                          {h.session === "Both" ? "Full Day" : `${h.session} Session`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeEntry(h.date, h.session)}
                    className="text-red-400 hover:text-red-600 transition ml-3 p-1.5 rounded-lg hover:bg-red-50">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            </>
            );})()}
          </div>

          <button onClick={() => { onRefresh(list); onClose(); }}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold shadow-lg"
            style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DoctorAppointments() {
  const today    = getLocalDateStr();
  const navigate = useNavigate();

  const buildPrefillParams = (appt) =>
    new URLSearchParams({
      prefill:       "1",
      appointmentId: appt.apptId,
      patientName:   appt.patient,
    }).toString();

  const [appointments, setAppointments]     = useState([]);
  const [holidays, setHolidays]             = useState([]);
  const [loadingAppts, setLoadingAppts]     = useState(true);
  const [loadingHols, setLoadingHols]       = useState(true);
  const [error, setError]                   = useState(null);

  const [morningStart, setMorningStart] = useState("07:00");
  const [morningEnd,   setMorningEnd]   = useState("07:45");
  const [eveningStart, setEveningStart] = useState("16:30");
  const [eveningEnd,   setEveningEnd]   = useState("20:00");

  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate]             = useState(today);
  const [selectedAppt, setSelectedAppt]             = useState(null);

  const [showUnavailManager, setShowUnavailManager] = useState(false);

  const fetchAppointments = useCallback(async (date, silent = false) => {
    if (!silent) { setLoadingAppts(true); setError(null); }
    try {
      const res = await api.get(`/appointments/today?date=${date}`);
      setAppointments((res.data.appointments ?? []).map(normalise));
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load appointments.");
    } finally { setLoadingAppts(false); }
  }, []);

  const fetchHolidays = useCallback(async (silent = false) => {
    if (!silent) setLoadingHols(true);
    try {
      const res = await api.get("/appointments/holidays");
      setHolidays(res.data.holidays ?? []);
    } catch (err) {
      console.error("Failed to load holidays:", err);
    } finally { if (!silent) setLoadingHols(false); }
  }, []);

  const fetchSessionConfig = useCallback(async () => {
    try {
      const now     = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
      const [mRes, eRes] = await Promise.allSettled([
        api.get(`/appointments/session-info?date=${dateStr}&session=Morning`),
        api.get(`/appointments/session-info?date=${dateStr}&session=Evening`),
      ]);
      if (mRes.status === "fulfilled") {
        const data = mRes.value.data?.data;
        if (data?.startTime) setMorningStart(data.startTime);
        if (data?.endTime)   setMorningEnd(data.endTime);
      }
      if (eRes.status === "fulfilled") {
        const data = eRes.value.data?.data;
        if (data?.startTime) setEveningStart(data.startTime);
        if (data?.endTime)   setEveningEnd(data.endTime);
      }
    } catch (e) { /* keep defaults */ }
  }, []);

  useEffect(() => { fetchAppointments(selectedDate); }, [fetchAppointments, selectedDate]);
  useEffect(() => { fetchHolidays();      }, [fetchHolidays]);
  useEffect(() => { fetchSessionConfig(); }, [fetchSessionConfig]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchAppointments(selectedDate, true);
      fetchSessionConfig();
    }, 5_000);
    return () => clearInterval(interval);
  }, [fetchAppointments, fetchSessionConfig, selectedDate]);

  const handleStatusChange = (id, newStatus) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
  };

  const year        = currentDate.getFullYear();
  const month       = currentDate.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const formatDateStr = (d) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const getDayAppointments = (ds) => appointments.filter(a => a.date === ds);

  const currentSession = (() => {
    const toMins = (hhmm = "00:00") => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    if (now >= toMins(morningStart) && now < toMins(morningEnd)) return "Morning";
    if (now >= toMins(eveningStart) && now < toMins(eveningEnd)) return "Evening";
    if (now < toMins(morningStart)) return "Morning";
    return "Evening";
  })();

  const allDayAppts = getDayAppointments(selectedDate);
  const selectedAppts = allDayAppts.filter(a =>
    a.session === currentSession || a.status === "In Progress"
  );

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isSunday = (ds) => new Date(ds + "T00:00:00").getDay() === 0;

  const getDateHolidays = (ds) => holidays.filter(h => h.date === ds);

  const isDayFullyBlocked = (ds) =>
    isSunday(ds) || holidays.some(h => h.date === ds && h.session === "Both");

  const isSessionBlocked = (ds, session) =>
    holidays.some(h => h.date === ds && (h.session === "Both" || h.session === session));

  const todayAppts  = selectedAppts;
  const completed   = todayAppts.filter(a => a.status === "Completed").length;
  const inProgress  = todayAppts.filter(a => a.status === "In Progress").length;
  const pending     = todayAppts.filter(a => a.status === "Pending").length;
  const cancelled   = todayAppts.filter(a => a.status === "Cancelled").length;
  const totalActive = todayAppts.length - cancelled;

  const selectedDayHolidays     = getDateHolidays(selectedDate);
  const selectedFullyBlocked    = isDayFullyBlocked(selectedDate);
  const selectedMorningBlocked  = isSessionBlocked(selectedDate, "Morning");
  const selectedEveningBlocked  = isSessionBlocked(selectedDate, "Evening");

  const upcomingAppts = appointments.filter(a => a.status !== "Cancelled");

  const [scheduleFilter, setScheduleFilter] = useState("All");
  const filteredScheduleAppts = scheduleFilter === "All"
    ? upcomingAppts
    : upcomingAppts.filter(a => a.session === scheduleFilter);

  return (
  <>
      {selectedAppt && (
        <AppointmentDetailModal
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onStatusChange={handleStatusChange}
          onNavigate={(appt) => navigate(`/doctor/prescriptions?${buildPrefillParams(appt)}`)}
        />
      )}
      {showUnavailManager && (
        <UnavailabilityManagerModal
          holidays={holidays}
          initialDate={selectedDate}
          onClose={() => setShowUnavailManager(false)}
          onRefresh={(updated) => { setHolidays(updated); fetchHolidays(); }}
        />
      )}

      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>
              Appointment Schedule
            </h1>
            <p className="text-sm text-gray-400 mt-1">Manage your daily appointment sessions</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUnavailManager(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow"
              style={{ background: "linear-gradient(135deg, #0D2137, #1565C0)" }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              Manage Unavailability
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <span className="text-red-500">⚠️</span>
            <span className="text-sm text-red-700">{error}</span>
            <button onClick={() => fetchAppointments(selectedDate)} className="ml-auto text-xs text-red-600 font-semibold underline">Retry</button>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total",      value: loadingAppts ? "…" : totalActive, color: "#1565C0", bg: "#E3F2FD" },
            { label: "Completed",  value: loadingAppts ? "…" : completed,   color: "#00897B", bg: "#E0F2F1" },
            { label: "Pending",    value: loadingAppts ? "…" : pending,     color: "#7B1FA2", bg: "#F3E5F5" },
            { label: "Cancelled",  value: loadingAppts ? "…" : cancelled,   color: "#B71C1C", bg: "#FFEBEE" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-5">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </button>
              <span className="font-semibold text-gray-800 text-sm">{MONTHS[month]} {year}</span>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map(d => (
                <div key={d} className={`text-center text-xs font-semibold py-1 ${d === "Sun" ? "text-red-400" : "text-gray-400"}`}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dateStr    = formatDateStr(day);
                const dayAppts   = getDayAppointments(dateStr);
                const isSelected = selectedDate === dateStr;
                const isToday    = dateStr === today;
                const sunday     = isSunday(dateStr);
                const dayHols    = getDateHolidays(dateStr);
                const fullyBlocked = sunday || dayHols.some(h => h.session === "Both");
                const partBlocked  = !fullyBlocked && dayHols.length > 0;

                let btnClass = "relative aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-medium transition ";
                let btnStyle = {};

                if (fullyBlocked) {
                  btnClass += "cursor-not-allowed ";
                  btnClass += sunday ? "bg-red-50 text-red-300" : "bg-orange-50 text-orange-400";
                } else if (isSelected) {
                  btnClass += "text-white shadow-lg";
                  btnStyle = { background: "linear-gradient(135deg, #1565C0, #00ACC1)" };
                } else if (isToday) {
                  btnClass += "border-2 border-blue-500 text-blue-700";
                } else {
                  btnClass += "hover:bg-gray-100 text-gray-700";
                }

                let title = sunday ? "Sunday – Closed" : undefined;
                if (dayHols.length > 0) {
                  title = dayHols.map(h => `${h.reason} (${h.session === "Both" ? "Full Day" : h.session})`).join(", ");
                }

                return (
                  <button key={day}
                    onClick={() => !fullyBlocked && setSelectedDate(dateStr)}
                    className={btnClass} style={btnStyle}
                    title={title}>
                    {day}
                    {dayAppts.length > 0 && !fullyBlocked && (
                      <div className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`} />
                    )}
                    {partBlocked && (
                      <span className="absolute top-0.5 right-0.5 text-[8px]">⚠️</span>
                    )}
                    {!sunday && fullyBlocked && dayHols.length > 0 && (
                      <span className="absolute top-0.5 right-0.5 text-[8px]">
                        {getHolidayIcon(dayHols.find(h => h.session === "Both"))}
                      </span>
                    )}
                    {sunday && <span className="absolute top-0.5 right-0.5 text-[8px] text-red-300">✕</span>}
                  </button>
                );
              })}
            </div>

            {/* Availability legend */}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Session Times</p>
              {[
                { label: "Morning Session: 7:00 – 8:00 AM",  icon: "🌅" },
                { label: "Evening Session: 5:00 – 8:00 PM",  icon: "🌆" },
                { label: "Monday – Saturday",                 icon: "✅" },
                { label: "Sunday: Closed",                    icon: "❌" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{item.icon}</span><span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {loadingHols ? "Loading…" : `${holidays.length} blocked entries`}
              </span>
              <button onClick={() => setShowUnavailManager(true)} className="text-xs text-blue-600 font-semibold hover:underline">Edit →</button>
            </div>
          </div>

          {/* Appointment list for selected date */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isSunday(selectedDate)
                    ? "Sunday – Not Available"
                    : selectedFullyBlocked
                      ? `${selectedDayHolidays.find(h => h.session === "Both")?.reason || "Unavailable"} – Fully Blocked`
                      : `${selectedAppts.length} appointment${selectedAppts.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              {!isSunday(selectedDate) && !selectedFullyBlocked && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                  {currentSession === "Morning" ? "🌤️" : "🌙"} {currentSession} Session
                </span>
              )}
            </div>

            {isSunday(selectedDate) ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                <div className="text-5xl mb-3">🚫</div>
                <div className="font-semibold text-red-500 text-sm">Sunday – Clinic Closed</div>
                <div className="text-xs text-gray-400 mt-1">No appointments are accepted on Sundays.</div>
              </div>
            ) : selectedFullyBlocked ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                <div className="text-5xl mb-3">
                  {getHolidayIcon(selectedDayHolidays.find(h => h.session === "Both") || {})}
                </div>
                <div className="font-semibold text-orange-600 text-sm">
                  {selectedDayHolidays.find(h => h.session === "Both")?.reason || "Fully Unavailable"}
                </div>
                <div className="text-xs text-gray-400 mt-1">No appointments available on this day.</div>
                <button onClick={() => setShowUnavailManager(true)}
                  className="mt-3 text-xs text-blue-600 font-semibold hover:underline">
                  Edit unavailability →
                </button>
              </div>
            ) : loadingAppts ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <div className="text-3xl mb-3 animate-pulse">⏳</div>
                <div className="text-sm">Loading appointments…</div>
              </div>
            ) : selectedAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <div className="text-5xl mb-3">{currentSession === "Morning" ? "🌤️" : "🌙"}</div>
                <div className="font-medium text-sm">No {currentSession.toLowerCase()} appointments today</div>
                <div className="text-xs mt-1">No patients booked for the {currentSession.toLowerCase()} session.</div>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {selectedAppts.map(appt => {
                  const style = STATUS_COLORS[appt.status] ?? STATUS_COLORS.Pending;
                  return (
                    <div key={appt.id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => setSelectedAppt(appt)}>
                      <div className="text-sm text-gray-500 font-medium w-20 flex-shrink-0">{appt.time}</div>
                      <div className={`w-1 h-10 rounded-full flex-shrink-0 ${style.bar}`} />
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
                        {getInitials(appt.patient)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm font-semibold text-gray-800 truncate">{appt.patient}</div>
                          {currentSession === "Evening" && appt.session === "Morning" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0 whitespace-nowrap">
                              AM carry-over
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">ID: {appt.apptId} · {appt.session}</div>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full border flex-shrink-0 ${style.bg} ${style.text} ${style.border}`}>
                        {appt.status}
                      </span>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 flex-shrink-0">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Today's full schedule table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-800 text-sm">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} — Schedule
              </h3>
              <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
                {[
                  { value: "All",     label: "All" },
                  { value: "Morning", label: "🌤️  Morning" },
                  { value: "Evening", label: "🌙  Evening" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setScheduleFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      scheduleFilter === opt.value
                        ? "bg-white shadow text-gray-800"
                        : "text-gray-500 hover:text-gray-700"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => fetchAppointments(selectedDate)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
              </svg>
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            {loadingAppts ? (
              <div className="flex items-center justify-center h-24 text-gray-400 text-sm">Loading…</div>
            ) : filteredScheduleAppts.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                {scheduleFilter === "All" ? "No appointments on this date." : `No ${scheduleFilter.toLowerCase()} appointments on this date.`}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {["Appt. ID", "Patient", "Date", "Est. Time", "Session", "Status", "Actions"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredScheduleAppts.map(appt => {
                    const style = STATUS_COLORS[appt.status] ?? STATUS_COLORS.Pending;
                    return (
                      <tr key={appt.id}
                        className="hover:bg-gray-50 transition cursor-pointer"
                        onClick={() => setSelectedAppt(appt)}>
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-bold">{appt.apptId}</span>
                        </td>
                        <td className="px-5 py-3.5"><div className="font-medium text-gray-800">{appt.patient}</div></td>
                        <td className="px-5 py-3.5 text-gray-600">{appt.date}</td>
                        <td className="px-5 py-3.5 text-gray-600">{appt.time}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-gray-600">
                            {appt.session === "Morning" ? "🌤️" : "🌙"} {appt.session}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                            {appt.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedAppt(appt); }}
                            className="text-blue-600 text-xs font-semibold hover:underline flex items-center gap-1">
                            View Details →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
  </>
  );
}