import { useState, useEffect, useRef } from "react";
import axios from "axios";

const fontStyle = document.createElement("link");
fontStyle.rel = "stylesheet";
fontStyle.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontStyle);

const API = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const NAV_LINKS = [
  { label: "Home",       href: "#home"     },
  { label: "About",      href: "#about"        },
  { label: "Services",   href: "#services"     },
  { label: "Our Doctor", href: "#doctor"       },
  { label: "Testimonials", href: "#testimonials" },
  { label: "Contact",    href: "#contact"      },
];

const SERVICES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75" />
      </svg>
    ),
    title: "Medical Consultations",
    desc: "Comprehensive consultations with our experienced physician, with personalized care plans tailored to your health needs.",
    color: "#1565C0",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "Pharmacy Services",
    desc: "Full-service in-house pharmacy ensuring you receive prescribed medications promptly with expert pharmaceutical guidance.",
    color: "#00897B",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
    title: "Laboratory & Diagnostics",
    desc: "Advanced laboratory testing and ECG services providing accurate diagnostic results to support informed medical decisions.",
    color: "#7B1FA2",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: "Appointment Scheduling",
    desc: "Convenient appointment booking with flexible scheduling options, ensuring you get timely access to medical care.",
    color: "#E65100",
  },
];

// ── Slideshow slides ──────────────────────────────────────────
const SLIDES = [
  {
    emoji: "🏥",
    title: "Your Health Records, Always With You",
    desc: "Access your prescriptions, lab results, and appointment history anytime — all in one secure place.",
    cta: "Create Your Account",
    bg: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  {
    emoji: "💊",
    title: "Digital Prescriptions Sent Instantly",
    desc: "No more paper prescriptions. Your doctor sends them directly to the pharmacy — ready when you arrive.",
    cta: "Sign Up Free",
    bg: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  {
    emoji: "🧪",
    title: "Lab Results in Your Pocket",
    desc: "Get notified the moment your lab results are ready. View detailed reports from your phone or computer.",
    cta: "Get Started Today",
    bg: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  {
    emoji: "📅",
    title: "Book Appointments in Seconds",
    desc: "Skip the phone queue. Book, reschedule, or cancel appointments online — whenever it suits you.",
    cta: "Register Now",
    bg: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
  },
];

function Slideshow({ dark = false }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  const go = (idx) => setCurrent((idx + SLIDES.length) % SLIDES.length);

  useEffect(() => {
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 4500);
    return () => clearInterval(timerRef.current);
  }, []);

  const slide = SLIDES[current];

  return (
    <div>
      {/* Slide card */}
      <div
        key={current}
        className="rounded-3xl p-8 relative overflow-hidden shadow-2xl"
        style={{ background: slide.bg, border: slide.border, minHeight: 240, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-48 opacity-10 pointer-events-none">
          <svg viewBox="0 0 200 300" fill="white"><circle cx="180" cy="80" r="120"/><circle cx="50" cy="250" r="80"/></svg>
        </div>
        <div className="relative flex items-start gap-5">
          <div className="text-5xl flex-shrink-0 select-none mt-1">{slide.emoji}</div>
          <div className="flex-1">
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.15rem", color: "white", lineHeight: 1.3 }}>
              {slide.title}
            </h3>
            <p className="mt-2 text-white/75 leading-relaxed text-sm">{slide.desc}</p>
            <a
              href="/register"
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg transition-all hover:scale-105"
              style={{ background: "white", color: "#0D2137" }}
            >
              {slide.cta}
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Dots + arrows */}
      <div className="flex items-center justify-center gap-4 mt-5">
        <button onClick={() => go(current - 1)}
          className="w-8 h-8 rounded-full flex items-center justify-center transition"
          style={{ background: dark ? "rgba(255,255,255,0.1)" : "white", border: dark ? "1px solid rgba(255,255,255,0.2)" : "1px solid #e5e7eb" }}>
          <svg viewBox="0 0 20 20" fill={dark ? "white" : "#6B7280"} className="w-4 h-4">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/>
          </svg>
        </button>
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => go(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? 28 : 8,
                height: 8,
                background: i === current ? (dark ? "white" : "#1565C0") : (dark ? "rgba(255,255,255,0.3)" : "#CBD5E1"),
              }}
            />
          ))}
        </div>
        <button onClick={() => go(current + 1)}
          className="w-8 h-8 rounded-full flex items-center justify-center transition"
          style={{ background: dark ? "rgba(255,255,255,0.1)" : "white", border: dark ? "1px solid rgba(255,255,255,0.2)" : "1px solid #e5e7eb" }}>
          <svg viewBox="0 0 20 20" fill={dark ? "white" : "#6B7280"} className="w-4 h-4">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>

      <p className="text-center mt-4 text-xs" style={{ color: dark ? "rgba(255,255,255,0.4)" : "#9CA3AF" }}>
        Already have an account? <a href="/login" className="underline hover:opacity-80" style={{ color: dark ? "rgba(255,255,255,0.7)" : "#1565C0" }}>Login here</a>
      </p>
    </div>
  );
}

// ── QUICK-REPLY SUGGESTIONS ──────────────────────────────────────
const QUICK_REPLIES = [
  "How do I book an appointment?",
  "How can I view my lab results?",
  "Where can I see my prescriptions?",
  "How do I cancel an appointment?",
  "How do I check my bills?",
];

// ── CHATBOT FLOATING WIDGET ──────────────────────────────────────
function ChatBot({ apiBase }) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "👋 Hello! I'm your navigation assistant for People's Health Care. Ask me anything about the system.",
    },
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef           = useRef(null);
  const inputRef            = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setUnread(0);
    }
  }, [open]);

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);
    try {
      const res = await axios.post(`${apiBase}/chatbot/message`, { message: userText });
      const botReply = res.data.reply || "I'm sorry, I couldn't process that. Please try again.";
      setMessages(prev => [...prev, { role: "bot", text: botReply }]);
      if (!open) setUnread(n => n + 1);
    } catch {
      setMessages(prev => [...prev, { role: "bot", text: "Sorry, the assistant is temporarily unavailable. Please try again shortly." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      <style>{`
        @keyframes chatSlideUp { from { opacity:0; transform:translateY(16px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes botDot { 0%,80%,100% { transform:scale(0.6); opacity:0.4; } 40% { transform:scale(1); opacity:1; } }
      `}</style>

      {open && (
        <div style={{ position:"fixed", bottom:96, right:24, zIndex:1000, width:"min(370px, calc(100vw - 48px))", borderRadius:20, background:"white", boxShadow:"0 20px 60px rgba(13,33,55,0.18)", display:"flex", flexDirection:"column", overflow:"hidden", animation:"chatSlideUp 0.22s ease" }}>
          {/* Header */}
          <div style={{ background:"linear-gradient(135deg,#0D2137,#1565C0)", padding:"15px 18px", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:11, background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>🏥</div>
            <div style={{ flex:1 }}>
              <div style={{ color:"white", fontWeight:700, fontSize:13.5, fontFamily:"'Playfair Display', serif" }}>PHC Navigation Assistant</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#4ADE80" }}/>
                <span style={{ color:"rgba(255,255,255,0.7)", fontSize:10.5 }}>Online — ask me anything</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:8, width:28, height:28, cursor:"pointer", color:"white", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", padding:"14px 14px 8px", maxHeight:300, display:"flex", flexDirection:"column", gap:10, background:"#FAFBFD" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display:"flex", justifyContent:msg.role==="user"?"flex-end":"flex-start", gap:7, alignItems:"flex-end" }}>
                {msg.role==="bot" && <div style={{ width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,#1565C0,#00ACC1)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>🤖</div>}
                <div style={{ maxWidth:"76%", padding:"9px 13px", borderRadius:msg.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px", background:msg.role==="user"?"linear-gradient(135deg,#1565C0,#00ACC1)":"white", color:msg.role==="user"?"white":"#1E293B", fontSize:13, lineHeight:1.55, whiteSpace:"pre-wrap", wordBreak:"break-word", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:"flex", alignItems:"flex-end", gap:7 }}>
                <div style={{ width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,#1565C0,#00ACC1)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>🤖</div>
                <div style={{ background:"white", borderRadius:"16px 16px 16px 4px", padding:"10px 14px", display:"flex", gap:5, alignItems:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
                  {[0,0.2,0.4].map((d,i)=><div key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#94A3B8", animation:`botDot 1.2s ${d}s infinite` }}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Quick replies */}
          {messages.length <= 2 && !loading && (
            <div style={{ padding:"0 14px 8px", display:"flex", flexWrap:"wrap", gap:5, background:"#FAFBFD" }}>
              {QUICK_REPLIES.slice(0,3).map((q,i) => (
                <button key={i} onClick={() => sendMessage(q)} style={{ fontSize:11, padding:"4px 10px", borderRadius:20, border:"1px solid #CBD5E1", background:"white", color:"#1565C0", cursor:"pointer", fontWeight:500 }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding:"10px 14px 14px", borderTop:"1px solid #E2E8F0", display:"flex", gap:8, alignItems:"flex-end" }}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ask about appointments, results…" rows={1} style={{ flex:1, resize:"none", border:"1.5px solid #E2E8F0", borderRadius:11, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none", lineHeight:1.5, maxHeight:72, overflowY:"auto", color:"#0F172A" }} onFocus={e=>e.target.style.borderColor="#1565C0"} onBlur={e=>e.target.style.borderColor="#E2E8F0"}/>
            <button onClick={()=>sendMessage()} disabled={!input.trim()||loading} style={{ width:36, height:36, borderRadius:11, border:"none", cursor:input.trim()&&!loading?"pointer":"not-allowed", background:input.trim()&&!loading?"linear-gradient(135deg,#1565C0,#00ACC1)":"#E2E8F0", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg viewBox="0 0 20 20" fill={input.trim()&&!loading?"white":"#94A3B8"} style={{ width:15, height:15 }}>
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={()=>setOpen(o=>!o)} style={{ position:"fixed", bottom:28, right:24, zIndex:1001, width:56, height:56, borderRadius:"50%", border:"none", cursor:"pointer", background:open?"#0D2137":"linear-gradient(135deg,#1565C0,#00ACC1)", boxShadow:"0 8px 28px rgba(21,101,192,0.4)", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.22s", transform:open?"rotate(45deg)":"rotate(0deg)" }} title={open?"Close chat":"Ask navigation assistant"}>
        {open
          ? <svg viewBox="0 0 20 20" fill="white" style={{ width:20, height:20 }}><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          : <svg viewBox="0 0 24 24" fill="white" style={{ width:24, height:24 }}><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.06L2 22l4.94-1.37C8.42 21.5 10.15 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 13H7v-2h4v2zm6 0h-4v-2h4v2zm0-4H7V9h10v2z"/></svg>
        }
        {!open && unread > 0 && <div style={{ position:"absolute", top:-3, right:-3, background:"#EF4444", color:"white", borderRadius:"50%", width:19, height:19, fontSize:10.5, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid white" }}>{unread}</div>}
      </button>
    </>
  );
}

export default function Index() {
  const [scrolled, setScrolled]         = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [doctor, setDoctor]             = useState(null);
  const [testimonials, setTestimonials] = useState([]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fetch live doctor data
  useEffect(() => {
    axios.get(`${API}/public/doctor`)
      .then(res => { if (res.data.doctor) setDoctor(res.data.doctor); })
      .catch(() => {}); // silently fall back to static data
  }, []);

  // Fetch mixed-rating feedback for testimonials section
  useEffect(() => {
    axios.get(`${API}/feedback/public/mixed`)
      .then(res => {
        const all = res.data.feedbacks || [];
        setTestimonials(all);
      })
      .catch(() => {});
  }, []);

  const doctorName = doctor?.name || "Dr. M.T.D. Jayaweera";
  const doctorExp  = doctor?.doctorDetails?.workingExperience || "15+";
  const doctorPhone = doctor?.telephone || "0777 883 343";
  const doctorPhoto = doctor?.photo || null;

  // Dynamic stats using live doctor experience
  const STATS = [
    { number: "5000+", label: "Patients Treated" },
    { number: doctorExp.toString().includes("+") ? doctorExp : `${doctorExp}+`, label: "Years of Experience" },
    { number: "98%",   label: "Patient Satisfaction" },
    { number: "24/7",  label: "Emergency Support" },
  ];

  // Clinic session status
  // Morning: 7:00 - 8:00 | Evening: 17:00 - 20:00
  const getClinicStatus = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const total = h * 60 + m;
    const morningStart = 7 * 60, morningEnd = 8 * 60;
    const eveningStart = 17 * 60, eveningEnd = 20 * 60;
    if (total >= morningStart && total < morningEnd) return { open: true, label: "Open Now", sub: "Morning Session" };
    if (total >= eveningStart && total < eveningEnd) return { open: true, label: "Open Now", sub: "Evening Session" };
    // Next session
    if (total < morningStart) return { open: false, label: "Opens at 7:00 AM", sub: "Morning Session" };
    if (total >= morningEnd && total < eveningStart) return { open: false, label: "Opens at 5:00 PM", sub: "Evening Session" };
    return { open: false, label: "Opens Tomorrow 7 AM", sub: "Morning Session" };
  };
  const clinicStatus = getClinicStatus();

  return (
    <>
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="bg-white text-gray-800">

      {/* ── NAVBAR ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-white shadow-lg py-3" : "bg-transparent py-5"}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden">
              <img src="/Logo.png" alt="PHC" className="w-full h-full object-contain" />
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: scrolled ? "#0D2137" : "white", fontSize: "1.1rem", lineHeight: 1 }}>
                People's Health Care
              </div>
              <div style={{ fontSize: "0.65rem", color: scrolled ? "#64748b" : "rgba(255,255,255,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Medical Centre
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(link => (
              <a key={link.label} href={link.href}
                className="text-sm font-medium transition-colors duration-200 hover:opacity-80"
                style={{ color: scrolled ? "#0D2137" : "white" }}>
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg border transition-all duration-200"
              style={{ borderColor: scrolled ? "#1565C0" : "rgba(255,255,255,0.6)", color: scrolled ? "#1565C0" : "white" }}>
              Login
            </a>
            <a href="/register"
              className="text-sm font-semibold px-5 py-2.5 rounded-lg text-white shadow-lg transition-transform duration-200 hover:scale-105"
              style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
              Book Appointment
            </a>
          </div>

          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            <div className={`w-6 h-0.5 mb-1.5 transition-all ${scrolled ? "bg-gray-800" : "bg-white"}`}/>
            <div className={`w-6 h-0.5 mb-1.5 transition-all ${scrolled ? "bg-gray-800" : "bg-white"}`}/>
            <div className={`w-6 h-0.5 transition-all ${scrolled ? "bg-gray-800" : "bg-white"}`}/>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-white shadow-xl px-6 py-4 mt-2">
            {NAV_LINKS.map(link => (
              <a key={link.label} href={link.href} className="block py-2.5 text-gray-700 font-medium border-b border-gray-100 text-sm">{link.label}</a>
            ))}
            <a href="/register" className="block mt-3 text-center py-2.5 rounded-lg text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
              Book Appointment
            </a>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section id="home" className="relative min-h-screen flex items-center overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0D2137 0%, #1565C0 50%, #00ACC1 100%)" }}>
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>
        </div>
        <div className="absolute top-20 right-10 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #00ACC1, transparent)" }}/>
        <div className="absolute bottom-0 left-20 w-64 h-64 rounded-full opacity-10" style={{ background: "radial-gradient(circle, white, transparent)" }}/>

        <div className="relative max-w-7xl mx-auto px-6 py-32 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-white/90 text-sm font-medium">Currently Accepting Patients</span>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "clamp(2.2rem, 5vw, 3.8rem)", lineHeight: 1.15, color: "white" }}>
              Your Health, Our<br/><span style={{ color: "#7DD3FC" }}>Sacred Commitment</span>
            </h1>
            <p className="mt-6 text-white/80 text-lg leading-relaxed max-w-md">
              Delivering compassionate, comprehensive healthcare with a personal touch. Experience trusted medical care for your entire family at People's Health Care.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="/register"
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold shadow-2xl transition-all duration-300 hover:scale-105"
                style={{ background: "linear-gradient(135deg, #00ACC1, #007bff)" }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                </svg>
                Book Appointment
              </a>
              <a href="#services"
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold border-2 border-white/40 text-white transition-all duration-300 hover:bg-white/10">
                Explore Services
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              {["Mon – Sat: 7:00AM – 8:00AM  |  5:00PM – 8:00PM", "Emergency: 24/7", "No 123 Matara - Akuressa Hwy, Matara"].map(item => (
                <div key={item} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-300"/>
                  <span className="text-white/80 text-xs">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden md:block">
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl">
                <div className="grid grid-cols-2 gap-6">
                  {STATS.map(stat => (
                    <div key={stat.label} className="text-center p-4 bg-white/10 rounded-2xl border border-white/10">
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "2rem", color: "#7DD3FC" }}>{stat.number}</div>
                      <div className="text-white/70 text-sm mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-white/10 rounded-2xl border border-white/10 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden">
                    <img src="/Logo.png" alt="PHC" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">People's Health Care</div>
                    <div className="text-white/60 text-xs">No 123 Matara - Akuressa Hwy, Matara</div>
                  </div>
                </div>
              </div>
              <div className={`absolute -top-4 -right-4 text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 ${clinicStatus.open ? "bg-green-400 text-green-900" : "bg-orange-400 text-orange-900"}`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${clinicStatus.open ? "bg-green-700" : "bg-orange-700"}`}/>
                {clinicStatus.label}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="white" preserveAspectRatio="none" className="w-full h-16">
            <path d="M0,40 C240,80 480,0 720,40 C960,80 1200,0 1440,40 L1440,80 L0,80 Z"/>
          </svg>
        </div>
      </section>

      {/* ── WHY CHOOSE US ── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#00ACC1" }}>Why Choose Us</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "clamp(1.8rem, 3vw, 2.8rem)", color: "#0D2137" }}>
              Healthcare Built on Trust & Excellence
            </h2>
            <div className="w-16 h-1 mx-auto mt-4 rounded-full" style={{ background: "linear-gradient(90deg, #1565C0, #00ACC1)" }}/>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: "🏥", title: "Integrated Care",         desc: "From consultation to prescription and lab testing — everything happens seamlessly under one roof." },
              { icon: "👨‍⚕️", title: "Expert Physician",      desc: "Benefit from the experience and dedication of Dr. M.T.D. Jayaweera, who personally oversees every aspect of your care." },
              { icon: "🔬", title: "Advanced Diagnostics",    desc: "State-of-the-art laboratory and ECG facilities ensuring accurate and timely diagnostic results." },
              { icon: "💊", title: "In-House Pharmacy",       desc: "Get your prescriptions filled immediately without the hassle of visiting an external pharmacy." },
              { icon: "📋", title: "Complete Health Records", desc: "Your medical history, test results, and prescriptions are securely maintained and easily accessible." },
              { icon: "⚡", title: "Fast & Efficient",        desc: "Streamlined processes minimize your waiting time so you can focus on what matters — your recovery." },
            ].map(item => (
              <div key={item.title} className="group p-6 rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: "#0D2137" }}>{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="py-24" style={{ background: "linear-gradient(180deg, #F0F7FF 0%, #E3F2FD 100%)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#00ACC1" }}>Our Services</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "clamp(1.8rem, 3vw, 2.8rem)", color: "#0D2137" }}>
              Comprehensive Medical Services
            </h2>
            <div className="w-16 h-1 mx-auto mt-4 rounded-full" style={{ background: "linear-gradient(90deg, #1565C0, #00ACC1)" }}/>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map(service => (
              <div key={service.title} className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-2xl transition-all duration-400 hover:-translate-y-2 cursor-pointer">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${service.color}18`, color: service.color }}>
                  {service.icon}
                </div>
                <h3 className="font-semibold text-base mb-3" style={{ color: "#0D2137" }}>{service.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{service.desc}</p>
                <div className="mt-4 text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ color: service.color }}>
                  Learn more
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOCTOR / ABOUT ── */}
      <section id="doctor" className="py-24 bg-white" style={{ scrollMarginTop: 80 }}>
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          {/* Doctor card — live data */}
          <div className="relative">
            <div className="rounded-3xl overflow-hidden shadow-2xl" style={{ background: "linear-gradient(135deg, #0D2137, #1565C0)" }}>
              <div className="p-10 text-white text-center">
                <div className="w-32 h-32 rounded-full mx-auto mb-6 border-4 border-white/30 flex items-center justify-center overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.15)" }}>
                  {doctorPhoto
                    ? <img src={doctorPhoto} alt={doctorName} className="w-full h-full object-cover"/>
                    : <span className="text-6xl">👨‍⚕️</span>
                  }
                </div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.6rem" }}>{doctorName}</h3>
                <p className="text-blue-200 mt-1 text-sm">Founder & Chief Physician</p>
                <p className="text-blue-200 mt-0.5 text-xs">People's Health Care, Matara</p>
                <div className="mt-6 grid grid-cols-3 gap-4">
                  {[{ n: doctorExp.includes("+") ? doctorExp : `${doctorExp}+`, l: "Years Exp." }, { n: "5K+", l: "Patients" }, { n: "98%", l: "Satisfaction" }].map(s => (
                    <div key={s.l} className="bg-white/10 rounded-xl p-3">
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.3rem", color: "#7DD3FC" }}>{s.n}</div>
                      <div className="text-white/60 text-xs mt-0.5">{s.l}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 space-y-2 text-left">
                  {["General Medicine", "Preventive Healthcare", "Chronic Disease Management", "Family Health"].map(spec => (
                    <div key={spec} className="flex items-center gap-2 text-sm text-white/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-300"/>
                      {spec}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white shadow-xl rounded-2xl px-6 py-3 flex items-center gap-3 whitespace-nowrap">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#E3F2FD" }}>
                <svg viewBox="0 0 20 20" fill="#1565C0" className="w-5 h-5">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                </svg>
              </div>
              <div>
                <div className="text-xs text-gray-400">Call for Emergencies</div>
                <div className="text-sm font-bold text-gray-800">{doctorPhone}</div>
              </div>
            </div>
          </div>

          {/* About text */}
          <div className="pt-6" id="about">
            <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#00ACC1" }}>About Our Medical Centre</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "clamp(1.6rem, 2.5vw, 2.4rem)", color: "#0D2137", lineHeight: 1.3 }}>
              A Legacy of Compassionate Healthcare
            </h2>
            <div className="w-12 h-1 mt-4 mb-6 rounded-full" style={{ background: "linear-gradient(90deg, #1565C0, #00ACC1)" }}/>
            <p className="text-gray-600 leading-relaxed mb-4">
              People's Health Care is a patient-first medical centre established in Matara, dedicated to delivering comprehensive, high-quality medical services to the community of Southern Sri Lanka.
            </p>
            <p className="text-gray-600 leading-relaxed mb-6">
              Under the personal guidance of Dr. M.T.D. Jayaweera, our centre integrates primary care consultations, pharmaceutical services, and advanced diagnostic testing — all designed to provide you with seamless, coordinated healthcare from a single trusted source.
            </p>
            <div className="space-y-4">
              {[
                { label: "Consultation Hours", value: "Mon – Sat: 7:00 AM – 8:00 AM  |  5:00 PM – 8:00 PM" },
                { label: "Location",           value: "No 123 Matara - Akuressa Hwy, Matara" },
                { label: "Contact",            value: "thilakjayaweera9@gmail.com" },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: "#00ACC1" }}/>
                  <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{item.label}: </span>
                    <span className="text-gray-700 text-sm">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex gap-4">
              <a href="/register"
                className="px-6 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition-transform hover:scale-105"
                style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
                Book an Appointment
              </a>
              <a href={`tel:${doctorPhone.replace(/\s/g,"")}`}
                className="px-6 py-3 rounded-xl text-sm font-semibold border-2 transition-colors hover:bg-blue-50"
                style={{ borderColor: "#1565C0", color: "#1565C0" }}>
                Call Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">

            {/* Header */}
            <div className="text-center mb-14">
              <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#00ACC1" }}>
                Patient Stories
              </p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "#0D2137" }}>
                What Our Patients Say
              </h2>
              <p className="mt-4 text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
                Real experiences from patients who trust People's Health Care for their wellbeing.
              </p>
              <div className="flex items-center justify-center gap-1 mt-4">
                <span className="ml-2 text-sm font-semibold text-gray-600">{testimonials.length} patient reviews</span>
              </div>
            </div>

            {/* Cards grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((fb, i) => {
                const date = fb.createdAt
                  ? new Date(fb.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                  : "";
                return (
                  <div key={fb._id || i}
                    className="relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col group"
                    style={{
                      border: "1px solid #e5e7eb",
                      borderTop: `3px solid ${
                        fb.rating === 5 ? "#1565C0"
                        : fb.rating === 4 ? "#10B981"
                        : fb.rating === 3 ? "#F59E0B"
                        : "#EF4444"
                      }`,
                    }}
                  >
                    {/* Big quote mark */}
                    <div className="absolute top-4 right-5 text-6xl font-serif leading-none select-none"
                      style={{ color: "#EFF6FF" }}>"</div>

                    {/* Stars */}
                    <div className="flex gap-0.5 mb-4">
                      {[1,2,3,4,5].map(s => (
                        <svg key={s} viewBox="0 0 20 20" fill={s <= fb.rating ? "#F59E0B" : "#E5E7EB"} className="w-4 h-4">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                      ))}
                      <span className="ml-1.5 text-xs font-semibold text-amber-600">{fb.rating}.0</span>
                    </div>

                    {/* Review text */}
                    <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-6 relative z-10 italic">
                      "{fb.description}"
                    </p>

                    {/* Patient footer */}
                    <div className="flex items-center pt-4 border-t border-gray-100">
                      <div className="text-xs text-gray-400">{date}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <div className="text-center mt-14">
              <p className="text-sm text-gray-400 mb-5">Join thousands of satisfied patients at People's Health Care</p>
              <a href="/login"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-white text-sm font-semibold shadow-lg hover:opacity-90 transition"
                style={{ background: "linear-gradient(135deg, #0D2137, #1565C0)" }}>
                Book Your Appointment
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT / APPOINTMENT ── */}
      <section id="contact" className="py-24 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0D2137 0%, #1565C0 100%)" }}>
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%">
            <defs><pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="1.5" fill="white"/>
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#dots)"/>
          </svg>
        </div>
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#7DD3FC" }}>Get In Touch</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "white" }}>
                Book Your Appointment Today
              </h2>
              <p className="mt-4 text-white/70 leading-relaxed">
                Contact us to schedule a consultation. Our staff will confirm your appointment and provide all necessary information.
              </p>
              <div className="mt-8 space-y-5">
                {[
                  { icon: "📍", label: "Address", value: "No 123 Matara - Akuressa Hwy, Matara" },
                  { icon: "📞", label: "Phone",   value: doctorPhone },
                  { icon: "📧", label: "Email",   value: "thilakjayaweera9@gmail.com" },
                  { icon: "🕐", label: "Hours",   value: "Mon – Sat: 7:00 AM – 8:00 AM  |  5:00 PM – 8:00 PM" },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg flex-shrink-0">{item.icon}</div>
                    <div>
                      <div className="text-white/50 text-xs uppercase tracking-wide font-medium">{item.label}</div>
                      <div className="text-white font-medium text-sm mt-0.5">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Slideshow inside contact section */}
            <div>
              <p className="text-sm font-semibold tracking-widest uppercase mb-4" style={{ color: "#7DD3FC" }}>Why Join Us</p>
              <Slideshow dark />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0A1628] py-12 text-white/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.3rem", color: "white" }}>
                People's Health Care
              </div>
              <p className="mt-3 text-sm leading-relaxed max-w-xs">
                Providing compassionate, integrated healthcare services to the community of Matara and beyond.
              </p>
              <div className="mt-4 flex gap-3">
                {[
                  { icon: "f", label: "Facebook",  href: "#" },
                  { icon: "𝕏", label: "Twitter",   href: "#" },
                  { icon: "in", label: "Instagram", href: "#" },
                ].map((s) => (
                  <a key={s.label} href={s.href} title={s.label}
                    className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center cursor-pointer hover:bg-white/20 transition text-xs font-bold text-white/60 hover:text-white">
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <div className="text-white font-semibold mb-4 text-sm">Quick Links</div>
              {[
                { label: "Home",        href: "#home"     },
                { label: "About",        href: "#about"    },
                { label: "Services",    href: "#services" },
                { label: "Our Doctor", href: "#doctor"   },
                { label: "Contact",     href: "#contact"  },
                { label: "Login",       href: "/login"    },
              ].map(link => (
                <a key={link.label} href={link.href} className="block text-sm py-1 hover:text-white transition">{link.label}</a>
              ))}
            </div>

            <div>
              <div className="text-white font-semibold mb-4 text-sm">Contact</div>
              <div className="text-sm space-y-2">
                <div>📞 {doctorPhone}</div>
                <div>✉️ thilakjayaweera9@gmail.com</div>
                <div>📍 No 123 Matara - Akuressa Hwy, Matara</div>
                <div className="flex items-start gap-1">
                  <span>🕐</span>
                  <div>
                    <div>Mon–Sat: 7:00AM–8:00AM</div>
                    <div className="pl-16">5:00PM–8:00PM</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div>© {new Date().getFullYear()} People's Health Care. All rights reserved.</div>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition">Privacy Policy</a>
              <a href="#" className="hover:text-white transition">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>

      {/* ── FLOATING CHATBOT WIDGET ── */}
      <ChatBot apiBase={API} />
    </>
  );
}
