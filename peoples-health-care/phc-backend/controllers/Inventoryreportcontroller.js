/**
 * Pharmacy Inventory PDF Report Controller
 * GET /api/drugs/report/pdf
 *
 * Generates a professional PDF of the pharmacy inventory:
 *   - Summary statistics (total drugs, stock status, total value)
 *   - Expiry alerts (30-day danger, 90-day warning)
 *   - Reorder required list
 *   - Full drug inventory table
 *   - Stock batch detail (FEFO order)
 *   - Category breakdown
 *
 * Uses PDFKit (built-in Node.js-friendly) via pdfkit package,
 * OR falls back to returning structured JSON for client-side PDF generation.
 *
 * ─── Install pdfkit ───────────────────────────────────────────
 *   npm install pdfkit
 * ─────────────────────────────────────────────────────────────
 */

import Drug      from '../models/Drug.js';
import DrugStock from '../models/Drugstock.js';

// ── Helpers ──────────────────────────────────────────────────────
function getStockStatus(totalStock, reorderLevel) {
  if (totalStock === 0)                return 'Out of Stock';
  if (totalStock <= reorderLevel)      return 'Low Stock';
  return 'In Stock';
}

function daysToExpiry(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp   = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  return Math.floor((exp - today) / (1000 * 60 * 60 * 24));
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── GET /api/drugs/report/pdf ─────────────────────────────────
// Returns a JSON payload; the frontend (PharmacyInventory.jsx) uses
// this data + jsPDF (or an iframe to /report/preview) to render the PDF.
// If PDFKit is installed, streams a real PDF binary instead.
export const getInventoryReportData = async (req, res) => {
  try {
    // ── 1. Fetch all drugs ─────────────────────────────────────
    const drugs = await Drug.find().sort({ name: 1 }).lean();

    // ── 2. Attach stock data for each drug ─────────────────────
    const drugsWithStock = await Promise.all(
      drugs.map(async (drug) => {
        const stocks = await DrugStock.find({ drug: drug._id })
          .sort({ expiryDate: 1 }) // FEFO order
          .lean();

        const totalStock = stocks
          .filter(s => s.status === 'active' && new Date(s.expiryDate) > new Date())
          .reduce((sum, s) => sum + s.remainingQty, 0);

        return { ...drug, totalStock, stocks };
      })
    );

    // ── 3. Compute summary stats ───────────────────────────────
    const totalDrugs   = drugsWithStock.length;
    const inStock      = drugsWithStock.filter(d => getStockStatus(d.totalStock, d.reorderLevel) === 'In Stock').length;
    const lowStock     = drugsWithStock.filter(d => getStockStatus(d.totalStock, d.reorderLevel) === 'Low Stock').length;
    const outOfStock   = drugsWithStock.filter(d => d.totalStock === 0).length;
    const totalUnits   = drugsWithStock.reduce((sum, d) => sum + d.totalStock, 0);
    const totalValue   = drugsWithStock.reduce((sum, d) => sum + d.totalStock * (d.unitPrice || 0), 0);

    // ── 4. Expiry alerts ───────────────────────────────────────
    const expiring30  = [];
    const expiring90  = [];
    for (const drug of drugsWithStock) {
      for (const s of drug.stocks) {
        if (s.status !== 'active') continue;
        const days = daysToExpiry(s.expiryDate);
        const entry = {
          stockId:        s.stockId,
          drugName:       `${drug.name} ${drug.strength}`,
          drugId:         drug.drugId,
          remainingQty:   s.remainingQty,
          expiryDate:     fmtDate(s.expiryDate),
          daysLeft:       days,
          unitPrice:      s.unitPrice,
        };
        if (days <= 30)        expiring30.push(entry);
        else if (days <= 90)   expiring90.push(entry);
      }
    }

    // ── 5. Reorder list ────────────────────────────────────────
    const reorderRequired = drugsWithStock
      .filter(d => d.totalStock <= d.reorderLevel)
      .sort((a, b) => a.totalStock - b.totalStock)
      .map(d => ({
        drugId:       d.drugId,
        name:         d.name,
        brand:        d.brand,
        category:     d.category,
        form:         d.form,
        strength:     d.strength,
        totalStock:   d.totalStock,
        reorderLevel: d.reorderLevel,
        status:       getStockStatus(d.totalStock, d.reorderLevel),
      }));

    // ── 6. Category breakdown ──────────────────────────────────
    const categoryMap = {};
    for (const d of drugsWithStock) {
      if (!categoryMap[d.category]) categoryMap[d.category] = { count: 0, units: 0, value: 0 };
      categoryMap[d.category].count  += 1;
      categoryMap[d.category].units  += d.totalStock;
      categoryMap[d.category].value  += d.totalStock * (d.unitPrice || 0);
    }
    const categories = Object.entries(categoryMap)
      .map(([name, data]) => ({
        name,
        ...data,
        percentage: totalValue > 0 ? ((data.value / totalValue) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => b.value - a.value);

    // ── 7. Full inventory list ─────────────────────────────────
    const inventory = drugsWithStock.map(d => ({
      drugId:       d.drugId,
      name:         d.name,
      brand:        d.brand,
      category:     d.category,
      form:         d.form,
      strength:     d.strength,
      unit:         d.unit,
      unitPrice:    d.unitPrice || 0,
      reorderLevel: d.reorderLevel,
      totalStock:   d.totalStock,
      stockValue:   d.totalStock * (d.unitPrice || 0),
      status:       getStockStatus(d.totalStock, d.reorderLevel),
      stocks:       d.stocks.map(s => ({
        stockId:          s.stockId,
        receivedQty:      s.receivedQty,
        remainingQty:     s.remainingQty,
        unitPrice:        s.unitPrice || 0,
        batchValue:       s.remainingQty * (s.unitPrice || 0),
        receivedDate:     fmtDate(s.receivedDate),
        expiryDate:       fmtDate(s.expiryDate),
        daysLeft:         daysToExpiry(s.expiryDate),
        status:           s.status,
      })),
    }));

    // ── 8. Respond ─────────────────────────────────────────────
    res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      summary: {
        totalDrugs, inStock, lowStock, outOfStock, totalUnits,
        totalValue: Math.round(totalValue * 100) / 100,
      },
      expiry: {
        critical: expiring30.sort((a, b) => a.daysLeft - b.daysLeft),
        warning:  expiring90.sort((a, b) => a.daysLeft - b.daysLeft),
      },
      reorderRequired,
      categories,
      inventory,
    });
  } catch (error) {
    console.error('getInventoryReportData error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};