import { useState, useEffect, useRef } from "react";
import api from "../services/api";

function getInitials(name = "") {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

/**
 * PatientSearchInput
 * Props:
 *   value        – current patientName string
 *   onChange     – (name, userId) => void  called when a patient is picked or name typed freely
 *   disabled     – bool (lock field when editing)
 *   placeholder  – string
 */
export default function PatientSearchInput({ value, onChange, disabled = false, placeholder = "Search patient name…" }) {
  const [query, setQuery]         = useState(value || "");
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [selected, setSelected]   = useState(null); // full patient object once picked
  const containerRef              = useRef(null);
  const debounceRef               = useRef(null);

  // Keep internal query in sync if parent resets value (e.g. modal re-open)
  useEffect(() => {
    setQuery(value || "");
    if (!value) setSelected(null);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    onChange(val, ""); // pass typed name up, clear userId

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 1) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/patients/search?q=${encodeURIComponent(val.trim())}`);
        setResults(res.data.patients || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
  };

  const handleSelect = (patient) => {
    setQuery(patient.name);
    setSelected(patient);
    setOpen(false);
    setResults([]);
    onChange(patient.name, patient.userId);
  };

  const handleClear = () => {
    setQuery("");
    setSelected(null);
    setResults([]);
    setOpen(false);
    onChange("", "");
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {/* Search icon */}
        <svg viewBox="0 0 20 20" fill="currentColor"
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
        </svg>

        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
            selected ? "border-blue-300 bg-blue-50/40" : "border-gray-200 bg-white"
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        />

        {/* Loading spinner / clear button */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"/>
          ) : query && !disabled ? (
            <button type="button" onClick={handleClear} className="text-gray-400 hover:text-gray-600">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Selected patient badge */}
      {selected && (
        <div className="mt-2 flex items-center gap-2.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
            {selected.photo
              ? <img src={selected.photo} alt="" className="w-full h-full rounded-lg object-cover"/>
              : getInitials(selected.name)
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-blue-800 truncate">{selected.name}</div>
            <div className="text-xs text-blue-500 font-mono">{selected.userId}</div>
          </div>
          {selected.patientDetails?.gender && (
            <span className="text-xs text-blue-400">{selected.patientDetails.gender}</span>
          )}
          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">✓ Matched</span>
        </div>
      )}

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">{results.length} patient{results.length !== 1 ? "s" : ""} found</span>
            <span className="text-xs text-gray-300">Select to autofill</span>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {results.map(p => (
              <button
                key={p._id}
                type="button"
                onMouseDown={() => handleSelect(p)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left border-b border-gray-50 last:border-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
                  {p.photo
                    ? <img src={p.photo} alt="" className="w-full h-full rounded-xl object-cover"/>
                    : getInitials(p.name)
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-blue-600">{p.userId}</span>
                    {p.patientDetails?.gender && (
                      <span className="text-xs text-gray-400">{p.patientDetails.gender}</span>
                    )}
                    {p.patientDetails?.birthday && (() => {
                      const age = Math.floor((Date.now() - new Date(p.patientDetails.birthday)) / (365.25*24*60*60*1000));
                      return <span className="text-xs text-gray-400">{age} yrs</span>;
                    })()}
                    {p.telephone && <span className="text-xs text-gray-400">{p.telephone}</span>}
                  </div>
                </div>
                {p.patientDetails?.bloodGroup && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex-shrink-0">
                    {p.patientDetails.bloodGroup}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400">Can't find the patient? Type the name freely and continue.</p>
          </div>
        </div>
      )}

      {/* No results */}
      {open && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 text-center">
          <p className="text-xs text-gray-400">No registered patients found for "<strong>{query}</strong>"</p>
          <p className="text-xs text-gray-400 mt-0.5">You can still type the name and continue.</p>
        </div>
      )}
    </div>
  );
}