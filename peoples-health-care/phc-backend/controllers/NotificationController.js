import Notification from '../models/Notification.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ─── In-memory SSE client registry ───────────────────────────────────────
// Map<userId_string, Set<res>>
const sseClients = new Map();
// Map<userId_string, role_string>
const sseRoles   = new Map();

function addClient(userId, res) {
  const key = String(userId);
  if (!sseClients.has(key)) sseClients.set(key, new Set());
  sseClients.get(key).add(res);
}

function removeClient(userId, res) {
  const key = String(userId);
  const set = sseClients.get(key);
  if (set) { set.delete(res); if (set.size === 0) sseClients.delete(key); }
}

// ─── Push notification to all matching connected SSE clients ─────────────
function pushToClients({ targetRoles = [], targetUserIds = [] }, payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const [userId, connections] of sseClients) {
    const role    = sseRoles.get(userId);
    const byRole  = targetRoles.includes(role);
    const byId    = targetUserIds.some(id => String(id) === userId);
    if (!byRole && !byId) continue;
    for (const res of connections) {
      try { res.write(data); } catch { /* client gone */ }
    }
  }
}

// ─── SSE stream endpoint ───────────────────────────────────────────────────
// GET /api/notifications/stream?token=<jwt>
export const sseStream = async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();

  let userId, role;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('role');
    if (!user) return res.status(401).end();
    userId = String(user._id);
    role   = user.role;
  } catch {
    return res.status(401).end();
  }

  res.setHeader('Content-Type',       'text/event-stream');
  res.setHeader('Cache-Control',      'no-cache');
  res.setHeader('Connection',         'keep-alive');
  res.setHeader('X-Accel-Buffering',  'no');
  res.flushHeaders();

  addClient(userId, res);
  sseRoles.set(userId, role);

  // Connected heartbeat
  res.write(`data: ${JSON.stringify({ type: '__connected__' })}\n\n`);

  // Keepalive every 25 s
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 25_000);

  req.on('close', () => {
    clearInterval(ping);
    removeClient(userId, res);
  });
};

// ─── Helper used by all other controllers ────────────────────────────────
export const createNotification = async ({
  type, title, message, targetRoles = [], targetUserIds = [], data = {},
}) => {
  try {
    const notif = await Notification.create({
      type, title, message, targetRoles, targetUserIds, data,
    });
    // Push immediately to any open SSE connections
    pushToClients({ targetRoles, targetUserIds }, {
      _id: String(notif._id), type: notif.type,
      title: notif.title, message: notif.message,
      data: notif.data, createdAt: notif.createdAt,
    });
    return notif;
  } catch (err) {
    console.error('[Notification] create failed:', err.message);
  }
};

// ─── REST: recent notifications (initial page load) ──────────────────────
export const getNotifications = async (req, res) => {
  try {
    const { _id: userId, role } = req.user;
    const since = req.query.since
      ? new Date(req.query.since)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const notifications = await Notification.find({
      createdAt: { $gt: since },
      $or: [{ targetRoles: role }, { targetUserIds: userId }],
    }).sort({ createdAt: -1 }).limit(50);

    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── REST: unread count ───────────────────────────────────────────────────
export const getUnreadCount = async (req, res) => {
  try {
    const { _id: userId, role } = req.user;
    const count = await Notification.countDocuments({
      readBy: { $ne: userId },
      $or: [{ targetRoles: role }, { targetUserIds: userId }],
    });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── REST: mark read ─────────────────────────────────────────────────────
export const markRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { ids } = req.body;
    if (ids?.length) {
      await Notification.updateMany(
        { _id: { $in: ids } },
        { $addToSet: { readBy: userId } }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};