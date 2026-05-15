import { useState, useRef, useEffect, useCallback } from "react";
import { sendRAGMessage, checkRAGHealth } from "../../services/ragService";

// ── Typewriter speed (ms per character) ─────────────────────────────────
const TYPEWRITER_SPEED = 8;   // lower = faster

// ── Intent badge config ──────────────────────────────────────────────────
const INTENT_CONFIG = {
  qa:            { label: "Clinical Q&A",   color: "#1565C0", bg: "#E3F2FD" },
  summary_page:  { label: "Page Summary",   color: "#7B1FA2", bg: "#F3E5F5" },
  summary_topic: { label: "Topic Summary",  color: "#00897B", bg: "#E0F2F1" },
  error:         { label: "Error",          color: "#C62828", bg: "#FFEBEE" },
};

// ── Quick-prompt suggestions ─────────────────────────────────────────────
const SUGGESTIONS = [
  { text: "What is the definition of hypertension?",       icon: "🩺" },
  { text: "First-line treatment for Grade 2 hypertension", icon: "💊" },
  { text: "Summarize page 12",                             icon: "📄" },
  { text: "BP targets for diabetic patients",              icon: "🎯" },
  { text: "Summary of lifestyle interventions",            icon: "🏃" },
  { text: "When should I refer to a specialist?",          icon: "🏥" },
];

// ── Blinking cursor ──────────────────────────────────────────────────────
function Cursor() {
  return (
    <>
      <span
        className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 align-middle"
        style={{ animation: "cursorBlink 0.8s step-end infinite" }}
      />
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </>
  );
}

// ── Typing dots (while waiting for API) ─────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-gray-400 inline-block"
          style={{
            animation: "ragBounce 1.2s infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes ragBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40%            { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Render text with line-break support ─────────────────────────────────
function TextContent({ text, isTyping }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
      {isTyping && <Cursor />}
    </>
  );
}

// ── Single message bubble ────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const cfg    = INTENT_CONFIG[msg.intent] ?? null;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>

      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm"
        style={{
          background: isUser
            ? "linear-gradient(135deg, #1565C0, #00ACC1)"
            : "linear-gradient(135deg, #0D2137, #1565C0)",
        }}
      >
        {isUser ? "DR" : "AI"}
      </div>

      {/* Bubble */}
      <div className={`max-w-[78%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>

        {/* Intent badge — fades in only after typing is done */}
        {!isUser && cfg && !msg.isTyping && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full border self-start"
            style={{
              color: cfg.color,
              background: cfg.bg,
              borderColor: `${cfg.color}30`,
              animation: "badgeFadeIn 0.3s ease",
            }}
          >
            {cfg.label}
            <style>{`
              @keyframes badgeFadeIn {
                from { opacity: 0; transform: translateY(-4px); }
                to   { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </span>
        )}

        {/* Text bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isUser
              ? "text-white rounded-tr-sm"
              : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm"
          }`}
          style={isUser ? { background: "linear-gradient(135deg, #1565C0, #00ACC1)" } : {}}
        >
          <TextContent text={msg.displayed} isTyping={!!msg.isTyping} />
        </div>

        {/* Source pages + timestamp — appear only after typing is done */}
        {!msg.isTyping && (
          <div
            className={`flex items-center gap-2 flex-wrap ${isUser ? "flex-row-reverse" : ""}`}
            style={{ animation: "badgeFadeIn 0.4s ease" }}
          >
            {!isUser && msg.sources?.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
                </svg>
                Page{msg.sources.length > 1 ? "s" : ""} {msg.sources.join(", ")}
              </span>
            )}
            <span className="text-[10px] text-gray-400">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Main Page Component
// ════════════════════════════════════════════════════════════════
export default function DoctorRAGAssistant() {
  const [messages, setMessages]               = useState([]);
  const [history, setHistory]                 = useState([]);
  const [input, setInput]                     = useState("");
  const [isFetching, setIsFetching]           = useState(false);  // waiting for API
  const [isTyping, setIsTyping]               = useState(false);  // typewriter running
  const [ragOnline, setRagOnline]             = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const typeTimerRef = useRef(null);  // setInterval handle for typewriter

  // ── Health check ──────────────────────────────────────────
  useEffect(() => {
    checkRAGHealth().then(setRagOnline);
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isFetching]);

  // ── Cleanup typewriter on unmount ─────────────────────────
  useEffect(() => () => clearInterval(typeTimerRef.current), []);

  // ── Typewriter engine ─────────────────────────────────────
  // Gets the full reply from API and reveals it character by character.
  const runTypewriter = useCallback((fullText, intent, sources, updatedHistory) => {
    const msgId   = Date.now();
    let   charIdx = 0;

    // Insert the assistant bubble immediately with empty text
    setMessages((prev) => [
      ...prev,
      {
        id:        msgId,
        role:      "assistant",
        displayed: "",        // grows one char at a time
        content:   fullText,
        intent,
        sources,
        timestamp: msgId,
        isTyping:  true,
      },
    ]);
    setIsTyping(true);

    typeTimerRef.current = setInterval(() => {
      charIdx += 1;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, displayed: fullText.slice(0, charIdx) }
            : m
        )
      );

      bottomRef.current?.scrollIntoView({ behavior: "smooth" });

      if (charIdx >= fullText.length) {
        clearInterval(typeTimerRef.current);

        // Mark complete — this triggers badge + sources to fade in
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, displayed: fullText, isTyping: false }
              : m
          )
        );

        setIsTyping(false);
        setHistory(updatedHistory);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }, TYPEWRITER_SPEED);
  }, []);

  // ── Send message ──────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    const query = (text || input).trim();
    if (!query || isFetching || isTyping) return;

    setInput("");
    setShowSuggestions(false);

    // User bubble (instant, no typewriter)
    setMessages((prev) => [
      ...prev,
      {
        id:        Date.now(),
        role:      "user",
        displayed: query,
        content:   query,
        timestamp: Date.now(),
      },
    ]);
    setIsFetching(true);

    try {
      const data = await sendRAGMessage(query, history);
      setIsFetching(false);
      // Hand full reply to typewriter
      runTypewriter(
        data.reply,
        data.intent,
        data.sources || [],
        data.conversation_history
      );
    } catch (err) {
      setIsFetching(false);
      const errText = `⚠️ ${err.message || "Failed to reach the RAG API. Make sure it is running on port 8000."}`;
      // Errors appear instantly without typewriter
      setMessages((prev) => [
        ...prev,
        {
          id:        Date.now(),
          role:      "assistant",
          displayed: errText,
          content:   errText,
          intent:    "error",
          sources:   [],
          timestamp: Date.now(),
          isTyping:  false,
        },
      ]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, history, isFetching, isTyping, runTypewriter]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    clearInterval(typeTimerRef.current);
    setMessages([]);
    setHistory([]);
    setIsTyping(false);
    setIsFetching(false);
    setShowSuggestions(true);
    inputRef.current?.focus();
  };

  // Disable UI while fetching OR while typewriter is running
  const isBusy = isFetching || isTyping;

  // ── Status dot ────────────────────────────────────────────
  const StatusDot = () => (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${
        ragOnline === null ? "bg-amber-400 animate-pulse" :
        ragOnline          ? "bg-green-400 animate-pulse" :
                             "bg-red-400"
      }`} />
      <span className="text-xs text-gray-400">
        {ragOnline === null ? "Connecting…" : ragOnline ? "Online" : "Offline"}
      </span>
    </div>
  );

  return (
      <div className="flex flex-col h-[calc(100vh-73px)]">

        {/* ── Top bar ──────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg, #0D2137, #1565C0)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5">
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10m-10 0v4a2 2 0 002 2h4"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
                <line x1="9"  y1="21" x2="15" y2="21"/>
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Hypertension Clinical Assistant</h2>
              <p className="text-xs text-gray-400">Sri Lanka National Hypertension Guidelines 2021</p>
            </div>
            <span className="text-xs bg-cyan-500 text-white px-2 py-0.5 rounded-full font-bold ml-1">AI</span>
          </div>

          <div className="flex items-center gap-4">
            <StatusDot />
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition px-3 py-1.5 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-100"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                Clear Chat
              </button>
            )}
          </div>
        </div>

        {/* ── Offline banner ────────────────────────────────── */}
        {ragOnline === false && (
          <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 bg-red-50 border-b border-red-100">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500 flex-shrink-0">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <span className="text-sm text-red-700 font-medium">
              RAG API is offline. Run{" "}
              <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono text-xs">
                uvicorn rag_api:app --port 8000
              </code>{" "}
              to start it.
            </span>
          </div>
        )}

        {/* ── Messages ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-md"
                style={{ background: "linear-gradient(135deg, #0D2137 0%, #1565C0 60%, #00ACC1 100%)" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-8 h-8">
                  <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10m-10 0v4a2 2 0 002 2h4"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                  <line x1="9"  y1="21" x2="15" y2="21"/>
                </svg>
              </div>
              <h3
                className="text-xl font-bold text-gray-800 mb-1"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Clinical Guideline Assistant
              </h3>
              <p className="text-gray-400 text-sm max-w-md">
                Ask clinical questions about hypertension management, or request page and topic summaries
                from the Sri Lanka National Hypertension Guidelines 2021.
              </p>

              {showSuggestions && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-6 max-w-xl w-full">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.text}
                      onClick={() => handleSend(s.text)}
                      disabled={isBusy || !ragOnline}
                      className="flex items-start gap-2 p-3 rounded-xl bg-white border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 text-left transition shadow-sm group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-base flex-shrink-0">{s.icon}</span>
                      <span className="text-xs text-gray-600 group-hover:text-blue-700 font-medium leading-snug">
                        {s.text}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {/* Bouncing dots — only while waiting for the API response */}
          {isFetching && (
            <div className="flex gap-3">
              <div
                className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm"
                style={{ background: "linear-gradient(135deg, #0D2137, #1565C0)" }}
              >
                AI
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ─────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-4">

          {/* Compact suggestion pills — shown after first message */}
          {messages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
              {SUGGESTIONS.slice(0, 4).map((s) => (
                <button
                  key={s.text}
                  onClick={() => handleSend(s.text)}
                  disabled={isBusy || !ragOnline}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-xs text-gray-600 hover:text-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                >
                  <span>{s.icon}</span>
                  {s.text.length > 30 ? s.text.slice(0, 30) + "…" : s.text}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isBusy || !ragOnline}
              placeholder={
                ragOnline === false  ? "RAG API is offline…"      :
                isFetching           ? "Waiting for response…"    :
                isTyping             ? "Generating response…"     :
                'Ask a clinical question or try "summarize page 12"…'
              }
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:cursor-not-allowed"
            />

            <button
              onClick={() => handleSend()}
              disabled={isBusy || !input.trim() || !ragOnline}
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}
              title="Send (Enter)"
            >
              {isFetching ? (
                /* Spinner — waiting for API */
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                  <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : isTyping ? (
                /* Pulsing dot — typewriter is running */
                <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              ) : (
                /* Send arrow */
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                </svg>
              )}
            </button>
          </div>

          <p className="text-[10px] text-gray-400 mt-2 text-center">
            Responses are based solely on the Sri Lanka National Hypertension Guidelines 2021 · Not a substitute for clinical judgment
          </p>
        </div>

      </div>
  );
}