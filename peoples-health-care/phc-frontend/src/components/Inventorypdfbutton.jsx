/**
 * InventoryPDFButton
 *
 * Drop-in button for PharmacyInventory.jsx (and PharmacyDashboard.jsx).
 * Fetches live inventory data from /api/drugs/report/pdf,
 * then uses jsPDF + jspdf-autotable to render a professional PDF
 * matching the medical center's dark-navy / emerald colour theme.
 *
 * ── Install once ──────────────────────────────────────────────────
 *   npm install jspdf jspdf-autotable
 * ─────────────────────────────────────────────────────────────────
 *
 * Usage (add anywhere in PharmacyInventory.jsx toolbar):
 *   import InventoryPDFButton from "../../components/InventoryPDFButton";
 *   <InventoryPDFButton />
 */

import { useState } from "react";
import { jsPDF }    from "jspdf";
import autoTable    from "jspdf-autotable";

const API   = "http://localhost:5001/api";
const token = () => sessionStorage.getItem("token");
const authH = () => ({ Authorization: `Bearer ${token()}` });

// ── Colour palette ───────────────────────────────────────────────
const C = {
  navy:       [13,  33,  55],
  green:      [46, 125,  50],
  teal:       [0,  137, 123],
  amber:      [245, 158,  11],
  red:        [220,  38,  38],
  emerald:    [5,  150, 105],
  lightGray:  [248, 250, 252],
  midGray:    [226, 232, 240],
  textDark:   [30,  41,  59],
  textGray:   [100, 116, 139],
  inStockBg:  [209, 250, 229],
  inStockTx:  [6,   95,  70],
  lowStockBg: [254, 243, 199],
  lowStockTx: [146,  64,  14],
  outStockBg: [254, 226, 226],
  outStockTx: [153,  27,  27],
  white:      [255, 255, 255],
};

function fmtLKR(v) { return `LKR ${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function statusColors(status) {
  if (status === "In Stock")     return { bg: C.inStockBg,   tx: C.inStockTx };
  if (status === "Low Stock")    return { bg: C.lowStockBg,  tx: C.lowStockTx };
  if (status === "Out of Stock") return { bg: C.outStockBg,  tx: C.outStockTx };
  return { bg: C.lightGray, tx: C.textGray };
}

function addPageChrome(doc, pageTitle) {
  const { internal: { pageSize: { getWidth: W, getHeight: H } } } = doc;
  const w = W(), h = H();

  // Top bar
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, w, 18, "F");
  doc.setFillColor(...C.green);
  doc.rect(0, 18, w, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.text("University Medical Center", 14, 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(178, 223, 219);
  doc.text("Pharmacy Inventory Report", 14, 14);

  const now = new Date();
  doc.text(`Generated: ${now.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}, ${now.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`, w - 14, 8, { align: "right" });
  doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, w - 14, 14, { align: "right" });

  // Section title below header
  if (pageTitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...C.navy);
    doc.text(pageTitle, 14, 30);
  }

  // Footer
  doc.setFillColor(...C.midGray);
  doc.rect(0, h - 12, w, 12, "F");
  doc.setFillColor(...C.green);
  doc.rect(0, h - 12, w, 0.5, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textGray);
  doc.text("CONFIDENTIAL — For internal pharmacy use only. Do not distribute outside authorised personnel.", w / 2, h - 4.5, { align: "center" });
}

// ── PDF Builder ──────────────────────────────────────────────────
function buildPDF(data) {
  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W    = doc.internal.pageSize.getWidth();
  const H    = doc.internal.pageSize.getHeight();
  const now  = new Date();
  const { summary, expiry, reorderRequired, categories, inventory, generatedAt } = data;

  // ── PAGE 1: Cover + Summary ───────────────────────────────────
  addPageChrome(doc, null);

  // Cover block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...C.navy);
  doc.text("PHARMACY INVENTORY REPORT", 14, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.textGray);
  doc.text(`Report Date: ${now.toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" })}`, W - 14, 28, { align: "right" });
  doc.text(`Time: ${now.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`, W - 14, 33, { align: "right" });
  doc.text("Department: Pharmacy", W - 14, 38, { align: "right" });

  // Green divider
  doc.setDrawColor(...C.green);
  doc.setLineWidth(1.5);
  doc.line(14, 40, W - 14, 40);

  // ── Summary stat boxes ────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.navy);
  doc.text("Inventory Summary", 14, 50);

  const stats = [
    { label: "Total Drugs",   value: summary.totalDrugs,           bg: C.lightGray, tx: C.navy     },
    { label: "In Stock",      value: summary.inStock,              bg: C.inStockBg, tx: C.inStockTx  },
    { label: "Low Stock",     value: summary.lowStock,             bg: C.lowStockBg,tx: C.lowStockTx },
    { label: "Out of Stock",  value: summary.outOfStock,           bg: C.outStockBg,tx: C.outStockTx },
    { label: "Total Units",   value: summary.totalUnits.toLocaleString(), bg: C.lightGray, tx: C.navy },
  ];
  const boxW = (W - 28 - 4 * 4) / 5;
  let bx = 14;
  stats.forEach(s => {
    doc.setFillColor(...s.bg);
    doc.roundedRect(bx, 54, boxW, 20, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...s.tx);
    doc.text(String(s.value), bx + boxW / 2, 66, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textGray);
    doc.text(s.label, bx + boxW / 2, 71, { align: "center" });
    bx += boxW + 4;
  });

  // Total value banner
  doc.setFillColor(240, 253, 244);
  doc.rect(14, 78, W - 28, 12, "F");
  doc.setDrawColor(...C.emerald);
  doc.setLineWidth(0.5);
  doc.rect(14, 78, W - 28, 12, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.navy);
  doc.text("Total Inventory Value", 20, 86);
  doc.setFontSize(13);
  doc.setTextColor(...C.green);
  doc.text(fmtLKR(summary.totalValue), W - 20, 86, { align: "right" });

  let y = 96;

  // ── Expiry Alerts ─────────────────────────────────────────────
  if (expiry.critical.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.red);
    doc.text("Expiry Alerts — Critical (within 30 days)", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Stock ID", "Drug", "Qty", "Expiry Date", "Days Left"]],
      body: expiry.critical.map(e => [
        e.stockId, e.drugName, e.remainingQty, e.expiryDate,
        e.daysLeft <= 0 ? "EXPIRED" : `${e.daysLeft} days`,
      ]),
      headStyles:  { fillColor: C.red, textColor: C.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles:  { fillColor: [254, 226, 226], textColor: C.outStockTx, fontSize: 8 },
      alternateRowStyles: { fillColor: [255, 245, 245] },
      columnStyles: { 4: { fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 2.5 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  if (expiry.warning.length > 0 && y < H - 50) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.amber);
    doc.text("Expiry Alerts — Warning (within 90 days)", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Stock ID", "Drug", "Qty", "Expiry Date", "Days Left"]],
      body: expiry.warning.map(e => [e.stockId, e.drugName, e.remainingQty, e.expiryDate, `${e.daysLeft} days`]),
      headStyles:  { fillColor: C.amber, textColor: C.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles:  { fillColor: C.lowStockBg, textColor: C.lowStockTx, fontSize: 8 },
      alternateRowStyles: { fillColor: [255, 251, 235] },
      columnStyles: { 4: { fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 2.5 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── Reorder Required ──────────────────────────────────────────
  if (reorderRequired.length > 0) {
    if (y > H - 60) { doc.addPage(); addPageChrome(doc, null); y = 35; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.navy);
    doc.text("Reorder Required", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Drug ID", "Name", "Category", "Form / Strength", "Current Stock", "Reorder Level", "Status"]],
      body: reorderRequired.map(d => [
        d.drugId, `${d.name}\n${d.brand}`, d.category, `${d.form} / ${d.strength}`,
        d.totalStock, d.reorderLevel, d.status,
      ]),
      headStyles:  { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles:  { fillColor: [255, 247, 237], fontSize: 8 },
      alternateRowStyles: { fillColor: [255, 251, 245] },
      columnStyles: {
        4: { fontStyle: "bold", halign: "center" },
        5: { halign: "center" },
        6: { fontStyle: "bold", halign: "center" },
      },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 2.5 },
      didParseCell: function(data) {
        if (data.row.index >= 0 && data.column.index === 6) {
          const status = data.cell.raw;
          if (status === "Out of Stock") {
            data.cell.styles.textColor = C.outStockTx;
            data.cell.styles.fillColor = C.outStockBg;
          } else {
            data.cell.styles.textColor = C.lowStockTx;
            data.cell.styles.fillColor = C.lowStockBg;
          }
        }
      }
    });
  }

  // ── PAGE 2: Full Inventory ────────────────────────────────────
  doc.addPage();
  addPageChrome(doc, "Full Drug Inventory — All Items");

  autoTable(doc, {
    startY: 36,
    head: [["Drug ID", "Name / Brand", "Form / Strength", "Category", "Stock", "Reorder", "Unit Price", "Value (LKR)", "Status"]],
    body: inventory.map(d => [
      d.drugId,
      `${d.name}\n${d.brand}`,
      `${d.form}\n${d.strength}`,
      d.category,
      d.totalStock,
      d.reorderLevel,
      d.unitPrice.toFixed(2),
      d.stockValue.toLocaleString("en-US", { minimumFractionDigits: 2 }),
      d.status,
    ]),
    headStyles:  { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 8 },
    bodyStyles:  { fontSize: 8, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: C.lightGray },
    columnStyles: {
      0: { halign: "center" },
      4: { halign: "center", fontStyle: "bold" },
      5: { halign: "center" },
      6: { halign: "right" },
      7: { halign: "right", fontStyle: "bold", textColor: C.green },
      8: { halign: "center", fontStyle: "bold", fontSize: 7 },
    },
    margin: { left: 14, right: 14 },
    didParseCell: function(data) {
      if (data.row.index >= 0 && data.column.index === 8) {
        const sc = statusColors(data.cell.raw);
        data.cell.styles.textColor = sc.tx;
        data.cell.styles.fillColor = sc.bg;
      }
    },
    didDrawPage: function() { addPageChrome(doc, "Full Drug Inventory — All Items (cont.)"); }
  });

  // ── PAGE 3+: Stock Batch Detail ───────────────────────────────
  doc.addPage();
  addPageChrome(doc, "Stock Batch Details — FEFO Order");

  let batchY = 36;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...C.textGray);
  doc.text("Each drug's stock entries are listed by earliest expiry first (FEFO — First Expiry, First Out). Highlighted rows indicate expiring soon.", 14, batchY);
  batchY += 8;

  for (const drug of inventory) {
    if (batchY > H - 50) {
      doc.addPage();
      addPageChrome(doc, "Stock Batch Details (cont.)");
      batchY = 35;
    }

    const sc = statusColors(drug.status);

    // Drug header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, batchY, W - 28, 9, "F");
    doc.setDrawColor(...C.green);
    doc.setLineWidth(1);
    doc.line(14, batchY + 9, W - 28 + 14, batchY + 9);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.navy);
    doc.text(`${drug.name}  `, 18, batchY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.textGray);
    const sub = `${drug.brand}  ·  ${drug.form}  ·  ${drug.strength}  ·  ${drug.category}`;
    const nameW = doc.getTextWidth(`${drug.name}  `);
    doc.text(sub, 18 + nameW, batchY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...sc.tx);
    doc.text(`Total: ${drug.totalStock} ${drug.unit}  |  ${drug.status}  |  ${drug.drugId}`, W - 18, batchY + 6, { align: "right" });

    batchY += 12;

    autoTable(doc, {
      startY: batchY,
      head: [["Stock ID", "Rcv Qty", "Rem Qty", "Unit Price", "Batch Value", "Received", "Expiry", "Days Left", "Status"]],
      body: drug.stocks.map(s => [
        s.stockId,
        s.receivedQty,
        s.remainingQty,
        s.unitPrice.toFixed(2),
        s.batchValue.toLocaleString("en-US", { minimumFractionDigits: 2 }),
        s.receivedDate,
        s.expiryDate,
        s.daysLeft <= 0 ? "EXPIRED" : `${s.daysLeft}d`,
        s.status.charAt(0).toUpperCase() + s.status.slice(1),
      ]),
      headStyles:  { fillColor: C.green, textColor: C.white, fontStyle: "bold", fontSize: 7.5 },
      bodyStyles:  { fontSize: 7.5, cellPadding: 2 },
      alternateRowStyles: { fillColor: C.lightGray },
      columnStyles: {
        0: { halign: "center" },
        1: { halign: "center" },
        2: { halign: "center", fontStyle: "bold" },
        3: { halign: "right" },
        4: { halign: "right", fontStyle: "bold", textColor: C.green },
        5: { halign: "center" },
        6: { halign: "center" },
        7: { halign: "center", fontStyle: "bold" },
        8: { halign: "center", fontSize: 7 },
      },
      margin: { left: 14, right: 14 },
      didParseCell: function(data) {
        if (data.row.index < 0) return;
        const daysLeft = drug.stocks[data.row.index]?.daysLeft;
        if (daysLeft !== undefined) {
          if (daysLeft <= 30)       { data.cell.styles.fillColor = C.outStockBg; }
          else if (daysLeft <= 90)  { data.cell.styles.fillColor = C.lowStockBg; }
        }
        if (data.column.index === 8) {
          const s = data.cell.raw;
          if (s === "Active")    { data.cell.styles.textColor = C.inStockTx;  data.cell.styles.fillColor = C.inStockBg; }
          if (s === "Exhausted") { data.cell.styles.textColor = C.textGray; }
          if (s === "Expired")   { data.cell.styles.textColor = C.outStockTx; data.cell.styles.fillColor = C.outStockBg; }
        }
      },
      didDrawPage: function() { addPageChrome(doc, "Stock Batch Details (cont.)"); }
    });

    batchY = doc.lastAutoTable.finalY + 8;
  }

  // ── Final Page: Category Breakdown ───────────────────────────
  doc.addPage();
  addPageChrome(doc, "Category Breakdown");

  autoTable(doc, {
    startY: 36,
    head: [["Category", "Drug Count", "Total Units", "Inventory Value (LKR)", "% of Total Value"]],
    body: [
      ...categories.map(c => [
        c.name,
        c.count,
        c.units.toLocaleString(),
        c.value.toLocaleString("en-US", { minimumFractionDigits: 2 }),
        `${c.percentage}%`,
      ]),
      [
        "TOTAL",
        inventory.length,
        summary.totalUnits.toLocaleString(),
        summary.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 }),
        "100%",
      ],
    ],
    headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, cellPadding: 3.5 },
    alternateRowStyles: { fillColor: C.lightGray },
    columnStyles: {
      0: {},
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "right", fontStyle: "bold", textColor: C.green },
      4: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
    didParseCell: function(data) {
      const isLast = data.row.index === categories.length;
      if (isLast) {
        data.cell.styles.fontStyle  = "bold";
        data.cell.styles.fillColor  = [240, 253, 244];
        data.cell.styles.textColor  = C.navy;
        if (data.column.index === 3) data.cell.styles.textColor = C.green;
        if (data.column.index === 3 || data.column.index === 4) data.cell.styles.textColor = C.green;
      }
    },
  });

  // Sign-off
  const signY = doc.lastAutoTable.finalY + 20;
  if (signY < H - 30) {
    doc.setDrawColor(...C.midGray);
    doc.setLineWidth(0.5);
    doc.line(14, signY, W - 14, signY);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...C.textGray);
    doc.text("Pharmacist Signature: ____________________________", 14, signY + 7);
    doc.text(`Date: ${now.toLocaleDateString("en-GB")}`, W - 14, signY + 7, { align: "right" });
  }

  // ── Save ──────────────────────────────────────────────────────
  const filename = `Pharmacy_Inventory_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}.pdf`;
  doc.save(filename);
}

// ── The Button Component ─────────────────────────────────────────
export default function InventoryPDFButton({ className = "" }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`${API}/drugs/report/pdf`, { headers: authH() });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to fetch report data");
      buildPDF(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow transition hover:opacity-90 disabled:opacity-50 ${className}`}
        style={{ background: "linear-gradient(135deg, #0D2137, #263238)" }}
      >
        {loading ? (
          <>
            <span className="animate-spin text-base">⏳</span>
            Generating PDF…
          </>
        ) : (
          <>
            <span className="text-base">📄</span>
            Export Inventory PDF
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <span>❌</span> {error}
        </p>
      )}
    </div>
  );
}