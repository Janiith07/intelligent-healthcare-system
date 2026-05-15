import { useState, useEffect } from "react";
import LabLayout from "../../components/LabLayout";
import api from "../../services/api";

// ── Logo SVG ────────────────────────────────────────────────────────────
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="50" height="50"><rect width="60" height="60" rx="10" fill="#CC0000"/><rect x="24" y="10" width="12" height="40" fill="white"/><rect x="10" y="24" width="40" height="12" fill="white"/></svg>`;

// ── Download report as HTML file (opens in browser; has Print/Save button) ─
function printReport(r) {
  const date = r.completedAt
    ? new Date(r.completedAt).toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" })
    : "—";

  const paramRows = (r.results?.parameters || []).map(p => {
    const abn = ["High","Low","Positive","Reactive"].includes(p.flag);
    return `<tr>
      <td style="padding:9px 14px;border-bottom:1px solid #E3F2FD;font-size:13px;">${p.name}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #E3F2FD;font-weight:700;font-size:13px;color:${abn?"#B71C1C":"#1565C0"};">
        ${p.value||"—"} ${p.unit||""}
        ${p.flag && p.flag !== "Normal" ? `<span style="font-size:11px;background:${abn?"#FFEBEE":"#E8F5E9"};color:${abn?"#B71C1C":"#2E7D32"};padding:2px 7px;border-radius:4px;margin-left:6px;">${p.flag}</span>` : ""}
      </td>
      <td style="padding:9px 14px;border-bottom:1px solid #E3F2FD;font-size:12px;color:#888;">${p.ref||""}</td>
    </tr>`;
  }).join("");

  const findings = (r.results?.checkboxFindings || [])
    .filter(f => f.checked)
    .map(f => `<li style="margin:5px 0;font-size:13px;">${f.label}</li>`).join("");

  const isFlagged = (r.results?.parameters||[]).some(p=>["High","Low","Positive","Reactive"].includes(p.flag));

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Lab Report — ${r.testId||r._id}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #f4f6f9; }
  .page { max-width: 760px; margin: 0 auto; background: white; box-shadow: 0 4px 24px rgba(0,0,0,.12); }
  @media print { body { background: white; } .page { box-shadow: none; } .no-print { display: none !important; } }
</style>
</head><body>
<div class="page">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0D2137,#0D47A1);color:#fff;padding:26px 32px;display:flex;align-items:center;gap:18px;">
    <div style="flex-shrink:0;">${LOGO_SVG}</div>
    <div style="flex:1;">
      <div style="font-size:22px;font-weight:700;font-family:Georgia,serif;letter-spacing:.3px;">People's Health Care</div>
      <div style="font-size:12px;opacity:.65;margin-top:3px;">Laboratory Services · Certified Medical Laboratory · Matara</div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:1px;">Report ID</div>
      <div style="font-size:16px;font-weight:700;font-family:monospace;margin-top:2px;">${r.testId||r._id}</div>
      <div style="font-size:11px;opacity:.6;margin-top:4px;">${date}</div>
    </div>
  </div>

  <!-- Patient / Test band -->
  <div style="background:#E3F2FD;padding:14px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0D47A1;">
    <div>
      <div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;">Patient</div>
      <div style="font-size:18px;font-weight:700;color:#0D2137;margin-top:2px;">${r.patientName||"—"}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;">Test</div>
      <div style="font-size:18px;font-weight:700;color:#0D47A1;margin-top:2px;">${r.testName||"—"}</div>
    </div>
  </div>

  ${isFlagged ? `
  <!-- Flagged warning -->
  <div style="margin:18px 32px 0;background:#FFEBEE;border:1px solid #FFCDD2;border-radius:8px;padding:12px 16px;font-size:13px;color:#B71C1C;">
    ⚠️ <strong>Attention:</strong> One or more values are outside the normal reference range. Please consult your doctor.
  </div>` : ""}

  <!-- Parameters table -->
  <div style="padding:24px 32px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0D47A1;margin-bottom:10px;">Test Parameters</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #E3F2FD;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#F3F8FF;">
          <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#0D47A1;font-weight:600;">Parameter</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#0D47A1;font-weight:600;">Result</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#0D47A1;font-weight:600;">Reference Range</th>
        </tr>
      </thead>
      <tbody>${paramRows || '<tr><td colspan="3" style="padding:16px;text-align:center;color:#aaa;">No parameters recorded</td></tr>'}</tbody>
    </table>
  </div>

  ${findings ? `
  <!-- Clinical findings -->
  <div style="padding:0 32px 24px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0D47A1;margin-bottom:8px;">Clinical Findings</div>
    <ul style="margin:0;padding:14px 14px 14px 34px;background:#F3F8FF;border:1px solid #E3F2FD;border-radius:8px;">${findings}</ul>
  </div>` : ""}

  ${r.results?.labNotes ? `
  <!-- Lab notes -->
  <div style="margin:0 32px 24px;background:#FFFDE7;border:1px solid #FFF9C4;border-radius:8px;padding:16px;font-size:13px;color:#555;">
    <strong>Lab Notes:</strong> ${r.results.labNotes}
  </div>` : ""}

  <!-- Footer -->
  <div style="margin:0 32px 24px;padding-top:16px;border-top:1px solid #E0E0E0;display:flex;justify-content:space-between;font-size:11px;color:#aaa;">
    <div>Performed by: <strong style="color:#555;">${r.results?.performedBy||"TPG"}</strong></div>
    <div>This report is confidential — for the patient and requesting physician only.</div>
  </div>

  <!-- Print button (hidden when printing) -->
  <div class="no-print" style="padding:14px 32px 28px;text-align:center;background:#f8faff;border-top:1px solid #e8edf5;">
    <button onclick="window.print()"
      style="background:linear-gradient(135deg,#0D2137,#0D47A1);color:white;border:none;padding:11px 32px;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:.3px;">
      🖨️ Print / Save as PDF
    </button>
    <p style="font-size:11px;color:#aaa;margin-top:8px;">Use your browser's Print → Save as PDF to get a PDF copy.</p>
  </div>

</div>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `PHC-LabReport-${r.testId||r._id}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// ── Flag badge ───────────────────────────────────────────────────────────
function FlagBadge({ flag }) {
  const cfg = {
    Normal:   "bg-green-100 text-green-700",
    High:     "bg-red-100 text-red-600",
    Low:      "bg-blue-100 text-blue-700",
    Positive: "bg-red-100 text-red-600",
    Negative: "bg-green-100 text-green-700",
    Reactive: "bg-red-100 text-red-600",
  }[flag] || "bg-gray-100 text-gray-500";
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg}`}>{flag}</span>;
}

// ── Report detail modal ───────────────────────────────────────────────────
function ReportModal({ report, onClose }) {
  if (!report) return null;
  const isFlagged = (report.results?.parameters || []).some(p =>
    ["High","Low","Positive","Reactive"].includes(p.flag)
  );
  const date = report.completedAt
    ? new Date(report.completedAt).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
    : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 flex items-center justify-between rounded-t-3xl"
          style={{ background:"linear-gradient(135deg, #0D2137, #0D47A1)" }}>
          <div>
            <p className="text-white/60 text-xs">Laboratory Report</p>
            <h3 className="text-white font-bold text-xl" style={{ fontFamily:"'Playfair Display', serif" }}>
              {report.testId || report._id}
            </h3>
            <p className="text-white/60 text-xs mt-0.5">{date}</p>
          </div>
          <div className="flex items-center gap-3">
            {isFlagged && (
              <span className="text-xs bg-red-100 text-red-600 font-bold px-3 py-1 rounded-full border border-red-300">
                ⚠️ Abnormal Values
              </span>
            )}
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-2xl">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Laboratory</p>
              <p className="font-bold text-gray-800">People's Health Care</p>
              <p className="text-xs text-gray-500">Diagnostic Laboratory · Matara</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Patient</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background:"linear-gradient(135deg,#0D47A1,#1565C0)" }}>
                  {(report.patientName||"PT").split(" ").map(n=>n[0]).join("").slice(0,2)}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{report.patientName||"—"}</p>
                  <p className="text-xs text-gray-500">{report.testName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Checkbox findings */}
          {(report.results?.checkboxFindings||[]).some(f=>f.checked) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Clinical Findings</p>
              <div className="space-y-1.5">
                {report.results.checkboxFindings.filter(f=>f.checked).map((f,i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-500 font-bold flex-shrink-0">✓</span> {f.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parameters table */}
          {(report.results?.parameters||[]).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                🧪 {report.testName}
              </p>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Parameter</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Result</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Reference</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {report.results.parameters.map((p,i) => {
                      const abn = ["High","Low","Positive","Reactive"].includes(p.flag);
                      return (
                        <tr key={i} className={abn ? "bg-red-50" : ""}>
                          <td className="px-4 py-3 text-xs font-medium text-gray-700">{p.name}</td>
                          <td className={`px-4 py-3 font-semibold text-sm ${abn?"text-red-600":"text-gray-800"}`}>
                            {p.value} {p.unit}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{p.ref}</td>
                          <td className="px-4 py-3"><FlagBadge flag={p.flag}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lab notes */}
          {report.results?.labNotes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lab Notes</p>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-700 leading-relaxed">
                📝 {report.results.labNotes}
              </div>
            </div>
          )}

          {isFlagged && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-red-800 mb-1">⚠️ Abnormal Values Detected</p>
              <p className="text-xs text-red-700">
                One or more parameters are outside the reference range. The doctor has been notified.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => printReport(report)}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg"
              style={{ background:"linear-gradient(135deg,#0D47A1,#1565C0)" }}>
              ⬇️ Download Report
            </button>
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

// ── Main page ─────────────────────────────────────────────────────────────
export default function LabReports() {
  const [reports,     setReports]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [flagOnly,    setFlagOnly]    = useState(false);
  const [filterMonth, setFilterMonth] = useState(""); // 0-11 or "" for all
  const [filterYear,  setFilterYear]  = useState(""); // e.g. "2026" or "" for all

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get("/lab-results?status=completed&limit=200");
      setReports(res.data.results || []);
    } catch { setReports([]); }
    finally { setLoading(false); }
  };

  const isFlagged = r => (r.results?.parameters || []).some(p =>
    ["High","Low","Positive","Reactive"].includes(p.flag)
  );

  const fmtDate = iso => iso
    ? new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
    : "—";
  const fmtTime = iso => iso
    ? new Date(iso).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true })
    : "";

  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];

  const availableYears = [...new Set(
    reports.filter(r => r.completedAt).map(r => new Date(r.completedAt).getFullYear())
  )].sort((a, b) => b - a);

  const filtered = reports.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (r.patientName||"").toLowerCase().includes(q) ||
      (r.testName||"").toLowerCase().includes(q) ||
      (r.testId||"").toLowerCase().includes(q);
    const matchFlag = !flagOnly || isFlagged(r);
    let   matchDate = true;
    if (filterMonth !== "" || filterYear !== "") {
      const d = r.completedAt ? new Date(r.completedAt) : null;
      if (!d) {
        matchDate = false;
      } else {
        if (filterMonth !== "") matchDate = matchDate && d.getMonth() === parseInt(filterMonth);
        if (filterYear  !== "") matchDate = matchDate && d.getFullYear() === parseInt(filterYear);
      }
    }
    return matchSearch && matchFlag && matchDate;
  });

  const flaggedCount = reports.filter(isFlagged).length;

  return (
    <LabLayout activePage="All Reports">
      {selected && <ReportModal report={selected} onClose={() => setSelected(null)}/>}

      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily:"'Playfair Display', serif" }}>
            All Lab Reports
          </h1>
          <p className="text-sm text-gray-400 mt-1">Complete history of completed laboratory test results</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label:"Total Reports",        value: loading ? "…" : reports.length,      color:"#0D47A1", bg:"#E3F2FD" },
            { label:"Completed",            value: loading ? "…" : reports.length,      color:"#1565C0", bg:"#E3F2FD" },
            { label:"With Abnormal Values", value: loading ? "…" : flaggedCount,        color:"#B71C1C", bg:"#FFEBEE" },
            { label:"This Month",           value: loading ? "…" : reports.filter(r => {
                const d = r.completedAt ? new Date(r.completedAt) : null;
                const now = new Date();
                return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length, color:"#00695C", bg:"#E0F2F1" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold" style={{ fontFamily:"'Playfair Display', serif", color:s.color }}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 relative">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input type="text" placeholder="Search patient, test name, or report ID…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
          </div>
          {/* Month selector */}
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700 cursor-pointer">
            <option value="">All Months</option>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>

          {/* Year selector */}
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700 cursor-pointer">
            <option value="">All Years</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <button onClick={() => setFlagOnly(!flagOnly)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
              flagOnly ? "bg-red-500 text-white border-red-400" : "border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600"
            }`}>
            ⚠️ Abnormal Only
          </button>

          {(filterMonth !== "" || filterYear !== "" || flagOnly || search) && (
            <button onClick={() => { setFilterMonth(""); setFilterYear(""); setFlagOnly(false); setSearch(""); }}
              className="px-3 py-2 rounded-xl text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* Reports list */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            Loading reports…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 font-medium">
              {reports.length === 0 ? "No completed reports yet" : "No reports match your search"}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {reports.length === 0
                ? "Reports will appear here once lab results are uploaded."
                : "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const flagged = isFlagged(r);
              const params  = r.results?.parameters || [];
              return (
                <div key={r._id}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition overflow-hidden ${
                    flagged ? "border-red-100" : "border-gray-100"
                  }`}>
                  <div className="flex items-center gap-4 px-6 py-4">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background:"linear-gradient(135deg,#0D47A1,#1565C0)" }}>
                      {(r.patientName||"PT").split(" ").map(n=>n[0]).join("").slice(0,2)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-gray-800">{r.patientName||"—"}</span>
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r.testName}</span>
                        {flagged && (
                          <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full border border-red-200">
                            ⚠️ Abnormal
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {fmtDate(r.completedAt)} {fmtTime(r.completedAt)}
                        {r.testId && <span className="ml-2 font-mono">{r.testId}</span>}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-green-100 text-green-700 border-green-200">
                        ✅ Completed
                      </span>
                      <button onClick={() => setSelected(r)}
                        className="text-xs font-semibold text-blue-600 hover:underline">
                        View Report →
                      </button>
                    </div>
                  </div>

                  {/* Parameter preview bar */}
                  {params.length > 0 && (
                    <div className="border-t border-gray-50 px-6 py-3 bg-gray-50 flex flex-wrap gap-4">
                      {params.slice(0,4).map((p,i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${["High","Low","Positive","Reactive"].includes(p.flag) ? "bg-red-400" : "bg-green-400"}`}/>
                          <span className="text-xs text-gray-500">{p.name}:</span>
                          <span className={`text-xs font-semibold ${["High","Low","Positive","Reactive"].includes(p.flag) ? "text-red-600" : "text-gray-700"}`}>
                            {p.value} {p.unit}
                          </span>
                        </div>
                      ))}
                      {params.length > 4 && (
                        <span className="text-xs text-gray-400">+{params.length - 4} more</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </LabLayout>
  );
}