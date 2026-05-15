import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PatientLayout from "../../components/PatientLayout";
import api from "../../services/api";

// ── Helpers ────────────────────────────────────────────────
function calculateAge(birthday) {
  if (!birthday) return null;
  const today = new Date();
  const birth = new Date(birthday);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getInitials(name) {
  if (!name) return "P";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Download PDF with auth token ───────────────────────────
const downloadPDF = async (appointmentId, filename) => {
  try {
    const response = await api.get(`/appointments/${appointmentId}/pdf`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    alert("Could not download PDF. Please try again.");
  }
};

// ── Status style config ────────────────────────────────────
const STATUS_CONFIG = {
  Pending:   { bg: "bg-blue-100",  text: "text-blue-700",  border: "border-blue-200"  },
  Completed: { bg: "bg-gray-100",  text: "text-gray-600",  border: "border-gray-200"  },
  Cancelled: { bg: "bg-red-100",   text: "text-red-600",   border: "border-red-200"   },
};

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════
export default function PatientDashboard() {
  const navigate = useNavigate();

  const [user, setUser]                   = useState(null);
  const [appointments, setAppointments]   = useState([]);
  const [loadingUser, setLoadingUser]     = useState(true);
  const [loadingAppts, setLoadingAppts]   = useState(true);
  const [cancelId, setCancelId]           = useState(null);
  const [cancelling, setCancelling]       = useState(false);

  // ── Fetch user profile ─────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Show stored user instantly while fetching fresh data
        const stored = localStorage.getItem("user");
        if (stored) setUser(JSON.parse(stored));

        const res = await api.get("/auth/me");
        if (res.data.success) {
          setUser(res.data.user);
          localStorage.setItem("user", JSON.stringify(res.data.user));
        }
      } catch (err) {
        console.error("Failed to fetch user", err);
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUser();
  }, []);

  // ── Fetch appointments ─────────────────────────────────
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await api.get("/appointments/my");
        setAppointments(res.data.appointments || []);
      } catch (err) {
        console.error("Failed to fetch appointments", err);
      } finally {
        setLoadingAppts(false);
      }
    };
    fetchAppointments();
  }, []);

  // ── Cancel appointment ─────────────────────────────────
  const handleCancel = async (id) => {
    setCancelling(true);
    try {
      await api.patch(`/appointments/${id}/cancel`);
      setAppointments((prev) =>
        prev.map((a) => a._id === id ? { ...a, status: "Cancelled" } : a)
      );
      setCancelId(null);
    } catch (err) {
      alert(err.response?.data?.message || "Could not cancel appointment.");
    } finally {
      setCancelling(false);
    }
  };

  // ── Derived values ─────────────────────────────────────
  const age        = calculateAge(user?.patientDetails?.birthday);
  const initials   = getInitials(user?.name);
  const bloodGroup = user?.patientDetails?.bloodGroup;
  const allergies  = user?.patientDetails?.allergies || [];
  const conditions = user?.patientDetails?.chronicConditions;

  const pendingAppointments   = appointments.filter((a) => a.status === "Pending");
  const completedAppointments = appointments.filter((a) => a.status === "Completed");
  const upcomingThree         = pendingAppointments.slice(0, 3);
  // Show only next 3 pending appointments on dashboard

  const nextAppointment = pendingAppointments[0] || null;
  // The first pending appointment sorted by createdAt desc is the most recent booking

  // ── Loading state ──────────────────────────────────────
  if (loadingUser) {
    return (
      <PatientLayout activePage="My Dashboard">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 text-sm">Loading dashboard...</p>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout activePage="My Dashboard">
      <div className="p-6 space-y-6">

        {/* ══════════════════════════════════════════════
            WELCOME BANNER — real user data
        ══════════════════════════════════════════════ */}
        <div
          className="rounded-2xl p-6 flex flex-col md:flex-row md:items-center
                     justify-between gap-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0D2137 0%, #1565C0 60%, #00ACC1 100%)" }}
        >
          {/* Decorative circles */}
          <div className="absolute right-0 top-0 bottom-0 w-48 opacity-10">
            <svg viewBox="0 0 200 200" fill="white">
              <circle cx="150" cy="100" r="90" />
              <circle cx="40" cy="40" r="50" />
            </svg>
          </div>

          {/* Avatar + name + badges */}
          <div className="relative flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center
                         text-xl font-bold text-white flex-shrink-0 border-4 border-white/20"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              {initials}
            </div>
            <div>
              <p className="text-white/70 text-sm">Welcome back 👋</p>
              <h2 style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 700, fontSize: "1.5rem", color: "white"
              }}>
                {user?.name || "Patient"}
              </h2>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {[
                  { label: "ID",           val: user?.userId },
                  { label: "Blood Group",  val: bloodGroup },
                  { label: "Age",          val: age ? `${age} yrs` : null },
                ].filter((i) => i.val).map((item) => (
                  <div key={item.label}
                    className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
                    <span className="text-white/50 text-xs">{item.label}:</span>
                    <span className="text-white text-xs font-semibold">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="relative flex gap-3 flex-shrink-0">
            <button
              onClick={() => navigate("/patient/appointments")}
              className="px-5 py-2.5 bg-white text-blue-800 rounded-xl text-sm
                         font-semibold hover:bg-blue-50 transition shadow"
            >
              📅 Book Appointment
            </button>
            <button
              onClick={() => navigate("/patient/profile")}
              className="px-5 py-2.5 bg-white/10 border border-white/20 text-white
                         rounded-xl text-sm font-medium hover:bg-white/20 transition"
            >
              My Profile
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            STAT CARDS — real counts from API
        ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Upcoming Appointments",
              value: loadingAppts ? "—" : pendingAppointments.length,
              icon: "📅", color: "#1565C0", bg: "#E3F2FD",
              onClick: () => navigate("/patient/appointments"),
            },
            {
              label: "Completed Visits",
              value: loadingAppts ? "—" : completedAppointments.length,
              icon: "✅", color: "#00897B", bg: "#E0F2F1",
              onClick: () => navigate("/patient/appointments"),
            },
            {
              label: "Known Allergies",
              value: allergies.length || 0,
              icon: "⚠️", color: "#7B1FA2", bg: "#F3E5F5",
              onClick: () => navigate("/patient/profile"),
            },
            {
              label: "Total Appointments",
              value: loadingAppts ? "—" : appointments.length,
              icon: "🏥", color: "#E65100", bg: "#FFF3E0",
              onClick: () => navigate("/patient/appointments"),
            },
          ].map((card) => (
            <div
              key={card.label}
              onClick={card.onClick}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm
                         hover:shadow-md transition cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center
                              text-xl mb-3"
                style={{ background: card.bg }}>
                {card.icon}
              </div>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 800, fontSize: "1.8rem", color: card.color
              }}>
                {card.value}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════
            MAIN CONTENT GRID
        ══════════════════════════════════════════════ */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── LEFT COLUMN (2/3 width) ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Upcoming Appointments — real data */}
            <div className="bg-white rounded-2xl border border-gray-100
                            shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4
                              border-b border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    Upcoming Appointments
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Your pending bookings
                  </p>
                </div>
                <button
                  onClick={() => navigate("/patient/appointments")}
                  className="text-sm font-medium text-blue-600 hover:underline">
                  View All
                </button>
              </div>

              <div className="divide-y divide-gray-50">
                {loadingAppts ? (
                  <div className="px-6 py-8 text-center text-gray-400 text-sm">
                    Loading appointments...
                  </div>
                ) : upcomingThree.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <div className="text-3xl mb-2">📅</div>
                    <p className="text-gray-400 text-sm">No upcoming appointments</p>
                  </div>
                ) : (
                  upcomingThree.map((appt) => {
                    const dateParts = appt.date ? appt.date.split("-") : ["","",""];
                    return (
                      <div key={appt._id}
                        className="flex items-center gap-4 px-6 py-4
                                   hover:bg-gray-50 transition">

                        {/* Date block */}
                        <div
                          className="w-14 h-14 rounded-xl flex flex-col items-center
                                     justify-center flex-shrink-0 text-white"
                          style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}
                        >
                          <span className="text-xs font-bold opacity-80">
                            {dateParts[1]}
                          </span>
                          <span className="text-xl font-bold leading-none">
                            {dateParts[2]}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800">
                            {appt.session} Session
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {appt.date} · Est. {appt.estimatedTime}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            Channeling: <span className="font-semibold text-gray-600">
                              {appt.channelingNo}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs font-semibold px-3 py-1 rounded-full
                                           border bg-blue-100 text-blue-700 border-blue-200">
                            Pending
                          </span>
                          <button
                            onClick={() => setCancelId(appt._id)}
                            className="text-xs text-red-500 hover:text-red-700
                                       font-medium transition">
                            Cancel
                          </button>
                          <button
                            onClick={() => downloadPDF(
                              appt._id,
                              `appointment-${appt.appointmentId}.pdf`
                            )}
                            className="text-xs text-blue-600 hover:text-blue-800
                                       font-medium transition">
                            📄 PDF
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Cancel confirmation inline */}
              {cancelId && (
                <div className="border-t border-red-100 bg-red-50 px-6 py-3
                                flex items-center justify-between">
                  <p className="text-sm text-red-700 font-medium">
                    Cancel this appointment?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCancelId(null)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-300
                                 text-gray-600 hover:bg-gray-100 transition">
                      Keep it
                    </button>
                    <button
                      disabled={cancelling}
                      onClick={() => handleCancel(cancelId)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white
                                 font-semibold hover:bg-red-600 disabled:opacity-60 transition">
                      {cancelling ? "Cancelling..." : "Yes, Cancel"}
                    </button>
                  </div>
                </div>
              )}

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                <button
                  onClick={() => navigate("/patient/appointments")}
                  className="flex items-center justify-center gap-2 w-full py-2.5
                             rounded-xl text-sm font-semibold text-white shadow-md
                             transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd"
                      d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                      clipRule="evenodd" />
                  </svg>
                  Book New Appointment
                </button>
              </div>
            </div>

            {/* Recent Completed Visits */}
            <div className="bg-white rounded-2xl border border-gray-100
                            shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4
                              border-b border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-800">Recent Visits</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Your completed appointments
                  </p>
                </div>
                <button
                  onClick={() => navigate("/patient/appointments")}
                  className="text-sm font-medium text-blue-600 hover:underline">
                  View All
                </button>
              </div>

              <div className="divide-y divide-gray-50">
                {loadingAppts ? (
                  <div className="px-6 py-6 text-center text-gray-400 text-sm">
                    Loading...
                  </div>
                ) : completedAppointments.length === 0 ? (
                  <div className="px-6 py-6 text-center">
                    <p className="text-gray-400 text-sm">No completed visits yet</p>
                  </div>
                ) : (
                  completedAppointments.slice(0, 3).map((appt) => {
                    const dateParts = appt.date ? appt.date.split("-") : ["","",""];
                    return (
                      <div key={appt._id}
                        className="flex items-center gap-4 px-6 py-4
                                   hover:bg-gray-50 transition">
                        <div
                          className="w-14 h-14 rounded-xl flex flex-col items-center
                                     justify-center flex-shrink-0"
                          style={{ background: "#e5e7eb", color: "#6b7280" }}
                        >
                          <span className="text-xs font-bold opacity-80">
                            {dateParts[1]}
                          </span>
                          <span className="text-xl font-bold leading-none">
                            {dateParts[2]}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800">
                            {appt.session} Session
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {appt.date} · {appt.channelingNo}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs font-semibold px-3 py-1 rounded-full
                                           border bg-gray-100 text-gray-600 border-gray-200">
                            Completed
                          </span>
                          <button
                            onClick={() => downloadPDF(
                              appt._id,
                              `appointment-${appt.appointmentId}.pdf`
                            )}
                            className="text-xs text-blue-600 hover:text-blue-800
                                       font-medium transition">
                            📄 PDF
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-5">

            {/* Health Summary — real patient data */}
            <div
              className="rounded-2xl p-5 text-white"
              style={{ background: "linear-gradient(180deg, #0D2137 0%, #1565C0 100%)" }}
            >
              <h3 className="font-semibold mb-1"
                style={{ fontFamily: "'Playfair Display', serif" }}>
                Health Summary
              </h3>
              <p className="text-white/40 text-xs mb-4">From your profile</p>

              <div className="space-y-3">
                {[
                  {
                    label: "Blood Group",
                    val: bloodGroup || "Not set",
                  },
                  {
                    label: "Age",
                    val: age ? `${age} years` : "Not set",
                  },
                  {
                    label: "Chronic Conditions",
                    val: conditions || "None recorded",
                  },
                  {
                    label: "Known Allergies",
                    val: allergies.length > 0
                      ? allergies.join(", ")
                      : "None recorded",
                  },
                  {
                    label: "Emergency Contact",
                    val: user?.patientDetails?.emergencyContactName || "Not set",
                  },
                  {
                    label: "Next Appointment",
                    val: nextAppointment
                      ? `${nextAppointment.date} · ${nextAppointment.session}`
                      : "None booked",
                  },
                ].map((item) => (
                  <div key={item.label}
                    className="flex items-start justify-between py-2
                               border-b border-white/10">
                    <span className="text-white/50 text-xs flex-shrink-0 mr-2">
                      {item.label}
                    </span>
                    <span className="text-white text-xs font-semibold
                                     text-right max-w-[55%]">
                      {item.val}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate("/patient/profile")}
                className="block w-full mt-4 text-center py-2.5 rounded-xl text-sm
                           font-semibold bg-white/10 hover:bg-white/20 transition
                           border border-white/20"
              >
                View Full Profile
              </button>
            </div>

            {/* Personal Info Card */}
            <div className="bg-white rounded-2xl border border-gray-100
                            shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 text-sm">
                  Personal Information
                </h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { label: "Email",    val: user?.email },
                  { label: "Phone",    val: user?.telephone },
                  { label: "Gender",   val: user?.patientDetails?.gender },
                  { label: "Address",  val: user?.patientDetails?.address },
                ].map((item) => (
                  <div key={item.label}
                    className="flex items-start justify-between py-1.5
                               border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-400 font-medium uppercase
                                     tracking-wide flex-shrink-0 mr-2">
                      {item.label}
                    </span>
                    <span className="text-xs text-gray-700 font-medium
                                     text-right max-w-[60%]">
                      {item.val || "Not set"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-gray-100">
                <button
                  onClick={() => navigate("/patient/profile")}
                  className="text-xs font-semibold text-blue-600 hover:underline">
                  Edit Profile →
                </button>
              </div>
            </div>

            {/* Allergies card */}
            {allergies.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⚠️</span>
                  <h3 className="font-semibold text-red-800 text-sm">
                    Known Allergies
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allergies.map((a) => (
                    <span key={a}
                      className="px-2.5 py-1 bg-red-100 text-red-700 border
                                 border-red-200 rounded-full text-xs font-medium">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </PatientLayout>
  );
}