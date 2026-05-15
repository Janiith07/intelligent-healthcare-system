/**
 * Format time relative to now (e.g., "2 minutes ago", "1 hour ago")
 */
export const formatTimeAgo = (date) => {
  if (!date) return "";

  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60)
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

  return past.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * Get color scheme for notification type
 */
export const getNotificationColors = (type) => {
  switch (type) {
    case "prescription":
      return { bg: "bg-blue-50", border: "border-blue-200", icon: "🔵" };
    case "low_stock":
      return { bg: "bg-red-50", border: "border-red-200", icon: "⚠️" };
    default:
      return { bg: "bg-gray-50", border: "border-gray-200", icon: "ℹ️" };
  }
};

/**
 * Get status badge styling
 */
export const getStatusBadge = (status) => {
  const statusMap = {
    pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
    in_review: { bg: "bg-blue-100", text: "text-blue-700", label: "In Review" },
    partially_available: {
      bg: "bg-orange-100",
      text: "text-orange-700",
      label: "Partial",
    },
  };
  return (
    statusMap[status] || {
      bg: "bg-gray-100",
      text: "text-gray-700",
      label: status,
    }
  );
};
