import { useState, useEffect, useCallback, useRef } from "react";
import PharmacyLayout from "../../components/PharmacyLayout";

const API         = "http://localhost:5001/api";
const token       = () => sessionStorage.getItem("token");
const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

const STATUS_CONFIG = {
  pending:             { bg:"bg-amber-100",  text:"text-amber-700",  border:"border-amber-200",  label:"Pending",       icon:"⏳" },
  in_review:           { bg:"bg-blue-100",   text:"text-blue-700",   border:"border-blue-200",   label:"In Review",     icon:"🔍" },
  partially_available: { bg:"bg-orange-100", text:"text-orange-700", border:"border-orange-200", label:"Partial Stock", icon:"⚠️" },
  dispensed:           { bg:"bg-gray-100",   text:"text-gray-500",   border:"border-gray-200",   label:"Dispensed",     icon:"✅" },
  cancelled:           { bg:"bg-red-100",    text:"text-red-600",    border:"border-red-200",    label:"Cancelled",     icon:"❌" },
};

// Returns the display label for a linked drug regardless of whether drugId
// is a populated object or just an ObjectId string
function drugLabel(line) {
  if (!line.drugId) return null;
  if (typeof line.drugId === "object" && line.drugId?.name)
    return `${line.drugId.name} ${line.drugId.strength || ""}`.trim();
  return null;
}

// ── Toast ──────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl text-white shadow-2xl text-sm font-medium
      ${type === "success" ? "bg-emerald-600" : "bg-red-500"}`}
      style={{ animation: "slideIn .3s ease" }}>
      <span>{type === "success" ? "✅" : "❌"}</span>{msg}
    </div>
  );
}

// ── Review Modal ───────────────────────────────────────────────
function ReviewModal({ rx, onClose, onReviewed }) {
  // Normalise every line upfront:
  // - ensure _id is always a string (not undefined)
  // - store drugId as plain id string so submit always sends a string
  // - store _drugLabel separately for display (avoids uncontrolled input)
  // - default pharmacistNote to "" to prevent uncontrolled→controlled warning
  const [lines, setLines] = useState(() =>
    (rx.lines || []).map(l => ({
      ...l,
      _id:            String(l._id || l.id || crypto.randomUUID()),
      drugId:         l.drugId?._id || (typeof l.drugId === "string" ? l.drugId : null),
      _drugLabel:     drugLabel(l) || "",
      _searchText:    "",
      _totalStock:    0,
      qtyToDispense:  Number(l.qtyToDispense) || 0,
      availability:   l.availability || "available",
      pharmacistNote: l.pharmacistNote || "",
    }))
  );
  const [generalNote,  setGeneralNote]  = useState(rx.generalNote || "");
  const [drugResults,  setDrugResults]  = useState({}); // lineId -> drug[]
  const searchTimers = useRef({});
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [checkResults, setCheckResults] = useState({}); // lineId -> { status, message, matchedDrug, totalStock }
  const [checking,     setChecking]     = useState(false);

  // Run inventory auto-check once when modal opens
  useEffect(() => {
    let cancelled = false;
    const runAutoCheck = async () => {
      setChecking(true);
      try {
        const res  = await fetch(`${API}/pharmacy/${rx._id}/auto-check`, { headers: authHeaders() });
        const data = await res.json();
        if (cancelled || !data.success) return;

        const map = {};
        for (const r of (data.results || [])) map[String(r.lineId)] = r;
        setCheckResults(map);

        // Auto-fill lines that haven't been touched yet
        setLines(prev => prev.map(line => {
          const r = map[String(line._id)];
          if (!r) return line;
          const untouched = !line.drugId && line.availability === "available" && !line.pharmacistNote?.trim();
          if (!untouched) return line;

          if (r.status === "not_in_formulary")
            return { ...line, availability: "not_in_formulary", pharmacistNote: `${line.medicationName} is not in the pharmacy inventory` };

          if (r.status === "out_of_stock")
            return {
              ...line,
              availability:   "out_of_stock",
              pharmacistNote: `${line.medicationName} is currently out of stock`,
              drugId:         r.matchedDrug?._id || null,
              _drugLabel:     r.matchedDrug ? `${r.matchedDrug.name} ${r.matchedDrug.strength || ""}`.trim() : "",
            };

          if (r.status === "match" && r.matchedDrug)
            return {
              ...line,
              drugId:      r.matchedDrug._id,
              _drugLabel:  `${r.matchedDrug.name} ${r.matchedDrug.strength || ""} (${r.totalStock} in stock)`.trim(),
              _totalStock: r.totalStock,
            };

          return line; // wrong_strength -> leave for pharmacist to decide
        }));
      } catch { /* silent — auto-check is best-effort */ }
      finally { if (!cancelled) setChecking(false); }
    };
    runAutoCheck();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rx._id]);

  // Debounced drug search — updates _searchText immediately for responsiveness,
  // then fires the API call 300 ms later. Keeps focus stable.
  const searchDrug = (lineId, text) => {
    setLines(prev => prev.map(l => l._id === lineId ? { ...l, _searchText: text } : l));
    clearTimeout(searchTimers.current[lineId]);
    if (text.length < 2) { setDrugResults(p => ({ ...p, [lineId]: [] })); return; }
    searchTimers.current[lineId] = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/drugs/search?q=${encodeURIComponent(text)}`, { headers: authHeaders() });
        const data = await res.json();
        if (data.success) setDrugResults(p => ({ ...p, [lineId]: data.drugs || [] }));
      } catch { /* silent */ }
    }, 300);
  };

  const selectDrug = (lineId, drug) => {
    const stock = drug.totalStock ?? 0;
    const label = `${drug.name} ${drug.strength} (${stock} in stock)`;
    setLines(prev => prev.map(l =>
      l._id === lineId
        ? { ...l, drugId: drug._id, _drugLabel: label, _searchText: "", _totalStock: stock }
        : l
    ));
    setDrugResults(p => ({ ...p, [lineId]: [] }));
  };

  const clearDrug = (lineId) => {
    setLines(prev => prev.map(l =>
      l._id === lineId
        ? { ...l, drugId: null, _drugLabel: "", _searchText: "", _totalStock: 0 }
        : l
    ));
    setDrugResults(p => ({ ...p, [lineId]: [] }));
  };

  const updateLine = (lineId, field, value) =>
    setLines(prev => prev.map(l => l._id === lineId ? { ...l, [field]: value } : l));

  const handleSubmit = async () => {
    // Validate before hitting the server
    for (const l of lines) {
      if (l.availability === "available") {
        if (!l.drugId)
          return setError(`Link an inventory drug for: "${l.medicationName}"`);
        if (!(Number(l.qtyToDispense) > 0))
          return setError(`Set qty > 0 for: "${l.medicationName}"`);
      } else {
        if (!l.pharmacistNote?.trim())
          return setError(`Add a pharmacist note for: "${l.medicationName}" (marked ${l.availability.replace(/_/g, " ")})`);
      }
    }
    setLoading(true); setError("");
    try {
      const body = {
        lines: lines.map(l => ({
          _id:            l._id,
          drugId:         l.drugId || null,
          qtyToDispense:  Number(l.qtyToDispense) || 0,
          availability:   l.availability,
          pharmacistNote: l.pharmacistNote || "",
        })),
        generalNote,
      };
      const res  = await fetch(`${API}/pharmacy/${rx._id}/review`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      onReviewed(data.pharmacyPrescription);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const availBorder = {
    available:        "border-slate-400 bg-slate-50",
    out_of_stock:     "border-red-400    bg-red-50",
    not_in_formulary: "border-gray-400   bg-gray-50",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

        <div className="px-6 py-5 flex items-center justify-between sticky top-0 z-10 rounded-t-3xl"
          style={{ background: "linear-gradient(135deg, #0D2137, #263238)" }}>
          <div>
            <p className="text-white/60 text-xs">Review Prescription</p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              {rx.prescriptionRef}
            </h3>
            <p className="text-white/60 text-xs mt-0.5">{rx.patientName} · Dr. {rx.doctorName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">❌</span><span>{error}</span>
            </div>
          )}

          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Medication Lines — {lines.length} drug{lines.length !== 1 ? "s" : ""}
          </p>

          {lines.map((line, idx) => (
            <div key={line._id} className={`rounded-2xl border-2 p-4 space-y-3 transition ${availBorder[line.availability] || availBorder.available}`}>

              {/* Name + availability toggle */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-gray-800">{idx + 1}. {line.medicationName}</p>
                  <p className="text-xs text-gray-500">{line.dosage} · {line.duration}</p>
                  {/* Inventory check badge */}
                  {checking && <span className="inline-flex items-center gap-1 mt-1 text-xs text-gray-400 animate-pulse">🔄 Checking inventory…</span>}
                  {!checking && (() => {
                    const chk = checkResults[String(line._id)];
                    if (!chk) return null;
                    if (chk.status === "match")
                      return <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✅ In stock — {chk.totalStock} available</span>;
                    if (chk.status === "out_of_stock")
                      return <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">❌ Out of stock — auto-marked</span>;
                    if (chk.status === "wrong_strength")
                      return <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠️ Strength not in inventory</span>;
                    if (chk.status === "not_in_formulary")
                      return <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full">🚫 Not in inventory — auto-marked</span>;
                    return null;
                  })()}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(() => {
                    const chk = checkResults[String(line._id)];
                    // If drug is confirmed in stock by auto-check, lock to "Available" only —
                    // pharmacist cannot mark it as out of stock or not in list
                    const lockedToAvailable = chk?.status === "match";
                    const lockedToOutOfStock = chk?.status === "out_of_stock";

                    if (lockedToAvailable) {
                      return (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-lg">
                          ✅ Available 
                        </span>
                      );
                    }

                    if (lockedToOutOfStock) {
                      return (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 px-3 py-1.5 rounded-lg">
                          ❌ Out of Stock
                        </span>
                      );
                    }

                    const lockedToNotInList = chk?.status === "not_in_formulary";
                    if (lockedToNotInList) {
                      return (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-300 px-3 py-1.5 rounded-lg">
                          🚫 Not in List 
                        </span>
                      );
                    }

                    return [
                      { val: "available",        label: "✅ Available" },
                      { val: "not_in_formulary", label: "⚠️ Not in List" },
                    ].map(opt => (
                      <button key={opt.val}
                        onClick={() => updateLine(line._id, "availability", opt.val)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition border ${
                          line.availability === opt.val
                            ? "bg-gray-800 text-white border-gray-800"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                        }`}>
                        {opt.label}
                      </button>
                    ));
                  })()}
                </div>
              </div>

              {/* Drug link — available lines only */}
              {line.availability === "available" && (
                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Link to Inventory Drug <span className="text-red-400">*</span>
                  </label>

                  {/* Wrong-strength warning banner */}
                  {checkResults[String(line._id)]?.status === "wrong_strength" && (
                    <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 space-y-1">
                      <p className="font-bold">⚠️ Prescribed strength not found in inventory</p>
                      <p>{checkResults[String(line._id)].message}</p>
                      <p className="text-amber-600 italic">Please verify with the doctor or mark as "Not in List".</p>
                    </div>
                  )}

                  {/* Already linked — show chip */}
                  {line.drugId ? (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className="text-sm {text-slate-800 flex-1 font-medium">{line._drugLabel || "Linked drug"}</span>
                      <button onClick={() => clearDrug(line._id)}
                        className="text-xs text-gray-400 hover:text-red-500 font-semibold transition">✕ Change</button>
                    </div>
                  ) : (
                    <>
                      <input type="text"
                        value={line._searchText || ""}
                        onChange={e => searchDrug(line._id, e.target.value)}
                        placeholder="Type drug name to search…"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 transition bg-white" />
                      {(drugResults[line._id] || []).length > 0 && (
                        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                          {drugResults[line._id].map(d => {
                            const stk = d.totalStock ?? 0;
                            return (
                              <button key={d._id} onClick={() => selectDrug(line._id, d)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm border-b border-gray-50 last:border-0 transition">
                                <span className="font-semibold text-gray-800">{d.name} {d.strength}</span>
                                <span className="text-gray-400 ml-2 text-xs">({d.form})</span>
                                <span className={`ml-2 text-xs font-bold ${stk > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                  {stk > 0 ? `${stk} in stock` : "out of stock"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Qty to dispense */}
              {line.availability === "available" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Qty to Dispense <span className="text-red-400">*</span>
                    {line._totalStock > 0 && (
                      <span className="ml-2 font-normal text-slate-600 normal-case">
                        ({line._totalStock} available)
                      </span>
                    )}
                  </label>
                  <input type="number" min="1"
                    value={line.qtyToDispense || ""}
                    onChange={e => updateLine(line._id, "qtyToDispense", Number(e.target.value))}
                    placeholder="0"
                    className="w-32 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 transition bg-white" />
                  {line._totalStock > 0 && Number(line.qtyToDispense) > line._totalStock && (
                    <p className="text-xs text-red-500 mt-1">⚠️ Exceeds available stock ({line._totalStock})</p>
                  )}
                </div>
              )}

              {/* Note — required for unavailable lines */}
              {line.availability !== "available" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Note for Patient / Doctor <span className="text-red-400">*</span>
                  </label>
                  <input type="text"
                    value={line.pharmacistNote}
                    onChange={e => updateLine(line._id, "pharmacistNote", e.target.value)}
                    placeholder={`e.g. ${line.medicationName} not available — alternative suggested`}
                    className="w-full px-4 py-2 rounded-xl border border-red-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-300 transition" />
                </div>
              )}
            </div>
          ))}

          {/* General note */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              General Note (optional)
            </label>
            <textarea value={generalNote} onChange={e => setGeneralNote(e.target.value)} rows={2}
              placeholder="Overall note on this prescription…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 transition resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #263238, #37474F)" }}>
              {loading ? "Saving…" : "Save Review"}
            </button>
            <button onClick={onClose}
              className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dispense Confirmation Modal ────────────────────────────────
function DispenseModal({ rx, onClose, onDispensed }) {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [bill,     setBill]     = useState(null); // set after successful dispense

  const allLines     = rx.lines || [];
  const availLines   = allLines.filter(l => l.availability === "available");
  const missingLines = allLines.filter(l => l.availability !== "available");

  const unreadyLines    = availLines.filter(l => !l.drugId || !(Number(l.qtyToDispense) > 0));
  const readyToDispense = unreadyLines.length === 0 && availLines.length > 0;

  const handleDispense = async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API}/pharmacy/${rx._id}/dispense`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setBill(data.bill || null);
      onDispensed(data.pharmacyPrescription);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        <div className="px-6 py-5 flex items-center justify-between sticky top-0 z-10 rounded-t-3xl"
          style={{ background: "linear-gradient(135deg, #0D2137, #1565C0)" }}>
          <div>
            <p className="text-white/60 text-xs">Dispense Prescription</p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              {rx.prescriptionRef}
            </h3>
            <p className="text-white/60 text-xs mt-0.5">{rx.patientName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
              <span className="flex-shrink-0">❌</span><span>{error}</span>
            </div>
          )}

          {/* Incomplete review block */}
          {unreadyLines.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-sm text-amber-800 space-y-2">
              <p className="font-semibold">⚠️ Review not complete</p>
              <ul className="text-xs space-y-1 list-disc ml-4">
                {unreadyLines.map(l => (
                  <li key={l._id || l.medicationName}>
                    {l.medicationName} — {!l.drugId ? "no inventory drug linked" : "qty not set"}
                  </li>
                ))}
              </ul>
              <p className="text-xs">Close this and click <strong>Review Drugs</strong> to complete.</p>
            </div>
          )}

          {/* Will be dispensed */}
          {availLines.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Will be Dispensed ✅</p>
              <div className="space-y-2">
                {availLines.map(l => (
                  <div key={l._id} className="flex items-center justify-between bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-sm">
                    <div>
                      <span className="font-medium text-gray-800">{l.medicationName}</span>
                      {drugLabel(l) && (
                        <span className="text-xs text-gray-400 ml-2">→ {drugLabel(l)}</span>
                      )}
                    </div>
                    <span className="font-bold text-slate-700 flex-shrink-0 ml-3">{l.qtyToDispense} units</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unavailable */}
          {missingLines.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Not Available ❌</p>
              <div className="space-y-2">
                {missingLines.map(l => (
                  <div key={l._id} className="bg-red-50 border border-red-100 px-4 py-3 rounded-xl text-sm">
                    <p className="font-medium text-gray-800">{l.medicationName}</p>
                    {l.pharmacistNote && <p className="text-red-600 text-xs mt-1">📝 {l.pharmacistNote}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {rx.generalNote && (
            <div className="bg-blue-50 border border-blue-100 px-4 py-3 rounded-xl text-sm">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-1">General Note</p>
              <p className="text-gray-700">{rx.generalNote}</p>
            </div>
          )}

          {readyToDispense && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              ⚠️ <strong>Stock will be deducted via FEFO</strong> (First Expiry First Out). This cannot be undone.
            </div>
          )}

          {/* ── Bill summary — shown after successful dispense ── */}
          {bill && (
            <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🧾</span>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Bill Sent to Cashier!</p>
                  <p className="text-xs text-slate-600">{bill.billNumber} · {rx.patientName}</p>
                </div>
                {bill.hasNote && (
                  <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-1">
                    📝 Note flagged
                  </span>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {(bill.lines || []).map((l, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <span className="text-gray-700">{l.medicationName} × {l.qtyDispensed}</span>
                    <span className="font-semibold text-gray-800">LKR {l.lineTotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2">
                <span className="text-gray-800">Total</span>
                <span style={{ color: "#263238" }}>LKR {bill.totalAmount.toLocaleString()}</span>
              </div>
              {bill.hasNote && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                  📝 <strong>Note:</strong> {bill.noteContent}
                </div>
              )}
            </div>
          )}

          {!bill && (
            <div className="flex gap-3 pt-2">
              <button onClick={handleDispense} disabled={loading || !readyToDispense}
                className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #1565C0, #0D47A1)" }}>
                {loading ? "Dispensing…" : !readyToDispense ? "Complete Review First" : "Confirm & Dispense"}
              </button>
              <button onClick={onClose}
                className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          )}

          {bill && (
            <button onClick={onClose}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #263238, #37474F)" }}>
              ✅ Done — Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lab Status config ──────────────────────────────────────────
const LAB_STATUS_CONFIG = {
  payment_pending: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Payment Pending", icon: "💳" },
  pre_check:       { bg: "bg-blue-100",   text: "text-blue-700",   label: "Pre-Check",       icon: "📋" },
  sample_received: { bg: "bg-purple-100", text: "text-purple-700", label: "Sample Received",  icon: "🧪" },
  in_progress:     { bg: "bg-orange-100", text: "text-orange-700", label: "In Progress",      icon: "⚗️" },
  completed:       { bg: "bg-green-100",  text: "text-green-700",  label: "Completed",        icon: "✅" },
};

// ── Main Page ──────────────────────────────────────────────────
export default function PharmacyQueue() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [selectedId,    setSelectedId]    = useState(null); // id only — always read live
  const [modal,         setModal]         = useState(null);
  const [toast,         setToast]         = useState(null);
  const [labInfo,       setLabInfo]       = useState(null);   // { hasLabTest, labRequest, labResults }
  const [labLoading,    setLabLoading]    = useState(false);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  // Derive selected prescription live from the list — never a stale snapshot
  const selected = selectedId ? (prescriptions.find(p => p._id === selectedId) ?? null) : null;

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const q    = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res  = await fetch(`${API}/pharmacy${q}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setPrescriptions(data.prescriptions || data.pharmacyPrescriptions || []);
      } else {
        showToast(data.message || "Failed to load", "error");
      }
    } catch {
      showToast("Cannot connect to server", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

  // Fetch lab test info whenever a prescription is selected
  useEffect(() => {
    if (!selectedId) { setLabInfo(null); return; }
    setLabLoading(true);
    fetch(`${API}/pharmacy/${selectedId}/labtest`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => { if (data.success) setLabInfo(data); })
      .catch(() => {})
      .finally(() => setLabLoading(false));
  }, [selectedId]);

  const handleReviewed = (updatedRx) => {
    setPrescriptions(prev => prev.map(p => p._id === updatedRx._id ? updatedRx : p));
    setSelectedId(updatedRx._id);
    setModal(null);
    showToast("Prescription reviewed successfully");
  };

  const handleDispensed = (updatedRx) => {
    setPrescriptions(prev => prev.map(p => p._id === updatedRx._id ? updatedRx : p));
    setSelectedId(updatedRx._id);
    setModal(null);
    showToast("Prescription dispensed! Stock deducted via FEFO.");
  };

  const handleCancel = async (rx) => {
    if (!window.confirm(`Cancel prescription ${rx.prescriptionRef}?`)) return;
    try {
      const res  = await fetch(`${API}/pharmacy/${rx._id}/cancel`, { method: "PATCH", headers: authHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPrescriptions(prev => prev.map(p => p._id === rx._id ? { ...p, status: "cancelled" } : p));
      showToast("Prescription cancelled");
    } catch (e) { showToast(e.message, "error"); }
  };

  const filtered = prescriptions.filter(p => {
    const q = search.toLowerCase();
    return !search || p.patientName?.toLowerCase().includes(q) || p.prescriptionRef?.toLowerCase().includes(q);
  });

  const counts = {
    all:                 prescriptions.length,
    pending:             prescriptions.filter(p => p.status === "pending").length,
    in_review:           prescriptions.filter(p => p.status === "in_review").length,
    partially_available: prescriptions.filter(p => p.status === "partially_available").length,
    dispensed:           prescriptions.filter(p => p.status === "dispensed").length,
  };

  return (
    <PharmacyLayout activePage="Dispensing Queue">
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {modal?.type === "review"   && (
        <ReviewModal  rx={modal.rx} onClose={() => setModal(null)} onReviewed={handleReviewed} />
      )}
      {modal?.type === "dispense" && (
        <DispenseModal rx={modal.rx} onClose={() => setModal(null)} onDispensed={handleDispensed} />
      )}

      <div className="p-6 flex gap-5 overflow-hidden" style={{ height: "calc(100vh - 73px)" }}>

        {/* ── LEFT: List ───────────────────────────────────── */}
        <div className="w-96 flex-shrink-0 flex flex-col gap-4 overflow-hidden">

          <div className="relative">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input type="text" placeholder="Search patient or RX…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 transition bg-white shadow-sm" />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[
              { key: "all",                label: "All",     count: counts.all },
              { key: "pending",            label: "Pending", count: counts.pending },
              { key: "in_review",          label: "Review",  count: counts.in_review },
              { key: "partially_available",label: "Partial", count: counts.partially_available },
              { key: "dispensed",          label: "Done",    count: counts.dispensed },
            ].map(t => (
              <button key={t.key} onClick={() => setStatusFilter(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === t.key ? "text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                style={statusFilter === t.key ? { background: "linear-gradient(135deg, #263238, #37474F)" } : {}}>
                {t.label}
                {t.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === t.key ? "bg-white/20" : "bg-gray-100"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button onClick={fetchPrescriptions}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 transition">
            🔄 Refresh
          </button>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-3xl mb-2 animate-pulse">📋</div>
                <p className="text-sm">Loading…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm font-medium text-gray-600">No prescriptions found</p>
                <p className="text-xs mt-1 px-4">Doctor prescriptions appear here automatically</p>
              </div>
            ) : filtered.map(rx => {
              const s          = STATUS_CONFIG[rx.status] || STATUS_CONFIG.pending;
              const isSelected = selectedId === rx._id;
              const needsReview = rx.lines?.some(l => l.availability === "available" && !l.drugId);
              return (
                <div key={rx._id} onClick={() => setSelectedId(rx._id)}
                  className={`p-4 rounded-2xl cursor-pointer transition border-2 ${
                    isSelected ? "border-slate-400 bg-slate-50" : "bg-white border-gray-100 hover:border-slate-200 hover:bg-slate-50/30"
                  } shadow-sm`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{rx.patientName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{rx.prescriptionRef} · {rx.doctorName}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ${s.bg} ${s.text} ${s.border}`}>
                      {s.icon} {s.label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">{rx.lines?.length || 0} drug{rx.lines?.length !== 1 ? "s" : ""}</span>
                    {rx.lines?.some(l => l.availability !== "available") && (
                      <span className="text-xs text-red-500 font-medium">· Some unavailable</span>
                    )}
                    {needsReview && (
                      <span className="text-xs text-amber-600 font-medium">· Needs review</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {rx.createdAt ? new Date(rx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Detail panel ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <div className="text-6xl mb-4">💊</div>
                <h3 className="text-lg font-bold text-gray-500" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Select a Prescription
                </h3>
                <p className="text-sm text-gray-400 mt-1">Click a prescription from the left to view and process it</p>
              </div>
            </div>
          ) : (() => {
            const rx         = selected; // always live
            const s          = STATUS_CONFIG[rx.status] || STATUS_CONFIG.pending;
            const canReview  = ["pending", "in_review", "partially_available"].includes(rx.status);
            const canDispense= ["in_review", "partially_available"].includes(rx.status);
            const canCancel  = !["dispensed", "cancelled"].includes(rx.status);
            const unreviewed = (rx.lines || []).filter(l => l.availability === "available" && (!l.drugId || !l.qtyToDispense));
            return (
              <div className="space-y-5 pb-6">

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5" style={{ background: "linear-gradient(135deg, #0D2137 0%, #1a3a55 100%)" }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white/60 text-xs">Prescription</p>
                        <h2 className="text-white font-bold text-xl" style={{ fontFamily: "'Playfair Display', serif" }}>
                          {rx.prescriptionRef}
                        </h2>
                        <p className="text-white/70 text-sm mt-1">{rx.patientName}</p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
                        {s.icon} {s.label}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {[
                        { label: "Doctor",   val: rx.doctorName },
                        { label: "Received", val: rx.createdAt ? new Date(rx.createdAt).toLocaleDateString() : "—" },
                        { label: "Drugs",    val: `${rx.lines?.length || 0} items` },
                      ].map(i => (
                        <div key={i.label} className="bg-white/10 rounded-xl px-3 py-2">
                          <p className="text-white/50 text-xs">{i.label}</p>
                          <p className="text-white text-sm font-semibold">{i.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Incomplete review warning in detail panel */}
                {canDispense && unreviewed.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-800">
                    <p className="font-semibold mb-1">⚠️ Review incomplete — {unreviewed.length} line{unreviewed.length !== 1 ? "s" : ""} not fully set</p>
                    <p className="text-xs">Click <strong>Review Drugs</strong> to link inventory drugs and set quantities before dispensing.</p>
                  </div>
                )}

                {/* Actions */}
                {(canReview || canDispense || canCancel) && (
                  <div className="flex gap-3 flex-wrap">
                    {canReview && (
                      <button onClick={() => setModal({ type: "review", rx })}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow transition hover:opacity-90"
                        style={{ background: "linear-gradient(135deg, #263238, #37474F)" }}>
                        🔍 Review Drugs
                      </button>
                    )}
                    {canDispense && (
                      <button onClick={() => setModal({ type: "dispense", rx })}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow transition hover:opacity-90"
                        style={{ background: "linear-gradient(135deg, #1565C0, #0D47A1)" }}>
                        ✅ Dispense
                      </button>
                    )}
                    {canCancel && (
                      <button onClick={() => handleCancel(rx)}
                        className="px-5 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition">
                        Cancel Rx
                      </button>
                    )}
                  </div>
                )}

                {/* Medication lines */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Medications</p>
                  {(rx.lines || []).map((line, i) => {
                    const as = ({
                      available:        { bg:"bg-slate-50", border:"border-slate-200", badge:"text-slate-700 bg-slate-100", label:"Available" },
                      out_of_stock:     { bg:"bg-red-50",     border:"border-red-200",     badge:"text-red-700 bg-red-100",        label:"Out of Stock" },
                      not_in_formulary: { bg:"bg-gray-50",    border:"border-gray-200",    badge:"text-gray-600 bg-gray-100",      label:"Not in List" },
                    })[line.availability] || { bg:"bg-gray-50", border:"border-gray-200", badge:"text-gray-500 bg-gray-100", label:"Pending" };
                    const linked     = drugLabel(line);
                    const needsLink  = line.availability === "available" && !line.drugId;
                    return (
                      <div key={line._id || i} className={`flex items-start justify-between p-4 rounded-xl border ${as.bg} ${as.border}`}>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">{i + 1}. {line.medicationName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{line.dosage} · {line.duration}</p>
                          {linked     && <p className="text-xs text-blue-600 mt-1">🔗 {linked}</p>}
                          {needsLink  && <p className="text-xs text-amber-600 mt-1">⚠️ No inventory drug linked yet</p>}
                          {Number(line.qtyToDispense) > 0 && (
                            <p className="text-xs text-slate-600 mt-1 font-medium">Qty: {line.qtyToDispense} units</p>
                          )}
                          {line.stockDeducted && <p className="text-xs text-gray-500 mt-1">✅ Stock deducted</p>}
                          {line.pharmacistNote && (
                            <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded-lg inline-block">
                              📝 {line.pharmacistNote}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-3 ${as.badge}`}>
                          {as.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {rx.generalNote && (
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm">
                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">General Note</p>
                    <p className="text-gray-700">{rx.generalNote}</p>
                  </div>
                )}

                {/* Lab test details hidden — not relevant for pharmacist view */}

                {rx.status === "dispensed" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm">
                    <p className="text-xs font-bold text-slate-700 uppercase mb-1">✅ Dispensed</p>
                    <p className="text-gray-700">
                      Dispensed on <strong>{rx.dispensedAt ? new Date(rx.dispensedAt).toLocaleString() : "—"}</strong>.
                      Stock automatically deducted using FEFO.
                    </p>
                  </div>
                )}

                {rx.status === "cancelled" && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm">
                    <p className="text-xs font-bold text-red-600 uppercase mb-1">❌ Cancelled</p>
                    <p className="text-gray-500">This prescription was cancelled. No stock was deducted.</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </PharmacyLayout>
  );
}