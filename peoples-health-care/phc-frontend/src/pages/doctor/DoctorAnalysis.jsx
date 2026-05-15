import { useState, useEffect, useRef, useCallback } from "react";

// ─── Confidence bar component ──────────────────────────────────────────────
function ConfidenceBar({ label, value, rank }) {
  const colors = [
    "linear-gradient(90deg, #1565C0, #00ACC1)",
    "linear-gradient(90deg, #00897B, #26A69A)",
    "linear-gradient(90deg, #7B1FA2, #AB47BC)",
  ];
  const barColor = colors[rank] ?? "linear-gradient(90deg, #90A4AE, #B0BEC5)";

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-gray-600 truncate max-w-[70%]">{label}</span>
        <span className="text-xs font-bold text-gray-800">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

// ─── Severity badge ────────────────────────────────────────────────────────
function SeverityBadge({ prediction }) {
  const highRisk = ["Melanoma", "Basal Cell Carcinoma", "Squamous Cell Carcinoma"];
  const medRisk  = ["Acitinic Keratosis", "Seborrheic Keratosis", "Pigmented Benign Keratosis"];

  if (highRisk.some(c => prediction?.includes(c))) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold"
        style={{ background: "#FEE2E2", color: "#991B1B" }}>
        ⚠ High Risk — Refer Urgently
      </span>
    );
  }
  if (medRisk.some(c => prediction?.includes(c))) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold"
        style={{ background: "#FEF3C7", color: "#92400E" }}>
        ⚡ Moderate Risk — Monitor
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: "#D1FAE5", color: "#065F46" }}>
      ✓ Lower Risk — Routine Follow-up
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
const AI_URL = "http://localhost:5050";

async function checkServiceHealth(setter) {
  try {
    const res = await fetch(`${AI_URL}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    setter(data.status === "ok");
  } catch {
    setter(false);
  }
}

export default function DoctorAnalysis() {
  const [image, setImage]         = useState(null);      // preview URL
  const [imageFile, setImageFile] = useState(null);      // actual File object
  const [result, setResult]       = useState(null);      // prediction result
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [serviceOk, setServiceOk] = useState(null);      // null=unknown, true/false
  const [dragging, setDragging]   = useState(false);
  const fileRef                   = useRef(null);


  // ── Check service on mount + every 10s ─────────────────────────────────
  useEffect(() => {
    checkServiceHealth(setServiceOk);
    const interval = setInterval(() => checkServiceHealth(setServiceOk), 10_000);
    return () => clearInterval(interval);
  }, []);

  // ── Handle file selection ────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file) return;

    // ── 1. File type check ───────────────────────────────────────────────
    const allowed = ["image/jpeg", "image/png", "image/bmp", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Invalid file type. Please upload a JPG, PNG, BMP or WebP image.");
      return;
    }

    // ── 2. File size check (max 10 MB) ───────────────────────────────────
    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is ${MAX_MB} MB.`);
      return;
    }

    // ── 3. Pixel dimension check (async via Image object) ────────────────
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      const MIN_PX = 50;
      const MAX_PX = 8000;

      if (w < MIN_PX || h < MIN_PX) {
        URL.revokeObjectURL(url);
        setError(`Image is too small (${w}×${h}px). Minimum size is ${MIN_PX}×${MIN_PX}px.`);
        return;
      }
      if (w > MAX_PX || h > MAX_PX) {
        URL.revokeObjectURL(url);
        setError(`Image is too large (${w}×${h}px). Maximum size is ${MAX_PX}×${MAX_PX}px.`);
        return;
      }

      // ── All checks passed ────────────────────────────────────────────
      setError(null);
      setResult(null);
      setImageFile(file);
      setImage(url);
      checkServiceHealth(setServiceOk);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not read image. The file may be corrupted.");
    };
    img.src = url;
  }, []);

  const onFileInput = (e) => handleFile(e.target.files[0]);

  // ── Drag and drop ────────────────────────────────────────────────────────
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // ── Run prediction ───────────────────────────────────────────────────────
  const runPrediction = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const res = await fetch(`${AI_URL}/predict`, {
        method : "POST",
        body   : formData,
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Prediction failed.");
        return;
      }

      setResult(data);
    } catch (err) {
      setError("Cannot connect to AI service. Make sure app.py is running on port 5050.");
    } finally {
      setLoading(false);
    }
  };

  // ── Clear ────────────────────────────────────────────────────────────────
  const clear = () => {
    setImage(null);
    setImageFile(null);
    setResult(null);
    setError(null);
    setServiceOk(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800"
              style={{ fontFamily: "'Playfair Display', serif" }}>
              Medical Analysis
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Skin Disease Classifier
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Service status — always visible */}
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
              serviceOk === null  ? "bg-gray-100 text-gray-500" :
              serviceOk === true  ? "bg-green-50 text-green-700 border border-green-200" :
                                    "bg-red-50 text-red-700 border border-red-200"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                serviceOk === null ? "bg-gray-400 animate-pulse" :
                serviceOk ? "bg-green-500" : "bg-red-500"
              }`}/>
              {serviceOk === null ? "Checking…" : serviceOk ? "Service Online" : "Service Offline"}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
              AI Module
            </span>
          </div>
        </div>

        {/* Offline warning */}
        {serviceOk === false && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <strong>AI Service Offline.</strong> Run <code className="bg-red-100 px-1 rounded">python app.py</code> in your terminal to start the prediction service on port 5050.
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── Left: Upload panel ── */}
          <div className="space-y-4">
            <div
              className={`bg-white rounded-2xl border-2 border-dashed transition-colors cursor-pointer
                ${dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
              style={{ minHeight: 320 }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {image ? (
                <div className="relative w-full h-full p-3">
                  <img
                    src={image}
                    alt="Uploaded skin image"
                    className="w-full rounded-xl object-cover"
                    style={{ maxHeight: 300 }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); clear(); }}
                    className="absolute top-5 right-5 w-7 h-7 rounded-full bg-white shadow text-gray-500 hover:text-red-500 flex items-center justify-center text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center h-full" style={{ minHeight: 300 }}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: "linear-gradient(135deg, #E3F2FD, #E0F7FA)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth={1.5} className="w-8 h-8">
                      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Drop skin image here</p>
                  <p className="text-xs text-gray-400">or click to browse — JPG, PNG, BMP, WebP</p>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/bmp,image/webp"
              className="hidden"
              onChange={onFileInput}
            />

            {/* Analyse button */}
            <button
              onClick={runPrediction}
              disabled={!imageFile || loading}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
                  </svg>
                  Analysing...
                </span>
              ) : "Run Analysis"}
            </button>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            {/* Instructions */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Instructions</p>
              <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                <li>Upload a clear, well-lit close-up of the skin lesion</li>
                <li>Avoid blurry or partially cropped images</li>
                <li>Results are AI-assisted — always apply clinical judgment</li>
              </ul>
            </div>
          </div>

          {/* ── Right: Results panel ── */}
          <div className="space-y-4">
            {!result && !loading && (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-12 text-center"
                style={{ minHeight: 320 }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, #F3E5F5, #EDE7F6)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#7B1FA2" strokeWidth={1.5} className="w-7 h-7">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-1">No results yet</p>
                <p className="text-xs text-gray-400">Upload an image and click Run Analysis</p>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center p-12 text-center"
                style={{ minHeight: 320 }}>
                <div className="w-14 h-14 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin mb-4" />
                <p className="text-sm font-semibold text-gray-600">Running SE-ResNet analysis...</p>
                <p className="text-xs text-gray-400 mt-1">This usually takes 1–3 seconds</p>
              </div>
            )}

            {result && (
              <>
                {/* Primary prediction card */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Prediction</p>
                      <h2 className="text-xl font-bold text-gray-800"
                        style={{ fontFamily: "'Playfair Display', serif" }}>
                        {result.prediction}
                      </h2>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 mb-1">Confidence</p>
                      <p className="text-2xl font-bold"
                        style={{ color: result.confidence >= 80 ? "#1565C0" : result.confidence >= 60 ? "#E65100" : "#C62828" }}>
                        {result.confidence}%
                      </p>
                    </div>
                  </div>
                  <SeverityBadge prediction={result.prediction} />
                  <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                    This result is AI-assisted. Clinical examination and dermatological expertise should guide final diagnosis.
                  </p>
                </div>

                {/* Top 3 confidence scores */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    Top Class Probabilities
                  </p>
                  <div className="space-y-3">
                    {result.class_scores.slice(0, 5).map((s, i) => (
                      <ConfidenceBar key={s.class} label={s.class} value={s.confidence} rank={i} />
                    ))}
                  </div>
                </div>

                {/* Model info */}
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-2">
                  {[
                    { label: "Architecture", value: "SE-ResNet18" },
                    { label: "Accuracy",  value: "92.07%" },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <p className="text-xs text-gray-400">{item.label}</p>
                      <p className="text-sm font-bold text-gray-700 mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>
  );
}