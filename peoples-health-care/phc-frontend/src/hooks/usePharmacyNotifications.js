import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:5001/api";

/**
 * Hook to fetch and manage pharmacy notifications
 * Includes:
 * - Pending prescriptions
 * - Low stock alerts
 * - Auto-refresh every 30 seconds
 */
export const usePharmacyNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState({
    pendingPrescriptions: 0,
    lowStockItems: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = sessionStorage.getItem("token");
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(`${API}/pharmacy/notifications`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch notifications: ${response.statusText}`,
        );
      }

      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setSummary(
          data.summary || {
            pendingPrescriptions: 0,
            lowStockItems: 0,
            total: 0,
          },
        );
        setError(null);
      } else {
        setError(data.message || "Failed to fetch notifications");
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  // Fetch notifications on mount and set up auto-refresh
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    notifications,
    summary,
    loading,
    error,
    refetch: fetchNotifications,
  };
};
