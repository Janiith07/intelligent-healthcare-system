import Drug      from '../models/Drug.js';
import DrugStock from '../models/Drugstock.js'; // needed for stock-check on delete

// ═══════════════════════════════════════════════════════════════
//  DRUG CONTROLLER  –  Drug catalog management (no stock here)
// ═══════════════════════════════════════════════════════════════

// ── CREATE a new drug ──────────────────────────────────────────
// POST /api/drugs
export const createDrug = async (req, res) => {
  try {
    const { name, brand, category, form, strength, unit, reorderLevel, unitPrice } = req.body;

    if (!name)     return res.status(400).json({ success: false, message: 'Drug name is required' });
    if (!form)     return res.status(400).json({ success: false, message: 'Drug form is required (Tablet, Capsule …)' });
    if (!strength) return res.status(400).json({ success: false, message: 'Drug strength is required (e.g. 500mg)' });

    if (unitPrice !== undefined && (isNaN(unitPrice) || unitPrice < 0))
      return res.status(400).json({ success: false, message: 'Unit price must be a non-negative number' });
    if (reorderLevel !== undefined && (isNaN(reorderLevel) || reorderLevel < 0))
      return res.status(400).json({ success: false, message: 'Reorder level must be a non-negative number' });

    // Check duplicate (same name + strength + form)
    const exists = await Drug.findOne({ name: name.trim(), strength: strength.trim(), form });
    if (exists)
      return res.status(400).json({
        success: false,
        message: `Drug "${name} ${strength} (${form})" already exists in the catalog`,
      });

    const drugId = await Drug.generateDrugId();

    const drug = await Drug.create({
      drugId,
      name:         name.trim(),
      brand:        brand?.trim() || '',
      category:     category || 'Other',
      form,
      strength:     strength.trim(),
      unit:         unit || 'pcs',
      reorderLevel: reorderLevel ?? 10,
      unitPrice:    unitPrice ?? 0,
      addedBy:      req.user._id,
    });

    res.status(201).json({ success: true, message: 'Drug added to catalog successfully', drug });
  } catch (error) {
    console.error('createDrug error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET ALL drugs (with optional filters) ──────────────────────
// GET /api/drugs
// Query params: category, form, search, lowStock, isActive, limit
export const getAllDrugs = async (req, res) => {
  try {
    const { category, form, search, lowStock, isActive, limit = 100 } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (form)     filter.form     = form;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    if (search) {
      filter.$or = [
        { name:   { $regex: search, $options: 'i' } },
        { brand:  { $regex: search, $options: 'i' } },
        { drugId: { $regex: search, $options: 'i' } },
      ];
    }

    let drugs = await Drug.find(filter)
      .sort({ name: 1 })
      .limit(parseInt(limit))
      .populate('addedBy', 'name')
      .populate('lastUpdatedBy', 'name');

    // Attach live totalStock from DrugStock collection
    const drugsWithStock = await Promise.all(
      drugs.map(async (drug) => {
        const totalStock = await DrugStock.getTotalStock(drug._id);
        const obj        = drug.toJSON();
        obj.totalStock   = totalStock;
        obj.isLowStock   = totalStock <= drug.reorderLevel;
        return obj;
      })
    );

    // Optional low-stock filter
    const result = lowStock === 'true'
      ? drugsWithStock.filter((d) => d.isLowStock)
      : drugsWithStock;

    res.status(200).json({ success: true, count: result.length, drugs: result });
  } catch (error) {
    console.error('getAllDrugs error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET single drug (with stock summary) ───────────────────────
// GET /api/drugs/:id
export const getDrug = async (req, res) => {
  try {
    const drug = await Drug.findById(req.params.id)
      .populate('addedBy', 'name')
      .populate('lastUpdatedBy', 'name');

    if (!drug) return res.status(404).json({ success: false, message: 'Drug not found' });

    const totalStock  = await DrugStock.getTotalStock(drug._id);
    const stockEntries = await DrugStock.find({ drug: drug._id })
      .sort({ expiryDate: 1 })
      .populate('addedBy', 'name');

    const obj        = drug.toJSON();
    obj.totalStock   = totalStock;
    obj.isLowStock   = totalStock <= drug.reorderLevel;
    obj.stockEntries = stockEntries;

    res.status(200).json({ success: true, drug: obj });
  } catch (error) {
    console.error('getDrug error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── UPDATE drug catalog info ────────────────────────────────────
// PUT /api/drugs/:id
export const updateDrug = async (req, res) => {
  try {
    const drug = await Drug.findById(req.params.id);
    if (!drug) return res.status(404).json({ success: false, message: 'Drug not found' });

    const allowedFields = [
      'name', 'brand', 'category', 'form', 'strength',
      'unit', 'reorderLevel', 'unitPrice', 'isActive',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) drug[field] = req.body[field];
    });

    drug.lastUpdatedBy = req.user._id;
    await drug.save();

    res.status(200).json({ success: true, message: 'Drug updated successfully', drug });
  } catch (error) {
    console.error('updateDrug error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── DELETE drug ────────────────────────────────────────────────
// DELETE /api/drugs/:id
// Blocked if any DrugStock entries exist for this drug
export const deleteDrug = async (req, res) => {
  try {
    const drug = await Drug.findById(req.params.id);
    if (!drug) return res.status(404).json({ success: false, message: 'Drug not found' });

    // Check for existing stock entries
    const stockCount = await DrugStock.countDocuments({ drug: req.params.id });
    if (stockCount > 0) {
      const activeCount = await DrugStock.countDocuments({ drug: req.params.id, status: 'active' });
      return res.status(400).json({
        success: false,
        cannotDelete: true,
        message: `Cannot delete "${drug.name}" — it has ${stockCount} stock entr${stockCount === 1 ? 'y' : 'ies'}${activeCount > 0 ? ` (${activeCount} active)` : ''}. Remove all stock entries first, then delete the drug.`,
        stockCount,
        activeCount,
      });
    }

    await drug.deleteOne();
    res.status(200).json({ success: true, message: 'Drug deleted successfully' });
  } catch (error) {
    console.error('deleteDrug error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── SEARCH drugs by name / brand (for prescription linking) ────
// GET /api/drugs/search?q=amox
export const searchDrugs = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: 'Search query q is required' });

    // Escape special regex characters to prevent injection
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // \b anchors to word boundaries — matches "para" in "Paracetamol" but NOT
    // "p" inside "Ibuprofen" or "Glucophage", giving much more relevant results
    const wordStart = new RegExp(`\\b${escaped}`, 'i');

    const drugs = await Drug.find({
      isActive: true,
      name: { $regex: wordStart },
    })
      .select('drugId name brand form strength unit unitPrice reorderLevel')
      .limit(20);

    // Attach stock to each result
    const results = await Promise.all(
      drugs.map(async (drug) => {
        const totalStock = await DrugStock.getTotalStock(drug._id);
        return { ...drug.toJSON(), totalStock };
      })
    );

    res.status(200).json({ success: true, count: results.length, drugs: results });
  } catch (error) {
    console.error('searchDrugs error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};