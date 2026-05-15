import { useState, useEffect, useCallback, useRef } from "react";
import PharmacyLayout from "../../components/PharmacyLayout";

const API   = "http://localhost:5001/api";
const token = () => sessionStorage.getItem("token");
const authH = () => ({ Authorization: `Bearer ${token()}` });
const jsonH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

function drugLabel(line) {
  if (!line.drugId) return null;
  if (typeof line.drugId === "object" && line.drugId?.name)
    return `${line.drugId.name} ${line.drugId.strength || ""}`.trim();
  return null;
}
function oid(v) { return typeof v === "object" ? v?._id : v; }

const STATUS_CFG = {
  pending:             { bg:"bg-amber-100",  text:"text-amber-700",  border:"border-amber-200",  bar:"#fbbf24", icon:"⏳", label:"Pending"      },
  in_review:           { bg:"bg-blue-100",   text:"text-blue-700",   border:"border-blue-200",   bar:"#60a5fa", icon:"🔍", label:"In Review"     },
  partially_available: { bg:"bg-orange-100", text:"text-orange-700", border:"border-orange-200", bar:"#fb923c", icon:"⚠️", label:"Partial Stock" },
  dispensed:           { bg:"bg-gray-100",   text:"text-gray-500",   border:"border-gray-200",   bar:"#9ca3af", icon:"✅", label:"Dispensed"     },
  cancelled:           { bg:"bg-red-100",    text:"text-red-500",    border:"border-red-200",    bar:"#f87171", icon:"❌", label:"Cancelled"     },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
}

function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={`fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl text-white shadow-2xl text-sm font-medium ${type === "success" ? "bg-emerald-600" : "bg-red-500"}`}
      style={{ animation: "slideIn .3s ease" }}>
      {type === "success" ? "✅" : "❌"} {msg}
    </div>
  );
}

function MiniBarChart({ data, color = "#263238", labelKey = "_id", valueKey = "count", height = 60 }) {
  if (!data || data.length === 0)
    return <p className="text-xs text-gray-400 text-center py-4">No data yet</p>;
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  const W = 280, H = height, pad = 4;
  const barW = Math.max(4, (W - pad * 2) / data.length - 3);
  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" style={{ fontFamily: "sans-serif" }}>
      {data.map((d, i) => {
        const barH = Math.max(2, ((d[valueKey] / max) * (H - 8)));
        const x = pad + i * ((W - pad * 2) / data.length);
        const y = H - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="2" fill={color} opacity="0.85" />
            <text x={x + barW / 2} y={H + 13} textAnchor="middle" fontSize="7" fill="#9ca3af">
              {String(d[labelKey]).length > 5 ? String(d[labelKey]).slice(-5) : d[labelKey]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutRing({ pct, color, label, sub }) {
  const r = 36, cx = 48, cy = 48;
  const circ = 2 * Math.PI * r;
  const dash = pct == null ? 0 : (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 96 96" className="w-24 h-24">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="10"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 48 48)" style={{ transition: "stroke-dasharray .8s ease" }}/>
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="16" fontWeight="bold" fill={color} fontFamily="serif">
          {pct == null ? "—" : `${pct}%`}
        </text>
      </svg>
      <p className="text-xs font-semibold text-gray-700 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function StatCard({ icon, label, value, color, bg, sub, alert }) {
  return (
    <div className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition ${alert ? "border-red-200" : "border-gray-100"}`}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background: bg }}>
        {icon}
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color }}>
        {value ?? <span className="text-gray-300 text-lg">—</span>}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// ── Dispense Modal with auto inventory check ──────────────────
function DispenseModal({ rx: rxProp, onClose, onDone }) {
  const [lines, setLines] = useState(() =>
    (rxProp.lines || []).map(l => ({
      ...l,
      _id:            String(l._id || l.id || crypto.randomUUID()),
      drugId:         oid(l.drugId) || null,
      _drugLabel:     drugLabel(l) || "",
      _searchText:    "",
      _totalStock:    0,
      qtyToDispense:  Number(l.qtyToDispense) || 0,
      availability:   l.availability || "available",
      pharmacistNote: l.pharmacistNote || "",
    }))
  );
  const [generalNote,  setGeneralNote]  = useState(rxProp.generalNote || "");
  const [drugResults,  setDrugResults]  = useState({});
  const [phase,        setPhase]        = useState("review");
  const [bill,         setBill]         = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [checkResults, setCheckResults] = useState({});
  const [checking,     setChecking]     = useState(false);
  const timers = useRef({});

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setChecking(true);
      try {
        const res  = await fetch(`${API}/pharmacy/${rxProp._id}/auto-check`, { headers: authH() });
        const data = await res.json();
        if (cancelled || !data.success) return;
        const map = {};
        for (const r of (data.results || [])) map[String(r.lineId)] = r;
        setCheckResults(map);
        setLines(prev => prev.map(line => {
          const r = map[String(line._id)];
          if (!r) return line;
          const untouched = !line.drugId && line.availability === "available" && !line.pharmacistNote?.trim();
          if (!untouched) return line;
          if (r.status === "not_in_formulary")
            return { ...line, availability: "not_in_formulary", pharmacistNote: `${line.medicationName} is not in the pharmacy inventory` };
          if (r.status === "out_of_stock")
            return { ...line, availability: "out_of_stock", pharmacistNote: `${line.medicationName} is currently out of stock`,
              drugId: r.matchedDrug?._id || null, _drugLabel: r.matchedDrug ? `${r.matchedDrug.name} ${r.matchedDrug.strength || ""}`.trim() : "" };
          if (r.status === "match" && r.matchedDrug)
            return { ...line, drugId: r.matchedDrug._id,
              _drugLabel: `${r.matchedDrug.name} ${r.matchedDrug.strength || ""} (${r.totalStock} in stock)`.trim(),
              _totalStock: r.totalStock };
          return line;
        }));
      } catch {}
      finally { if (!cancelled) setChecking(false); }
    };
    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rxProp._id]);

  const searchDrug = (lineId, text) => {
    setLines(p => p.map(l => l._id === lineId ? { ...l, _searchText: text } : l));
    clearTimeout(timers.current[lineId]);
    if (text.length < 2) { setDrugResults(p => ({ ...p, [lineId]: [] })); return; }
    timers.current[lineId] = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/drugs/search?q=${encodeURIComponent(text)}`, { headers: authH() });
        const data = await res.json();
        if (data.success) setDrugResults(p => ({ ...p, [lineId]: data.drugs || [] }));
      } catch {}
    }, 300);
  };

  const selectDrug = (lineId, drug) => {
    const stk = drug.totalStock ?? 0;
    setLines(p => p.map(l => l._id === lineId
      ? { ...l, drugId: drug._id, _drugLabel: `${drug.name} ${drug.strength}`, _searchText: "", _totalStock: stk } : l));
    setDrugResults(p => ({ ...p, [lineId]: [] }));
  };

  const clearDrug  = (lineId) =>
    setLines(p => p.map(l => l._id === lineId ? { ...l, drugId: null, _drugLabel: "", _searchText: "", _totalStock: 0 } : l));

  const updateLine = (lineId, field, val) =>
    setLines(p => p.map(l => l._id === lineId ? { ...l, [field]: val } : l));

  const availLines = lines.filter(l => l.availability === "available");
  const outLines   = lines.filter(l => l.availability !== "available");
  const allDone    = lines.every(l =>
    l.availability === "available" ? (l.drugId && l.qtyToDispense > 0) : !!l.pharmacistNote?.trim()
  );

  const goConfirm = () => {
    setError("");
    for (const l of lines) {
      if (l.availability === "available") {
        if (!l.drugId)              return setError(`Link a drug for: "${l.medicationName}"`);
        if (!(l.qtyToDispense > 0)) return setError(`Set qty > 0 for: "${l.medicationName}"`);
      } else {
        if (!l.pharmacistNote?.trim()) return setError(`Add a note for: "${l.medicationName}"`);
      }
    }
    setPhase("confirm");
  };

  const doDispense = async () => {
    setLoading(true); setError("");
    try {
      const rRes  = await fetch(`${API}/pharmacy/${rxProp._id}/review`, {
        method: "PUT", headers: jsonH(),
        body: JSON.stringify({ generalNote,
          lines: lines.map(l => ({ _id: l._id, drugId: l.drugId || null,
            qtyToDispense: Number(l.qtyToDispense) || 0, availability: l.availability, pharmacistNote: l.pharmacistNote || "" })) }),
      });
      const rData = await rRes.json();
      if (!rData.success) throw new Error(rData.message);
      const dRes  = await fetch(`${API}/pharmacy/${rxProp._id}/dispense`, { method: "POST", headers: jsonH() });
      const dData = await dRes.json();
      if (!dData.success) throw new Error(dData.message);
      setBill(dData.bill || null); setPhase("done"); onDone(dData.pharmacyPrescription);
    } catch (e) { setError(e.message); setPhase("confirm"); }
    finally { setLoading(false); }
  };

  const renderToggle = (line) => {
    const chk = checkResults[String(line._id)];
    if (chk?.status === "match")
      return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-lg">✅ Available — locked</span>;
    if (chk?.status === "out_of_stock")
      return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 px-3 py-1.5 rounded-lg">❌ Out of Stock — locked</span>;
    return (
      <div className="flex gap-1.5 flex-wrap">
        {[
          { val: "available",        label: "✅ Available"    },
          { val: "not_in_formulary", label: "⚠️ Not Listed"  },
        ].map(opt => (
          <button key={opt.val}
            onClick={() => updateLine(line._id, "availability", opt.val)}
            className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border transition ${
              line.availability === opt.val ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}>{opt.label}</button>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[93vh] overflow-y-auto">
        <div className="px-6 py-5 sticky top-0 z-10 rounded-t-3xl flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0D2137, #263238)" }}>
          <div>
            <p className="text-white/60 text-xs">
              {phase === "done" ? "Dispensed ✅" : phase === "confirm" ? "Confirm & Dispense" : "Review Prescription"}
            </p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>{rxProp.prescriptionRef}</h3>
            <p className="text-white/60 text-xs mt-0.5">{rxProp.patientName} · Dr. {rxProp.doctorName}</p>
          </div>
          {phase !== "done" && (
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex gap-2">
              <span>❌</span><span>{error}</span>
            </div>
          )}

          {phase === "review" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{lines.length} Medication{lines.length !== 1 ? "s" : ""}</p>
                {checking && <span className="text-xs text-gray-400 animate-pulse">🔄 Checking inventory…</span>}
                {outLines.length > 0 && !checking && (
                  <span className="text-xs text-slate-600 font-semibold bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">⚠️ {outLines.length} unavailable</span>
                )}
              </div>
              {lines.map((line, idx) => {
                const chk = checkResults[String(line._id)];
                return (
                  <div key={line._id} className={`rounded-2xl border-2 p-4 space-y-3 transition ${
                    line.availability === "available" ? "border-slate-300 bg-slate-50/40"
                      : line.availability === "out_of_stock" ? "border-red-300 bg-red-50/40" : "border-gray-300 bg-gray-50"
                  }`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{idx + 1}. {line.medicationName}</p>
                        <p className="text-xs text-gray-500">{line.dosage} · {line.duration}</p>
                        {chk && !checking && (() => {
                          if (chk.status === "match") return <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✅ In stock — {chk.totalStock} available</span>;
                          if (chk.status === "out_of_stock") return <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">❌ Out of stock — auto-marked</span>;
                          if (chk.status === "wrong_strength") return <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠️ Strength not in inventory</span>;
                          if (chk.status === "not_in_formulary") return <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full">🚫 Not in inventory — auto-marked</span>;
                          return null;
                        })()}
                      </div>
                      {renderToggle(line)}
                    </div>
                    {line.availability === "available" && (
                      <div className="relative">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Inventory Drug <span className="text-red-400">*</span></label>
                        {chk?.status === "wrong_strength" && (
                          <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 space-y-1">
                            <p className="font-bold">⚠️ Prescribed strength not found in inventory</p>
                            <p>{chk.message}</p>
                            <p className="text-amber-600 italic">Please verify with the doctor or mark as "Not Listed".</p>
                          </div>
                        )}
                        {line.drugId ? (
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                            <span className="text-sm font-medium text-slate-800 flex-1">{line._drugLabel}</span>
                            <button onClick={() => clearDrug(line._id)} className="text-xs text-gray-400 hover:text-red-500 font-semibold transition">✕ Change</button>
                          </div>
                        ) : (
                          <>
                            <input type="text" value={line._searchText || ""} onChange={e => searchDrug(line._id, e.target.value)}
                              placeholder="Type drug name to search…"
                              className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                            {(drugResults[line._id] || []).length > 0 && (
                              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                {drugResults[line._id].map(d => {
                                  const stk = d.totalStock ?? 0;
                                  return (
                                    <button key={d._id} onClick={() => selectDrug(line._id, d)}
                                      className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm border-b border-gray-50 last:border-0 transition">
                                      <span className="font-semibold text-gray-800">{d.name} {d.strength}</span>
                                      <span className="text-gray-400 ml-2 text-xs">({d.form})</span>
                                      <span className={`ml-2 text-xs font-bold ${stk > 0 ? "text-emerald-600" : "text-red-500"}`}>{stk > 0 ? `${stk} in stock` : "out of stock"}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {line.availability === "available" && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Qty to Dispense <span className="text-red-400">*</span>
                          {line._totalStock > 0 && <span className="ml-2 font-normal text-slate-600 normal-case">({line._totalStock} in stock)</span>}
                        </label>
                        <input type="number" min="1" value={line.qtyToDispense || ""} onChange={e => updateLine(line._id, "qtyToDispense", Number(e.target.value))}
                          placeholder="0" className="w-32 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                        {line._totalStock > 0 && line.qtyToDispense > line._totalStock && (
                          <p className="text-xs text-red-500 mt-1">⚠️ Exceeds stock ({line._totalStock})</p>
                        )}
                      </div>
                    )}
                    {line.availability !== "available" && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Note for Cashier / Patient <span className="text-red-400">*</span></label>
                        <input type="text" value={line.pharmacistNote} onChange={e => updateLine(line._id, "pharmacistNote", e.target.value)}
                          placeholder={`e.g. ${line.medicationName} — not available`}
                          className="w-full px-4 py-2 rounded-xl border border-red-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-300 transition" />
                      </div>
                    )}
                  </div>
                );
              })}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  General Note <span className="font-normal text-gray-400 normal-case">(appears on cashier bill)</span>
                </label>
                <textarea value={generalNote} onChange={e => setGeneralNote(e.target.value)} rows={2}
                  placeholder="e.g. Patient has allergy to penicillin — inform cashier"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={goConfirm} disabled={!allDone}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #263238, #37474F)" }}>
                  {allDone ? "Review Complete → Confirm Dispense" : "Complete All Lines First"}
                </button>
                <button onClick={onClose} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              </div>
            </>
          )}

          {phase === "confirm" && (
            <>
              {availLines.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">✅ Will be Dispensed — Stock Deducted via FEFO</p>
                  <div className="space-y-2">
                    {availLines.map(l => (
                      <div key={l._id} className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm">
                        <div><span className="font-semibold text-gray-800">{l.medicationName}</span>{l._drugLabel && <span className="text-xs text-gray-400 ml-2">→ {l._drugLabel}</span>}</div>
                        <span className="font-bold text-slate-700 flex-shrink-0 ml-3">{l.qtyToDispense} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {outLines.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">⚠️ Unavailable — Listed on Bill</p>
                  <div className="space-y-2">
                    {outLines.map(l => (
                      <div key={l._id} className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl text-sm">
                        <p className="font-semibold text-gray-800">{l.medicationName}</p>
                        <p className="text-xs text-amber-700 mt-0.5">📝 {l.pharmacistNote}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {generalNote && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm">
                  <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Note → Cashier</p>
                  <p className="text-gray-700">{generalNote}</p>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                ⚠️ Stock deducted via <strong>FEFO</strong> (First Expiry First Out). Cannot be undone.
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={doDispense} disabled={loading}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #1565C0, #0D47A1)" }}>
                  {loading ? "Dispensing…" : "✅ Confirm & Dispense → Send to Cashier"}
                </button>
                <button onClick={() => setPhase("review")} disabled={loading} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">← Back</button>
              </div>
            </>
          )}

          {phase === "done" && (
            <>
              <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🧾</span>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 text-base">Sent to Cashier!</p>
                    <p className="text-xs text-slate-600 mt-0.5">{bill?.billNumber || "Created"} · {rxProp.patientName}</p>
                  </div>
                  {bill?.hasNote && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-300 flex-shrink-0">📝 Note flagged</span>}
                </div>
                {bill && (bill.lines || []).filter(l => l.qtyDispensed > 0).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Dispensed Items</p>
                    <div className="divide-y divide-slate-100">
                      {(bill.lines || []).filter(l => l.qtyDispensed > 0).map((l, i) => (
                        <div key={i} className="flex justify-between py-2 text-sm">
                          <span className="text-gray-700">{l.medicationName}<span className="text-xs text-gray-400 ml-1">× {l.qtyDispensed}</span></span>
                          <span className="font-semibold text-gray-800">LKR {l.lineTotal.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {bill && (bill.unavailableLines || []).length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Unavailable (on Bill)</p>
                    {bill.unavailableLines.map((l, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium text-gray-800">{l.medicationName}</span>
                        <span className="text-xs text-amber-600 ml-2">📝 {l.pharmacistNote}</span>
                      </div>
                    ))}
                  </div>
                )}
                {bill && (
                  <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-3">
                    <span className="text-gray-800">Bill Total</span>
                    <span style={{ color: "#263238" }}>LKR {bill.totalAmount.toLocaleString()}</span>
                  </div>
                )}
                {!bill && <p className="text-sm text-slate-700 text-center">All lines were out of stock — no bill created.</p>}
              </div>
              <button onClick={onClose} className="w-full py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #263238, #37474F)" }}>✅ Done — Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function PharmacyDashboard() {
  const [pharmData, setPharmData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [modal,     setModal]     = useState(null);
  const [toast,     setToast]     = useState(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`${API}/pharmacy/dashboard`, { headers: authH() }),
        fetch(`${API}/stocks/dashboard`,   { headers: authH() }),
      ]);
      const pJson = await pRes.json();
      const sJson = await sRes.json();
      if (pJson.success) setPharmData(pJson.dashboard);
      if (sJson.success) setStockData(sJson.dashboard);
    } catch { setError("Failed to load dashboard. Check your server connection."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const queue        = pharmData?.prescriptionQueue || {};
  const analytics    = pharmData?.analytics || {};
  const stockInfo    = stockData || {};
  const pendingQueue = queue.pendingQueue || [];
  const totalInQueue = (queue.pending || 0) + (queue.inReview || 0) + (queue.partiallyAvailable || 0);

  const lowStockDrugs = stockInfo.lowStockDrugs  || [];
  const outOfStock    = stockInfo.outOfStockDrugs || [];
  const expiringSoon  = stockInfo.expiringSoon    || [];
  const criticalDrugs = [...outOfStock, ...lowStockDrugs].slice(0, 6);

  const fulfillmentRate   = analytics.fulfillmentRate   ?? null;
  const avgProcessingMins = analytics.avgProcessingMins ?? null;
  const topDrugs          = analytics.topDrugs          || [];
  const weeklyData        = analytics.weeklyDispensed   || [];
  const hourlyData        = analytics.hourlyToday       || [];
  const outOfStockHits    = analytics.outOfStockHits    ?? 0;
  const totalLinesDispensedToday = analytics.totalLinesDispensedToday ?? 0;

  const now     = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const handleDone = (updatedRx) => {
    setModal(null);
    showToast(`${updatedRx.prescriptionRef} dispensed — Sent to cashier`);
    load();
  };

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const found = weeklyData.find(w => w._id === key);
    return { _id: d.toLocaleDateString("en-GB", { weekday: "short" }), count: found?.count || 0 };
  });

  const allHours = Array.from({ length: 24 }, (_, h) => {
    const found = hourlyData.find(d => d._id === h);
    return { _id: `${h}h`, count: found?.count || 0 };
  }).filter(d => d._id !== undefined && (d.count > 0 || parseInt(d._id) <= now.getHours()));

  return (
    <PharmacyLayout activePage="Dashboard">
      <style>{`
        @keyframes slideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .fu  { animation:fadeUp .35s ease both; }
        .fu2 { animation:fadeUp .35s .07s ease both; }
        .fu3 { animation:fadeUp .35s .14s ease both; }
        .fu4 { animation:fadeUp .35s .21s ease both; }
        .fu5 { animation:fadeUp .35s .28s ease both; }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {modal  && <DispenseModal rx={modal} onClose={() => setModal(null)} onDone={handleDone} />}

      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between fu">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">{dateStr}</p>
            <h1 className="text-xl font-bold text-gray-800 mt-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>{greeting()} 👋</h1>
          </div>
          <button onClick={load} className="px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition text-sm text-gray-500 flex items-center gap-1.5">🔄 Refresh</button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm">{error}</div>}

        {/* Banner */}
        <div className="rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden fu2"
          style={{ background: "linear-gradient(135deg, #0D2137 0%, #263238 60%, #37474F 100%)" }}>
          <div className="absolute right-0 top-0 bottom-0 w-64 opacity-10 pointer-events-none">
            <svg viewBox="0 0 200 200" fill="white"><circle cx="160" cy="100" r="90"/><circle cx="40" cy="30" r="55"/></svg>
          </div>
          <div className="relative">
            <p className="text-white/70 text-sm">Pharmacy · {timeStr}</p>
            <h2 className="text-white font-bold text-2xl mt-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              {loading ? "Loading…" : totalInQueue > 0
                ? <><span className="text-green-300">{totalInQueue}</span> prescription{totalInQueue !== 1 ? "s" : ""} in queue</>
                : "Queue is clear ✨"}
            </h2>
            <p className="text-white/60 text-sm mt-1">
              {queue.dispensedToday > 0 && <span className="text-blue-200 mr-3">{queue.dispensedToday} dispensed today</span>}
              {outOfStock.length    > 0  && <span className="text-red-300 mr-3">{outOfStock.length} out of stock</span>}
            </p>
          </div>
          <div className="relative flex gap-3 flex-shrink-0">
            <a href="/pharmacy/queue" className="px-5 py-2.5 bg-white text-green-900 rounded-xl text-sm font-semibold hover:bg-green-50 transition shadow">💊 Full Queue</a>
            <a href="/pharmacy/inventory" className="px-5 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition">📦 Inventory</a>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fu3">
          <StatCard icon="💊" label="In Queue"          color="#263238" bg="#ECEFF1"
            value={loading ? "…" : totalInQueue}
            sub={queue.pending > 0 ? `${queue.pending} awaiting review` : undefined} />
          <StatCard icon="✅" label="Dispensed Today"   color="#1565C0" bg="#E3F2FD"
            value={loading ? "…" : (queue.dispensedToday ?? 0)} />
          <StatCard icon="⚠️" label="Stock Alerts"      color="#E65100" bg="#FFF3E0"
            value={loading ? "…" : (lowStockDrugs.length + outOfStock.length)}
            sub={outOfStock.length > 0 ? `${outOfStock.length} out of stock` : lowStockDrugs.length > 0 ? `${lowStockDrugs.length} low stock` : "All levels healthy"}
            alert={outOfStock.length > 0} />
          <StatCard icon="📅" label="Expiring (30d)"    color="#6A1B9A" bg="#F3E5F5"
            value={loading ? "…" : expiringSoon.length}
            alert={expiringSoon.length > 0} />
        </div>

        {/* Analytics Row */}
        <div className="grid lg:grid-cols-3 gap-6 fu4">

          {/* Today's performance */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-800 text-sm">Today's Performance</h3>
            <div className="flex items-center justify-around py-2">
              <DonutRing
                pct={fulfillmentRate}
                color={fulfillmentRate == null ? "#9ca3af" : fulfillmentRate >= 80 ? "#16a34a" : fulfillmentRate >= 60 ? "#d97706" : "#dc2626"}
                label="Fulfillment Rate"
                sub={fulfillmentRate != null ? `${totalLinesDispensedToday} lines total` : "No dispenses yet"} />
              <div className="text-center">
                <p className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: outOfStockHits > 0 ? "#dc2626" : "#16a34a" }}>
                  {loading ? "…" : outOfStockHits}
                </p>
                <p className="text-xs text-gray-500 mt-1">Out-of-Stock Hits</p>
                <p className="text-xs text-gray-400">unavailable lines today</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-50">
              {[
                { label: "Pending",   count: queue.pending            ?? 0, color: "#fbbf24", bg: "#FFF8E1" },
                { label: "In Review", count: queue.inReview           ?? 0, color: "#60a5fa", bg: "#E3F2FD" },
                { label: "Partial",   count: queue.partiallyAvailable ?? 0, color: "#fb923c", bg: "#FFF3E0" },
              ].map(s => (
                <div key={s.label} className="text-center p-2 rounded-xl" style={{ background: s.bg }}>
                  <div className="text-lg font-bold" style={{ color: s.color, fontFamily: "'Playfair Display', serif" }}>{s.count}</div>
                  <div className="text-xs text-gray-600">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly trend */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">Weekly Dispensing</h3>
              <span className="text-xs text-gray-400">Last 7 days</span>
            </div>
            {loading ? <div className="h-20 bg-gray-50 rounded-xl animate-pulse" /> : (
              <MiniBarChart data={last7Days} color="#263238" labelKey="_id" valueKey="count" height={65} />
            )}
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-50 pt-3">
              <span>Total: <strong className="text-gray-800">{last7Days.reduce((s, d) => s + d.count, 0)}</strong> Rx</span>
              <span>Peak: <strong className="text-gray-800">{Math.max(...last7Days.map(d => d.count), 0)}</strong>/day</span>
            </div>
          </div>

          {/* Top drugs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">Top Dispensed Drugs</h3>
              <span className="text-xs text-gray-400">Last 30 days</span>
            </div>
            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-50 rounded-lg animate-pulse" />)}</div>
            ) : topDrugs.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No dispense data yet</p>
            ) : (
              <div className="space-y-2.5">
                {topDrugs.map((d, i) => {
                  const maxQty = topDrugs[0]?.totalQty || 1;
                  const pct    = Math.round((d.totalQty / maxQty) * 100);
                  const colors = ["#263238","#37474F","#455A64","#546E7A","#607D8B"];
                  return (
                    <div key={d._id}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-700 truncate flex-1 mr-2">{i + 1}. {d._id}</span>
                        <span className="text-xs font-bold text-gray-600 flex-shrink-0">{d.totalQty}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: colors[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Queue + Right column */}
        <div className="grid lg:grid-cols-3 gap-6 fu5">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-800">Dispensing Queue</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {loading ? "Loading…" : `${pendingQueue.length} prescription${pendingQueue.length !== 1 ? "s" : ""} — click any to review & dispense`}
                </p>
              </div>
              <a href="/pharmacy/queue" className="text-sm font-medium text-slate-600 hover:underline">View All →</a>
            </div>
            {loading ? (
              <div className="p-10 text-center text-gray-400"><div className="text-3xl mb-2 animate-pulse">💊</div><p className="text-sm">Loading queue…</p></div>
            ) : pendingQueue.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm font-medium text-gray-600">Queue is clear</p>
                <p className="text-xs mt-1">Doctor prescriptions appear here automatically</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pendingQueue.map(rx => {
                  const s      = STATUS_CFG[rx.status] || STATUS_CFG.pending;
                  const meds   = rx.lines || [];
                  const hasOut = meds.some(l => l.availability && l.availability !== "available");
                  const time   = rx.createdAt ? new Date(rx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
                  return (
                    <div key={rx._id} onClick={() => setModal(rx)}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition cursor-pointer group">
                      <div className="w-1 h-14 rounded-full flex-shrink-0" style={{ background: s.bar }} />
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#ECEFF1", color: "#263238" }}>
                        {meds.length}💊
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-sm font-bold text-gray-800 truncate">{rx.patientName}</p>
                          {hasOut && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">⚠️ Partial</span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {meds.slice(0, 3).map(l => l.medicationName).join(", ")}{meds.length > 3 && ` +${meds.length - 3} more`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{time} · {rx.prescriptionRef} · Dr. {rx.doctorName}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 ${s.bg} ${s.text} ${s.border}`}>{s.icon} {s.label}</span>
                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg group-hover:bg-slate-700 group-hover:text-white group-hover:border-slate-700 transition">
                          {rx.status === "pending" ? "🔍 Review & Dispense" : "💊 Dispense"} →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 text-sm mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { label: "Full Queue",     href: "/pharmacy/queue",     icon: "📋", color: "#263238", bg: "#ECEFF1", badge: totalInQueue > 0 ? totalInQueue : null },
                  { label: "Drug Inventory", href: "/pharmacy/inventory", icon: "💊", color: "#1565C0", bg: "#E3F2FD", badge: null },
                  { label: "Manage Stock",   href: "/pharmacy/inventory", icon: "📦", color: "#37474F", bg: "#ECEFF1", badge: null },
                  { label: "Stock Alerts",   href: "/pharmacy/inventory", icon: "⚠️", color: "#E65100", bg: "#FFF3E0", badge: (lowStockDrugs.length + outOfStock.length) > 0 ? lowStockDrugs.length + outOfStock.length : null },
                ].map(a => (
                  <a key={a.label} href={a.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: a.bg }}>{a.icon}</div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 flex-1">{a.label}</span>
                    {a.badge && <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: a.color }}>{a.badge}</span>}
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 group-hover:text-gray-500">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-orange-100">
                <h3 className="font-semibold text-gray-800 text-sm">Stock Alerts</h3>
                {outOfStock.length > 0 && <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">{outOfStock.length} out</span>}
              </div>
              {loading ? <div className="p-6 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
              : criticalDrugs.length === 0 ? (
                <div className="p-6 text-center"><p className="text-2xl mb-1">✅</p><p className="text-sm font-medium text-emerald-700">All stock levels healthy</p></div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {criticalDrugs.map((entry, idx) => {
                    const d       = entry.drug || entry;
                    const total   = entry.total ?? entry.totalStock ?? 0;
                    const reorder = d.reorderLevel ?? 10;
                    const isOut   = total === 0;
                    const pct     = isOut ? 0 : Math.min(Math.round((total / Math.max(reorder, 1)) * 100), 100);
                    return (
                      <div key={d._id || idx} className="px-5 py-3 hover:bg-gray-50 transition">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOut ? "bg-red-500" : "bg-amber-400"}`}/>
                            <span className="text-sm font-medium text-gray-800 truncate">{d.name} <span className="text-gray-400 text-xs">{d.strength}</span></span>
                          </div>
                          <span className={`text-xs font-bold flex-shrink-0 ml-2 ${isOut ? "text-red-600" : "text-amber-600"}`}>{isOut ? "OUT" : `${total} ${d.unit || "pcs"}`}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${isOut ? "bg-red-400" : "bg-amber-400"}`} style={{ width: `${pct}%` }}/>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{isOut ? "Reorder immediately" : `Reorder at: ${reorder}`}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {expiringSoon.length > 0 && (
              <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-purple-100"><h3 className="font-semibold text-gray-800 text-sm">Expiring Within 30 Days</h3></div>
                <div className="divide-y divide-gray-50">
                  {expiringSoon.slice(0, 4).map((entry, idx) => {
                    const daysLeft = Math.ceil((new Date(entry.expiryDate) - new Date()) / 86400000);
                    return (
                      <div key={entry._id || idx} className="px-5 py-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{entry.drug?.name} <span className="text-gray-400 text-xs">{entry.drug?.strength}</span></p>
                          <p className="text-xs text-gray-400 mt-0.5">Qty: {entry.remainingQty} {entry.drug?.unit || "pcs"}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ml-2 ${daysLeft <= 7 ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"}`}>
                          {daysLeft}d left
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom row: hourly chart + inventory value */}
        <div className="grid lg:grid-cols-2 gap-6 fu5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">Hourly Activity Today</h3>
              <span className="text-xs text-gray-400">Dispensed per hour</span>
            </div>
            {loading ? <div className="h-20 bg-gray-50 rounded-xl animate-pulse" /> : (
              <MiniBarChart data={allHours} color="#1565C0" labelKey="_id" valueKey="count" height={65} />
            )}
            <p className="text-xs text-gray-400 mt-2 text-center">{queue.dispensedToday ?? 0} total dispensed today</p>
          </div>

          {stockInfo.totalStockValue !== undefined ? (
            <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #ECEFF1, #E8EAF6)" }}>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Total Inventory Value</p>
                <p className="text-2xl font-bold text-gray-800 mt-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                  LKR {stockInfo.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="flex gap-4 mt-3 text-sm text-gray-600">
                  <span>📦 {stockInfo.totalDrugs ?? 0} active SKUs</span>
                  {stockInfo.totalExpired > 0 && <span className="text-red-500 font-medium">⚠️ {stockInfo.totalExpired} expired</span>}
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="bg-white/70 rounded-xl px-4 py-2 text-center">
                  <p className="text-lg font-bold text-red-600">{outOfStock.length}</p>
                  <p className="text-xs text-gray-500">Out of Stock</p>
                </div>
                <div className="bg-white/70 rounded-xl px-4 py-2 text-center">
                  <p className="text-lg font-bold text-amber-600">{lowStockDrugs.length}</p>
                  <p className="text-xs text-gray-500">Low Stock</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-center text-gray-400 text-sm">Stock data unavailable</div>
          )}
        </div>

      </div>
    </PharmacyLayout>
  );
}