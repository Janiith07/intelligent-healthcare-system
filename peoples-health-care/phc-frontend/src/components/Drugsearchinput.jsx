import { useState, useEffect, useRef } from "react";
import api from "../services/api";

/**
 * DrugSearchInput
 * Props:
 *   value      – current medicine name string
 *   onChange   – (name, drugId, drugObj) => void   called when drug picked or typed freely
 *   disabled   – bool
 *   placeholder– string
 */
export default function DrugSearchInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Search medicine name…",
}) {
  const [query,    setQuery]    = useState(value || "");
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const [selected, setSelected] = useState(null);
  const containerRef = useRef(null);
  const debounceRef  = useRef(null);

  // Sync if parent resets value
  useEffect(() => {
    setQuery(value || "");
    if (!value) setSelected(null);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    onChange(val, "", null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 1) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/drugs/search?q=${encodeURIComponent(val.trim())}`);
        setResults(res.data.drugs || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
  };

  const handleSelect = (drug) => {
    // Display: "Name Strength (Form)"  e.g. "Amoxicillin 500mg (Capsule)"
    const displayName = `${drug.name} ${drug.strength}`;
    setQuery(displayName);
    setSelected(drug);
    setOpen(false);
    setResults([]);
    onChange(displayName, drug.drugId, drug);
  };

  const handleClear = () => {
    setQuery("");
    setSelected(null);
    setResults([]);
    setOpen(false);
    onChange("", "", null);
  };

  // Stock level badge colour
  const stockBadge = (drug) => {
    const s = drug.totalStock ?? 0;
    if (s === 0)                         return { cls: "bg-red-50 text-red-600 border-red-200",    label: "Out of stock" };
    if (s <= (drug.reorderLevel ?? 10)) return { cls: "bg-amber-50 text-amber-600 border-amber-200", label: `Low — ${s}` };
    return { cls: "bg-green-50 text-green-700 border-green-200", label: `${s} units` };
  };

  // Form icon
  const formIcon = (form) => {
    const icons = {
      Tablet: "💊", Capsule: "💊", Syrup: "🍶", Injection: "💉",
      Cream: "🧴", Drops: "💧", Inhaler: "🌬️",
    };
    return icons[form] || "💊";
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {/* Pill icon */}
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
          className={`w-full pl-9 pr-8 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
            selected
              ? "border-green-300 bg-green-50/40"
              : "border-gray-200 bg-white"
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        />

        {/* Spinner / clear */}
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

      {/* Selected drug badge */}
      {selected && (() => {
        const badge = stockBadge(selected);
        return (
          <div className="mt-1.5 flex items-center gap-2.5 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 text-base">
              {formIcon(selected.form)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-green-800 truncate">
                {selected.name} {selected.strength}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-mono text-green-600">{selected.drugId}</span>
                {selected.brand && (
                  <span className="text-xs text-green-500">· {selected.brand}</span>
                )}
              </div>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${badge.cls}`}>
              {badge.label}
            </span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
              ✓ Linked
            </span>
          </div>
        );
      })()}

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">
              {results.length} drug{results.length !== 1 ? "s" : ""} found
            </span>
            <span className="text-xs text-gray-300">Select to link inventory</span>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {results.map(drug => {
              const badge = stockBadge(drug);
              return (
                <button
                  key={drug._id}
                  type="button"
                  onMouseDown={() => handleSelect(drug)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left border-b border-gray-50 last:border-0"
                >
                  {/* Form icon circle */}
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-base flex-shrink-0">
                    {formIcon(drug.form)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">
                      {drug.name}
                      <span className="ml-1 font-normal text-gray-500">{drug.strength}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-mono text-blue-600">{drug.drugId}</span>
                      <span className="text-xs text-gray-400">{drug.form}</span>
                      {drug.brand && (
                        <span className="text-xs text-gray-400">· {drug.brand}</span>
                      )}
                      {drug.category && drug.category !== "Other" && (
                        <span className="text-xs text-gray-400">· {drug.category}</span>
                      )}
                    </div>
                  </div>

                  {/* Stock badge */}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Can't find the medicine? Type the name freely and continue.
            </p>
          </div>
        </div>
      )}

      {/* No results */}
      {open && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 text-center">
          <p className="text-xs text-gray-400">
            No drugs found for "<strong>{query}</strong>" in the pharmacy catalog.
          </p>
          <p className="text-xs text-gray-400 mt-0.5">You can still type the name and continue.</p>
        </div>
      )}
    </div>
  );
}