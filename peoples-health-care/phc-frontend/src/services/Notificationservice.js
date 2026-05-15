/**
 * useNotifications — real-time notifications via Server-Sent Events (SSE).
 *
 * SSE gives instant push delivery from the backend the moment an event fires.
 * No polling delay. The EventSource auto-reconnects if the connection drops.
 *
 * Usage (in any Layout component that already has a toast instance):
 *   useNotifications(toast);
 */
import { useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:5001/api';

// Map notification.type → toast variant
function toastVariant(type) {
  switch (type) {
    case 'payment_confirmed':      return 'success';
    case 'results_uploaded':       return 'success';
    case 'equipment_added':        return 'success';
    case 'equipment_restocked':    return 'success';
    case 'equipment_alert_sent':   return 'warning';
    case 'lab_request_created':    return 'info';
    case 'service_acknowledged':   return 'info';
    default:                       return 'info';
  }
}

export function useNotifications(toast) {
  const esRef      = useRef(null);
  const toastRef   = useRef(toast);
  const shownRef   = useRef(new Set());

  // Keep toastRef current without triggering re-subscriptions
  useEffect(() => { toastRef.current = toast; }, [toast]);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) return; // not logged in — nothing to do

    function connect() {
      const url = `${API_BASE}/notifications/stream?token=${encodeURIComponent(token)}`;
      const es  = new EventSource(url);
      esRef.current = es;

      es.onmessage = (event) => {
        let notif;
        try { notif = JSON.parse(event.data); } catch { return; }

        // Ignore the connection heartbeat
        if (notif.type === '__connected__') return;

        // Deduplicate (SSE delivers exactly once, but guard against reconnect replays)
        if (notif._id && shownRef.current.has(notif._id)) return;
        if (notif._id) shownRef.current.add(notif._id);

        // Show the toast
        const variant = toastVariant(notif.type);
        toastRef.current[variant](notif.title, notif.message, notif.type);
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        // Auto-reconnect after 5 s
        setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []); // run once — token never changes in a session
}