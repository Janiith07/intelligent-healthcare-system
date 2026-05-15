import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitFeedback, getMyFeedbacks, deleteMyFeedback, getRatingDistribution } from '../../services/feedbackAPI';
import PatientLayout from '../../components/PatientLayout';

// ── Inline SVG icon replacements for lucide-react ─────────────────
const Star = ({ size = 20, style = {}, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} style={style}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const Send = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const CheckCircle = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const Clock = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const MessageSquare = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);
const Trash2 = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);
const AlertTriangle = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const Shield = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const RATING_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent' };
const RATING_COLORS = { 1: 'text-red-500', 2: 'text-orange-500', 3: 'text-yellow-500', 4: 'text-blue-500', 5: 'text-green-500' };
const RATING_HEX    = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#3b82f6', 5: '#22c55e' };
const TOPICS = ['Friendly staff', 'Clean facility', 'Short wait time', 'Good doctor', 'Easy billing', 'Clear instructions'];

/* ── Star Selector ─────────────────────────────────────────────── */
const StarSelector = ({ value, onChange, disabled }) => {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;
  return (
    <div className="flex items-center gap-2">
      {[1,2,3,4,5].map((star) => (
        <button
          key={star} type="button" disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none disabled:cursor-not-allowed transition-transform"
          style={{ transform: star <= active ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          <Star size={34}
            className="transition-colors duration-150"
            style={{
              fill: star <= active ? '#fbbf24' : 'transparent',
              color: star <= active ? '#fbbf24' : '#d1d5db',
              filter: star <= active ? 'drop-shadow(0 0 6px rgba(251,191,36,0.5))' : 'none',
            }}
          />
        </button>
      ))}
      {active > 0 && (
        <span className={`ml-2 text-sm font-bold ${RATING_COLORS[active]} bg-gray-50 px-3 py-1 rounded-full border border-gray-100`}>
          {RATING_LABELS[active]}
        </span>
      )}
    </div>
  );
};

/* ── Delete Confirm Modal ───────────────────────────────────────── */
const ConfirmDeleteModal = ({ feedbackId, onConfirm, onCancel, deleting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
          <AlertTriangle size={20} className="text-red-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Delete Feedback</h3>
          <p className="text-xs text-gray-400">{feedbackId}</p>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        This feedback will be permanently removed and cannot be recovered.
      </p>
      <div className="flex gap-3">
        <button onClick={onCancel} disabled={deleting}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={deleting}
          className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2">
          <Trash2 size={14} />
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);

/* ── Past Feedback Card ─────────────────────────────────────────── */
const MyFeedbackCard = ({ fb, onDelete }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting]       = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(fb._id);
    setDeleting(false);
    setShowConfirm(false);
  };

  return (
    <>
      {showConfirm && (
        <ConfirmDeleteModal feedbackId={fb.feedbackId}
          onConfirm={handleDelete} onCancel={() => setShowConfirm(false)} deleting={deleting} />
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 group relative hover:shadow-md transition-shadow">
        {/* Delete btn */}
        <button onClick={() => setShowConfirm(true)}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500">
          <Trash2 size={14} />
        </button>

        {/* Stars + date */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex gap-1">
            {fb.rating
              ? [1,2,3,4,5].map((s) => (
                  <Star key={s} size={15}
                    style={{ fill: s <= fb.rating ? '#fbbf24' : 'transparent', color: s <= fb.rating ? '#fbbf24' : '#e5e7eb' }} />
                ))
              : <span className="text-xs text-gray-400 italic">No rating</span>
            }
          </div>
          <span className="text-xs text-gray-400 flex items-center gap-1 pr-5">
            <Clock size={11} />
            {new Date(fb.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-3">"{fb.description}"</p>

        <div className="flex items-center gap-2">
          {fb.rating
            ? <span className={`text-xs font-bold ${RATING_COLORS[fb.rating]}`}>{RATING_LABELS[fb.rating]}</span>
            : <span className="text-xs text-gray-400 italic">Text only</span>
          }
          <span className="text-xs text-gray-200">•</span>
          <span className="text-xs text-gray-400 font-mono">{fb.feedbackId}</span>
        </div>

        {/* Bottom accent bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `linear-gradient(90deg, #1565C0, #00ACC1)` }} />
      </div>
    </>
  );
};

/* ── Main Page ──────────────────────────────────────────────────── */
const PatientFeedback = () => {
  const [rating, setRating]           = useState(0);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState('');
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deleteError, setDeleteError] = useState('');
  const [siteStats, setSiteStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await getMyFeedbacks();
        setMyFeedbacks(data.feedbacks || []);
      } catch { /* silent */ } finally { setLoadingHistory(false); }
    };
    const fetchSiteStats = async () => {
      try {
        const { data } = await getRatingDistribution();
        setSiteStats(data);
      } catch { /* silent */ }
    };
    fetchHistory();
    fetchSiteStats();
  }, [submitted]);

  const refreshSiteStats = async () => {
    try {
      const { data } = await getRatingDistribution();
      setSiteStats(data);
    } catch { /* silent */ }
  };

  const handleDelete = async (id) => {
    try {
      await deleteMyFeedback(id);
      setMyFeedbacks((prev) => prev.filter((fb) => fb._id !== id));
      refreshSiteStats();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete.');
      setTimeout(() => setDeleteError(''), 4000);
    }
  };

  // validation and submit new feedback
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const hasRating = rating > 0;
    const hasDescription = description.trim().length > 0;
    if (!hasRating && !hasDescription) return setError('Please provide a star rating, a written review, or both.');
    
    try {
      setSubmitting(true);
      await submitFeedback({
        ...(hasRating      && { rating }),
        ...(hasDescription && { description: description.trim() }),
      });
      setSubmitted(true);
      setRating(0);
      setDescription('');
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit. Please try again.');
    } finally { setSubmitting(false); }
  };

  const toggleTopic = (tag) =>
    setDescription((prev) =>
      prev.includes(tag)
        ? prev.replace(tag + '. ', '').replace(tag, '').trim()
        : (prev ? prev + ' ' : '') + tag + '.'
    );

  return (
    <PatientLayout activePage="Feedback & Ratings">
      <div className="p-6 space-y-6">

        {/* ── Banner — matches dashboard style exactly ── */}
        <div
          className="rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0D2137 0%, #1565C0 60%, #00ACC1 100%)' }}
        >
          {/* decorative circles */}
          <div className="absolute right-0 top-0 bottom-0 w-48 opacity-10 pointer-events-none">
            <svg viewBox="0 0 200 200" fill="white">
              <circle cx="150" cy="100" r="90" />
              <circle cx="40" cy="40" r="50" />
            </svg>
          </div>
          <div className="relative">
            <p className="text-white/70 text-sm">Patient Portal</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.6rem', color: 'white' }}>
              Feedback &amp; Ratings
            </h2>
            <p className="text-white/60 text-sm mt-1">Share your experience to help us improve our services.</p>
          </div>
          <div className="relative flex gap-3 flex-shrink-0">
            <button
              onClick={() => navigate('/patient/dashboard')}
              className="px-5 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition"
            >
              ← My Dashboard
            </button>
          </div>
        </div>

        {/* ── Success Banner ── */}
        {submitted && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-2xl px-5 py-4">
            <CheckCircle size={20} className="shrink-0 text-green-500" />
            <div>
              <p className="font-semibold text-sm">Thank you for your feedback!</p>
              <p className="text-xs text-green-600 mt-0.5">Your review has been submitted successfully.</p>
            </div>
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* LEFT col — form (2/3) */}
          <div className="lg:col-span-2 space-y-5">

            {/* Write a Review card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #1565C0, #00ACC1)' }}>
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Write a Review</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Your opinion matters to us</p>
                </div>
              </div>

              {/* review and feedback submit form */}
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

                {/* Star Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Overall Rating <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  </label>
                  <StarSelector value={rating} onChange={setRating} disabled={submitting} />
                  {rating > 0 && (
                    <button
                      type="button"
                      onClick={() => setRating(0)}
                      className="mt-2 text-xs text-gray-400 hover:text-red-400 transition underline"
                    >
                      Clear rating
                    </button>
                  )}
                </div>

                {/* Quick Topics */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Topics <span className="text-gray-400 font-normal text-xs">(optional — click to add)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map((tag) => {
                      const active = description.includes(tag);
                      return (
                        <button key={tag} type="button" onClick={() => toggleTopic(tag)}
                          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                            active
                              ? 'text-white border-transparent'
                              : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 bg-white'
                          }`}
                          style={active ? { background: 'linear-gradient(135deg, #1565C0, #00ACC1)', borderColor: 'transparent' } : {}}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Experience <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={submitting}
                    rows={5} maxLength={1000}
                    placeholder="Tell us about your visit — what went well or what we can improve..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent resize-none transition disabled:bg-gray-50"
                    style={{ '--tw-ring-color': '#00ACC1' }}
                    onFocus={e => e.target.style.borderColor = '#00ACC1'}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                  />
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-gray-400">Min. 10 characters if writing a review</span>
                    <span className={`text-xs ${description.length > 900 ? 'text-orange-500' : 'text-gray-400'}`}>
                      {description.length}/1000
                    </span>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                    <AlertTriangle size={15} className="shrink-0" />
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                  style={{ background: 'linear-gradient(135deg, #1565C0, #00ACC1)' }}
                >
                  <Send size={15} />
                  {submitting ? 'Submitting…' : 'Submit Feedback'}
                </button>
              </form>
            </div>

            {/* My Previous Feedback */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-800">My Previous Feedback</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {myFeedbacks.length > 0 ? `${myFeedbacks.length} review${myFeedbacks.length !== 1 ? 's' : ''} submitted` : 'Your review history'}
                  </p>
                </div>
              </div>

              {/* Delete error */}
              {deleteError && (
                <div className="mx-6 mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                  <AlertTriangle size={15} className="shrink-0" />
                  {deleteError}
                </div>
              )}

              <div className="p-6">
                {loadingHistory ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1,2].map((i) => (
                      <div key={i} className="rounded-2xl border border-gray-100 p-5 animate-pulse">
                        <div className="flex gap-1 mb-3">{[1,2,3,4,5].map(s => <div key={s} className="w-4 h-4 rounded-full bg-gray-200" />)}</div>
                        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : myFeedbacks.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
                      <MessageSquare size={24} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">No feedback submitted yet</p>
                    <p className="text-xs text-gray-400 mt-1">Use the form above to share your first review</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myFeedbacks.map((fb) => (
                      <MyFeedbackCard key={fb._id} fb={fb} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT col — sidebar (1/3) */}
          <div className="space-y-5">

            {/* Rating guide — matches Health Summary card style */}
            <div
              className="rounded-2xl p-5 text-white"
              style={{ background: 'linear-gradient(180deg, #0D2137 0%, #1565C0 100%)' }}
            >
              <h3 className="font-semibold mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                Rating Guide
              </h3>
              <p className="text-white/40 text-xs mb-4">What each star means</p>
              <div className="space-y-3">
                {[5,4,3,2,1].map((s) => (
                  <div key={s} className="flex items-center justify-between py-2 border-b border-white/10">
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map((i) => (
                        <Star key={i} size={13}
                          style={{ fill: i <= s ? '#fbbf24' : 'transparent', color: i <= s ? '#fbbf24' : 'rgba(255,255,255,0.2)' }} />
                      ))}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: RATING_HEX[s] }}>
                      {RATING_LABELS[s]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Site-wide Stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 text-sm mb-4">Overall Site Ratings</h3>
              {!siteStats ? (
                <div className="space-y-3 animate-pulse">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 bg-gray-100 rounded-xl" />
                    <div className="h-20 bg-gray-100 rounded-xl" />
                  </div>
                  {[1,2,3,4,5].map(i => <div key={i} className="h-3 bg-gray-100 rounded-full" />)}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: '1.6rem', color: '#1565C0' }}>
                        {siteStats.totalReviews}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Total Reviews</div>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: '1.6rem', color: '#d97706' }}>
                        {siteStats.averageRating}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Avg Rating</div>
                    </div>
                  </div>
                  {/* Star distribution bars */}
                  <div className="space-y-2">
                    {[5,4,3,2,1].map((star) => {
                      const found = siteStats.distribution?.find(d => d.rating === star);
                      const count = found?.count || 0;
                      const pct = siteStats.totalReviews ? Math.round((count / siteStats.totalReviews) * 100) : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-3">{star}</span>
                          <Star size={10} style={{ fill: '#fbbf24', color: '#fbbf24', flexShrink: 0 }} />
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-amber-400 transition-all duration-500"
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 w-5 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Privacy card — matches bill alert style */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Shield size={17} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">Your Privacy</p>
                  <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                    Your feedback is reviewed only by our management team to improve service quality. Your name will appear with your review.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </PatientLayout>
  );
};

export default PatientFeedback;