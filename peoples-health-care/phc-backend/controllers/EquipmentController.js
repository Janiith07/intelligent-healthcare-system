import Equipment from '../models/Equipment.js';
import { createNotification } from './NotificationController.js';

// ─── Helper ────────────────────────────────────────────────────────────────
function daysUntil(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / 86400000);
}

// ─── GET all equipment ─────────────────────────────────────────────────────
export const getAllEquipment = async (req, res) => {
  try {
    const { category, subCategory } = req.query;
    const filter = {};
    if (category)    filter.category    = category;
    if (subCategory) filter.subCategory = subCategory;

    const items = await Equipment.find(filter).sort({ subCategory: 1, name: 1 });

    let alertCount = 0;
    items.forEach(item => {
      if (item.category === 'machine') {
        const d = daysUntil(item.nextServiceDate);
        if (d !== null && d <= 5) alertCount++;
      } else {
        if (item.quantity <= item.lowStockThreshold) alertCount++;
      }
    });

    res.json({ success: true, count: items.length, alertCount, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET alert count only (sidebar badge) ─────────────────────────────────
export const getAlertCount = async (req, res) => {
  try {
    const [machines, consumables] = await Promise.all([
      Equipment.find({ category: 'machine' }, 'nextServiceDate'),
      Equipment.find({ category: 'consumable' }, 'quantity lowStockThreshold'),
    ]);
    let count = 0;
    machines.forEach(m => { const d = daysUntil(m.nextServiceDate); if (d !== null && d <= 5) count++; });
    consumables.forEach(c => { if (c.quantity <= c.lowStockThreshold) count++; });
    res.json({ success: true, alertCount: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET pending requests (admin resource management) ─────────────────────
export const getPendingRequests = async (req, res) => {
  try {
    const allItems = await Equipment.find({
      $or: [
        { 'serviceRequests.status': 'pending' },
        { 'stockRequests.status':   'pending' },
      ],
    });

    const requests = [];
    allItems.forEach(item => {
      if (item.category === 'machine') {
        item.serviceRequests.filter(r => r.status === 'pending').forEach(r =>
          requests.push({
            _id: r._id, equipmentId: item._id, equipmentName: item.name,
            category: 'machine', subCategory: item.subCategory,
            testFor: item.testFor, location: item.location,
            nextServiceDate: item.nextServiceDate,
            requestType: r.requestType, urgency: r.urgency,
            notes: r.notes, sentAt: r.sentAt, status: r.status,
          })
        );
      } else {
        item.stockRequests.filter(r => r.status === 'pending').forEach(r =>
          requests.push({
            _id: r._id, equipmentId: item._id, equipmentName: item.name,
            category: 'consumable', subCategory: item.subCategory,
            unit: item.unit, currentQty: item.quantity,
            threshold: item.lowStockThreshold,
            quantityAtTime: r.quantityAtTime,
            notes: r.notes, sentAt: r.sentAt, status: r.status,
          })
        );
      }
    });

    requests.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── CREATE equipment — admin only ────────────────────────────────────────
// MACHINES:
//   • Different location → always allowed, no serial needed.
//   • Same location, name not yet there → allowed, no serial needed (serialNumber stays '').
//   • Same location, name already there → serial number REQUIRED and must be different.
// CONSUMABLES:
//   • No serial number concept at all. One record per item name. No location.
export const createEquipment = async (req, res) => {
  try {
    const { name, category, location, serialNumber } = req.body;

    if (category === 'machine') {
      // Check: does this exact name already exist in this location?
      const sameNameInLocation = await Equipment.findOne({
        name, category: 'machine', location: location || '',
      });

      if (sameNameInLocation) {
        // Same name + same location → serial number is required to tell them apart
        if (!serialNumber || serialNumber.trim() === '') {
          return res.status(409).json({
            success: false,
            message: `"${name}" already exists in ${location || 'this location'}. Add a serial number to register another unit of the same machine.`,
          });
        }
        // Serial number provided — check it's not a duplicate
        const exactDuplicate = await Equipment.findOne({
          name, category: 'machine', location: location || '', serialNumber: serialNumber.trim(),
        });
        if (exactDuplicate) {
          return res.status(409).json({
            success: false,
            message: `"${name}" with serial number "${serialNumber}" already exists in ${location || 'this location'}. Use a different serial number.`,
          });
        }
      }
      // Different location or first machine of this name in location → no serial needed

    } else {
      // Consumables: one record per item name — no location, no serial number
      const existing = await Equipment.findOne({ name, category: 'consumable' });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `"${name}" is already in the consumables list. Each consumable is tracked as a single item.`,
        });
      }
    }

    // Strip serial number from consumables entirely before saving
    const payload = { ...req.body };
    if (payload.category === 'consumable') {
      payload.serialNumber = '';
    }

    const item = await Equipment.create(payload);

    // ── Notify admin and lab that equipment was added ─────────────
    const catLabel = payload.category === 'machine' ? '🖥️ Machine' : '🧫 Consumable';
    await createNotification({
      type: 'equipment_added',
      title: `${catLabel} Added`,
      message: `${payload.name} has been added to the equipment list${payload.location ? ` in ${payload.location}` : ''}.`,
      targetRoles: ['admin', 'lab'],
      data: { itemId: item._id, name: payload.name, category: payload.category },
    });

    res.status(201).json({ success: true, item });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This exact machine (same name, location and serial number) already exists.',
      });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

// ─── UPDATE equipment — lab + admin ───────────────────────────────────────
export const updateEquipment = async (req, res) => {
  try {
    // Prevent changing the name to one that already exists
    if (req.body.name) {
      const conflict = await Equipment.findOne({
        name:     req.body.name,
        category: req.body.category,
        _id:      { $ne: req.params.id },
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: `"${req.body.name}" already exists. Choose a different name.`,
        });
      }
    }
    const item = await Equipment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ─── DELETE equipment — admin only ────────────────────────────────────────
export const deleteEquipment = async (req, res) => {
  try {
    const item = await Equipment.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DECREMENT consumable stock — lab ─────────────────────────────────────
export const decrementStock = async (req, res) => {
  try {
    const { amount = 1 } = req.body;
    const item = await Equipment.findById(req.params.id);
    if (!item || item.category !== 'consumable')
      return res.status(404).json({ success: false, message: 'Consumable not found' });

    const prevQty = item.quantity;
    item.quantity = Math.max(0, item.quantity - Number(amount));
    await item.save();

    // ── CRITICAL: stock fully depleted (hit 0) ─────────────────────────────
    // Always fire an out-of-stock alert regardless of any existing pending alert.
    if (item.quantity === 0) {
      item.stockRequests.push({
        quantityAtTime: 0,
        notes: `CRITICAL: ${item.name} fully depleted — ${Number(amount)} ${item.unit} used (was ${prevQty}). Immediate restock required.`,
        sentAt: new Date(),
        status: 'pending',
      });
      await item.save();

      // Notify admin immediately
      await createNotification({
        type: 'equipment_alert_sent',
        title: `🚨 OUT OF STOCK — ${item.name}`,
        message: `${item.name} is completely out of stock. ${Number(amount)} ${item.unit} were used in an emergency (was ${prevQty}). Immediate restock required.`,
        targetRoles: ['admin', 'lab'],
        data: { itemId: item._id, name: item.name, quantity: 0, unit: item.unit, critical: true },
      });

    } else {
      // ── Normal low-stock alert — only once per depletion event ────────────
      const alreadyPending = item.stockRequests.some(r => r.status === 'pending');
      if (!alreadyPending && item.quantity <= item.lowStockThreshold) {
        item.stockRequests.push({
          quantityAtTime: item.quantity,
          notes: `Auto-alert: stock reduced to ${item.quantity} ${item.unit} (threshold: ${item.lowStockThreshold}).`,
          sentAt: new Date(),
          status: 'pending',
        });
        await item.save();

        // Notify admin via notification system
        await createNotification({
          type: 'equipment_alert_sent',
          title: `📦 Low Stock — ${item.name}`,
          message: `${item.name} stock is at ${item.quantity} ${item.unit}, at or below the alert threshold of ${item.lowStockThreshold}.`,
          targetRoles: ['admin', 'lab'],
          data: { itemId: item._id, name: item.name, quantity: item.quantity, unit: item.unit },
        });
      }
    }

    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── RESTOCK consumable — lab + admin ─────────────────────────────────────
export const restockConsumable = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ success: false, message: 'Amount must be > 0' });

    const item = await Equipment.findById(req.params.id);
    if (!item || item.category !== 'consumable')
      return res.status(404).json({ success: false, message: 'Consumable not found' });

    item.quantity      += parseInt(amount);
    item.lastRestocked  = new Date();

    // Resolve pending stock requests since stock is being replenished
    item.stockRequests.forEach(r => {
      if (r.status === 'pending') { r.status = 'resolved'; r.resolvedAt = new Date(); }
    });

    await item.save();

    // ── Notify admin and lab that stock was replenished ───────────
    await createNotification({
      type: 'equipment_restocked',
      title: '📦 Stock Replenished',
      message: `${item.name} restocked by ${amount} ${item.unit}. New total: ${item.quantity} ${item.unit}.`,
      targetRoles: ['admin', 'lab'],
      data: { itemId: item._id, name: item.name, amount, newQty: item.quantity },
    });

    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── LAB manually notifies resource management: low stock ─────────────────
export const sendStockRequest = async (req, res) => {
  try {
    const { notes } = req.body;
    const item = await Equipment.findById(req.params.id);
    if (!item || item.category !== 'consumable')
      return res.status(404).json({ success: false, message: 'Consumable not found' });

    const alreadyPending = item.stockRequests.some(r => r.status === 'pending');
    if (alreadyPending)
      return res.status(400).json({ success: false, message: 'A pending stock request already exists for this item.' });

    item.stockRequests.push({
      quantityAtTime: item.quantity,
      notes: notes || `Manual alert: current stock is ${item.quantity} ${item.unit}.`,
      sentAt: new Date(),
      status: 'pending',
    });
    await item.save();

    // ── Notify admin ──────────────────────────────────────────────
    await createNotification({
      type: 'equipment_alert_sent',
      title: '📦 Low Stock Alert',
      message: `Lab staff reported low stock for ${item.name}. Current: ${item.quantity} ${item.unit} (threshold: ${item.lowStockThreshold}).`,
      targetRoles: ['admin', 'lab'],
      data: { itemId: item._id, name: item.name, quantity: item.quantity, unit: item.unit },
    });

    res.json({ success: true, message: 'Stock request sent to Resource Management', item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── LAB sends machine service/replacement request ────────────────────────
export const sendServiceRequest = async (req, res) => {
  try {
    const { requestType, urgency, notes } = req.body;
    const item = await Equipment.findById(req.params.id);
    if (!item || item.category !== 'machine')
      return res.status(404).json({ success: false, message: 'Machine not found' });

    const alreadyPending = item.serviceRequests.some(
      r => r.status === 'pending' && r.urgency === urgency && r.requestType === requestType
    );
    if (alreadyPending)
      return res.status(400).json({ success: false, message: 'A pending request of this type already exists.' });

    item.serviceRequests.push({ requestType, urgency, notes: notes || '', sentAt: new Date(), status: 'pending' });
    await item.save();

    // ── Notify admin ──────────────────────────────────────────────
    const urgLabel = { emergency: '🚨 EMERGENCY', '1_day_warning': '⛔ 1-Day Warning', '5_day_warning': '⚠️ 5-Day Warning', routine: '📋 Routine' }[urgency] || urgency;
    await createNotification({
      type: 'equipment_alert_sent',
      title: `🔧 Machine Service Request — ${urgLabel}`,
      message: `Lab staff sent a ${requestType.replace(/_/g, ' ')} request for ${item.name}${item.location ? ` in ${item.location}` : ''}.`,
      targetRoles: ['admin', 'lab'],
      data: { itemId: item._id, name: item.name, requestType, urgency, location: item.location },
    });

    res.json({ success: true, message: 'Service request sent to Resource Management', item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ACKNOWLEDGE a request — admin ────────────────────────────────────────
export const acknowledgeRequest = async (req, res) => {
  try {
    const { equipmentId, requestId, category } = req.body;
    const item = await Equipment.findById(equipmentId);
    if (!item) return res.status(404).json({ success: false, message: 'Equipment not found' });
    const arr = category === 'machine' ? item.serviceRequests : item.stockRequests;
    const r   = arr.id(requestId);
    if (!r) return res.status(404).json({ success: false, message: 'Request not found' });
    r.status = 'acknowledged'; r.acknowledgedAt = new Date();
    await item.save();

    // ── Notify admin + lab ────────────────────────────────────────
    await createNotification({
      type: 'service_acknowledged',
      title: '👁️ Service Request Acknowledged',
      message: `Admin acknowledged the ${category === 'machine' ? 'service' : 'stock'} request for ${item.name}.`,
      targetRoles: ['admin', 'lab'],
      data: { itemId: item._id, name: item.name, category },
    });

    res.json({ success: true, message: 'Acknowledged' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── RESOLVE a request — admin ────────────────────────────────────────────
export const resolveRequest = async (req, res) => {
  try {
    const { equipmentId, requestId, category } = req.body;
    const item = await Equipment.findById(equipmentId);
    if (!item) return res.status(404).json({ success: false, message: 'Equipment not found' });
    const arr = category === 'machine' ? item.serviceRequests : item.stockRequests;
    const r   = arr.id(requestId);
    if (!r) return res.status(404).json({ success: false, message: 'Request not found' });
    r.status = 'resolved'; r.resolvedAt = new Date();
    if (category === 'machine' && r.requestType !== 'replacement') item.machineStatus = 'operational';
    await item.save();

    // ── Notify admin + lab ────────────────────────────────────────
    await createNotification({
      type: 'service_acknowledged',
      title: '✅ Request Resolved',
      message: `Admin resolved the ${category === 'machine' ? 'service' : 'stock'} request for ${item.name}.`,
      targetRoles: ['admin', 'lab'],
      data: { itemId: item._id, name: item.name, category },
    });

    res.json({ success: true, message: 'Resolved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── AUTO-CHECK machine service alerts ────────────────────────────────────
export const checkAndAutoSendAlerts = async (req, res) => {
  try {
    const machines = await Equipment.find({ category: 'machine' });
    let sent = 0;
    for (const m of machines) {
      const days = daysUntil(m.nextServiceDate);
      if (days === null) continue;
      const send = async (urgency) => {
        const exists = m.serviceRequests.some(r => r.status === 'pending' && r.urgency === urgency);
        if (!exists) {
          m.serviceRequests.push({
            requestType: 'scheduled_service', urgency,
            notes: `Auto-alert: ${m.name} service due in ${days} day(s). Location: ${m.location || '—'}.`,
            sentAt: new Date(), status: 'pending',
          });
          if (days <= 0) m.machineStatus = 'service_due';
          await m.save(); sent++;
        }
      };
      if (days <= 1) await send('1_day_warning');
      else if (days <= 5) await send('5_day_warning');
    }
    res.json({ success: true, message: `${sent} alert(s) sent.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};