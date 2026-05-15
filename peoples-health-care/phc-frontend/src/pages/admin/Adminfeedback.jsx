import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import { getAllFeedback, getRatingDistribution } from "../../services/feedbackAPI";

const RATING_LABELS = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very Good", 5: "Excellent" };

//A reusable component that draws 5 stars. Stars up to rating are filled yellow,
function Stars({ rating, size = "sm" }) {
  const sz = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" fill={i <= rating ? "#F59E0B" : "none"} stroke={i <= rating ? "#F59E0B" : "#D1D5DB"} strokeWidth={1.5} className={sz}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function AdminFeedback() {
  const [feedbacks, setFeedbacks]       = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const [avgRating, setAvgRating]       = useState(0);

  //This function fetches all feedback from the backend server.
  const fetchFeedbacks = async (currentPage = 1, rating = "All") => {
    setLoading(true);
    setError("");
    try {
      const params = { page: currentPage, limit: 10 };
      if (rating !== "All") params.rating = rating;
      const { data } = await getAllFeedback(params);
      setFeedbacks(data.feedbacks || []);
      setTotalPages(data.pages || 1);
      setTotalReviews(data.total || 0);
    } catch (err) {
      console.error("getAllFeedback error:", err);
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
      } else if (err.response?.status === 403) {
        setError("Access denied. Cashier role required.");
      } else if (!err.response) {
        setError("Cannot connect to server. Make sure the backend is running on port 5001.");
      } else {
        setError(err.response?.data?.message || "Failed to load feedback.");
      }
    } finally {
      setLoading(false);
    }
  };

  //This function fetches rating statistics from the backend.
  const fetchDistribution = async () => {
    try {
      const { data } = await getRatingDistribution();
      setDistribution(data.distribution || []);
      setAvgRating(data.averageRating || 0);
    } catch (err) {
      console.error("getRatingDistribution error:", err);
    }
  };

  //automatically refresh data
  useEffect(() => {
    fetchFeedbacks(page, ratingFilter);
    fetchDistribution();
  }, [page, ratingFilter]);

  //Filters feedback based on search input, and excludes star-only entries (no description).
  const filtered = feedbacks.filter((fb) => {
    if (!fb.description || fb.description.trim() === '') return false;
    const q = search.toLowerCase();
    return (
      fb.patientName?.toLowerCase().includes(q) ||
      fb.description?.toLowerCase().includes(q) ||
      fb.feedbackId?.toLowerCase().includes(q)
    );
  });

  const maxCount = distribution.length > 0 ? Math.max(...distribution.map((d) => d.count), 1) : 1;

  return (
    <AdminLayout activePage="Patient Feedback">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>
            Patient Feedback
          </h1>
          <p className="text-sm text-gray-400 mt-1">Review patient feedback</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="font-semibold text-sm">Could not load feedback</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => { fetchFeedbacks(page, ratingFilter); fetchDistribution(); }}
              className="ml-auto text-xs font-semibold bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Rating Distribution + Overview */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Rating Distribution</h3>
            {loading ? (
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((r) => (
                  <div key={r} className="flex items-center gap-3">
                    <div className="w-20 h-3 bg-gray-100 rounded animate-pulse" />
                    <div className="flex-1 h-2 bg-gray-100 rounded-full animate-pulse" />
                    <div className="w-4 h-2 bg-gray-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {(distribution.length > 0
                  ? distribution
                  : [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: 0 }))
                ).map(({ rating: r, count }) => (
                  <div key={r} className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5 w-20 flex-shrink-0">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <svg key={i} viewBox="0 0 20 20" fill={i <= r ? "#F59E0B" : "#E5E7EB"} className="w-3 h-3">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-500"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )}
            {!loading && avgRating > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Average Rating</span>
                <span className="text-sm font-bold text-amber-600">{avgRating} / 5</span>
              </div>
            )}
          </div>

          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-center">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Overview</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{loading ? "—" : totalReviews}</div>
                <div className="text-xs text-gray-500 mt-1">Total Reviews</div>
              </div>
              <div className="text-center border-x border-gray-100">
                <div className="text-2xl font-bold text-amber-500">{loading ? "—" : avgRating > 0 ? avgRating : "—"}</div>
                <div className="text-xs text-gray-500 mt-1">Avg Rating</div>
              </div>

              {/* Highlight 5-star count in green */}
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {loading ? "—" : distribution.find((d) => d.rating === 5)?.count || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">5-Star Reviews</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 relative">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              placeholder="Search patient or feedback..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["All", "5", "4", "3", "2", "1"].map((r) => (
              <button
                key={r}
                onClick={() => { setRatingFilter(r); setPage(1); }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${ratingFilter === r ? "text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                style={ratingFilter === r ? { background: "linear-gradient(135deg, #1A237E, #283593)" } : {}}
              >
                {r === "All" ? "All Stars" : `${"★".repeat(parseInt(r))}`}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback List */}
        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))
          ) : filtered.length === 0 && !error ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="text-4xl mb-3">⭐</div>
              <div className="text-gray-500 font-medium">
                {search ? "No feedback matches your search." : "No written reviews submitted yet."}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {!search && "Star-only ratings are counted in the stats above."}
              </div>
            </div>
          ) : (
            filtered.map((fb) => (
              <div key={fb._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #0D2137, #1A237E)" }}
                    >
                      {fb.patientName?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-sm font-semibold text-gray-800">{fb.patientName}</span>
                        <div className="flex items-center gap-2">
                          <Stars rating={fb.rating} />
                          <span className="text-xs font-bold text-amber-600">{fb.rating}.0</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">"{fb.description}"</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-400">
                          {new Date(fb.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                          {" · "}
                          {new Date(fb.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          {fb.feedbackId}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          fb.rating >= 4 ? "bg-green-100 text-green-700" :
                          fb.rating === 3 ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {RATING_LABELS[fb.rating]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}