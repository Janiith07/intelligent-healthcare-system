import { useState, useEffect } from "react";
import PatientLayout from "../../components/PatientLayout";
import api from "../../services/api";

// ── Pharmacy status styles ─────────────────────────────────
const STATUS_CONFIG = {
  pending:     { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", label: "Pending"     },
  in_progress: { bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200",   label: "In Progress" },
  dispensed:   { bg: "bg-teal-100",   text: "text-teal-700",   border: "border-teal-200",   label: "Dispensed"   },
  cancelled:   { bg: "bg-red-100",    text: "text-red-600",    border: "border-red-200",    label: "Cancelled"   },
};

// ── Download prescription PDF with auth token ──────────────
const downloadPDF = async (id, filename) => {
  try {
    const response = await api.get(`/prescriptions/${id}/pdf`, {
      responseType: "blob",
    });
    const url  = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href  = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    alert("Could not download PDF. Please try again.");
  }
};

// ── Single prescription card ───────────────────────────────
function PrescriptionCard({ rx }) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_CONFIG[rx.pharmacyStatus] || STATUS_CONFIG.pending;

  const issuedDate = rx.createdAt
    ? new Date(rx.createdAt).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "—";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm
                    overflow-hidden hover:shadow-md transition">

      {/* Card header — click to expand */}
      <div
        className="flex items-center gap-4 px-6 py-4 cursor-pointer
                   hover:bg-gray-50 transition"
        onClick={() => setExpanded(!expanded)}>

        {/* Rx icon */}
        <div className="w-12 h-12 rounded-xl flex items-center justify-center
                        text-white text-xl flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
          💊
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">
              {rx.prescriptionId}
            </span>
            {rx.appointmentId && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5
                               rounded-full font-mono">
                {rx.appointmentId}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {issuedDate} · {rx.doctorName} · {rx.medications?.length || 0} medication(s)
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border
                            ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
            {statusStyle.label}
          </span>
          <svg
            viewBox="0 0 20 20" fill="currentColor"
            className={`w-4 h-4 text-gray-400 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}>
            <path fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-6 pb-5 space-y-4 border-t border-gray-50">

          {/* Medications */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase
                           tracking-wide mt-4 mb-3">
              Medications
            </h4>
            <div className="space-y-3">
              {rx.medications?.map((med, i) => (
                <div key={i}
                  className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-blue-900">
                        {med.name}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-1.5">
                        {med.dosage && (
                          <span className="text-xs text-blue-700">
                            💊 {med.dosage}
                          </span>
                        )}
                        {med.frequency && (
                          <span className="text-xs text-blue-700">
                            🔄 {med.frequency}
                          </span>
                        )}
                        {med.duration && (
                          <span className="text-xs text-blue-700">
                            📅 {med.duration}
                          </span>
                        )}
                      </div>
                      {med.instructions && (
                        <p className="text-xs text-blue-600 mt-1.5 italic">
                          ℹ️ {med.instructions}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical notes */}
          {rx.clinicalNotes && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-xs font-semibold text-amber-700 mb-1">
                Doctor's Notes
              </p>
              <p className="text-sm text-amber-800">{rx.clinicalNotes}</p>
            </div>
          )}

          {/* Lab request linked */}
          {rx.labRequestRef && (
            <div className="p-3 bg-green-50 rounded-xl border border-green-100
                            flex items-center gap-2">
              <span className="text-lg">🧪</span>
              <p className="text-sm text-green-700">
                Lab tests also requested —
                <span className="font-semibold ml-1">{rx.labRequestRef}</span>
              </p>
            </div>
          )}

          {/* Download PDF button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => downloadPDF(
                rx._id,
                `prescription-${rx.prescriptionId}.pdf`
              )}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white
                         text-sm font-semibold transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
              📄 Download Prescription PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════
export default function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [filter, setFilter]               = useState("all");

  useEffect(() => {
    const fetchPrescriptions = async () => {
      try {
        const res = await api.get("/prescriptions");
        setPrescriptions(res.data.prescriptions || []);
      } catch (err) {
        setError("Could not load prescriptions. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrescriptions();
  }, []);

  const filtered = filter === "all"
    ? prescriptions
    : prescriptions.filter((p) => p.pharmacyStatus === filter);

  const counts = {
    all:         prescriptions.length,
    pending:     prescriptions.filter((p) => p.pharmacyStatus === "pending").length,
    in_progress: prescriptions.filter((p) => p.pharmacyStatus === "in_progress").length,
    dispensed:   prescriptions.filter((p) => p.pharmacyStatus === "dispensed").length,
  };

  if (loading) {
    return (
      <PatientLayout activePage="My Prescriptions">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 text-sm">Loading prescriptions...</p>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout activePage="My Prescriptions">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            My Prescriptions
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            View and download your prescriptions
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700
                          text-sm px-4 py-3 rounded-xl">
            ⚠️ {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total",       value: counts.all,         color: "#1565C0", bg: "#E3F2FD" },
            { label: "Pending",     value: counts.pending,     color: "#E65100", bg: "#FFF3E0" },
            { label: "In Progress", value: counts.in_progress, color: "#0277BD", bg: "#E1F5FE" },
            { label: "Dispensed",   value: counts.dispensed,   color: "#00897B", bg: "#E0F2F1" },
          ].map((s) => (
            <div key={s.label}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold"
                style={{ fontFamily: "'Playfair Display', serif", color: s.color }}>
                {s.value}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100
                        shadow-sm flex flex-wrap gap-2">
          {[
            { key: "all",         label: "All"         },
            { key: "pending",     label: "Pending"     },
            { key: "in_progress", label: "In Progress" },
            { key: "dispensed",   label: "Dispensed"   },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                filter === f.key
                  ? "text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              style={filter === f.key
                ? { background: "linear-gradient(135deg, #1565C0, #00ACC1)" }
                : {}}>
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100
                            p-12 text-center">
              <div className="text-4xl mb-3">💊</div>
              <p className="text-gray-500 font-medium">No prescriptions found</p>
              <p className="text-gray-400 text-sm mt-1">
                Prescriptions will appear here after your consultation
              </p>
            </div>
          ) : (
            filtered.map((rx) => (
              <PrescriptionCard key={rx._id} rx={rx} />
            ))
          )}
        </div>

      </div>
    </PatientLayout>
  );
}