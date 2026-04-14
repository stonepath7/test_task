import { db, withTransaction } from "../db/database";
import {
  asNumber,
  createId,
  daysBetween,
  monthStart,
  nowIso,
  todayIso,
  toDisplayPlate,
} from "../utils/common";
import { registerFileRecord } from "./fileService";
import { ensureInvestorExists, recalculateInvestorSummaries } from "./investorService";
import { saveInvoiceHtml } from "./storageService";
import {
  applyVehicleCostDelta,
  getVehicleByStockId,
  markVehicleSold,
  resolveVehicleReference,
  VehicleSummary,
} from "./vehiclesService";

export interface FinanceLogEntry {
  expense_id: string;
  stock_id: string | null;
  plate: string;
  model: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  direction: string;
  entry_type: string;
  source_label: string;
  payment_method: string;
  paid_by: string;
  notes: string;
}

export interface SaleSummary {
  sale_id: string;
  stock_id: string;
  plate: string;
  model: string;
  month: string;
  date_acquired: string;
  date_sold: string;
  days_to_sell: number;
  total_cost: number;
  sold_price: number;
  profit: number;
  investor: string;
  investor_profit_share_pct: number;
  investor_profit: number;
  mp_profit: number;
  platform: string;
  invoice_number: string;
  customer_name: string;
  contact_info: string;
  warranty: string;
  autoguard_number: string;
  status: string;
}

export interface InvoiceSummary {
  invoice_id: string;
  invoice_number: string;
  stock_id: string;
  plate: string;
  model: string;
  sale_date: string;
  sale_price: number;
  cost_total: number;
  profit_total: number;
  investor_name: string;
  investor_profit: number;
  mp_profit: number;
  html_content: string;
}

export interface ExpenseInput {
  stock_id?: string | null;
  plate?: string | null;
  category: string;
  description: string;
  amount: number;
  date?: string;
  payment_method?: string;
  paid_by?: string;
  source_label?: string;
  notes?: string;
  entry_type?: string;
  direction?: "in" | "out";
  workbook_sheet?: string;
  apply_to_vehicle_costs?: boolean;
}

export interface ReceiptInput {
  stock_id?: string | null;
  plate?: string | null;
  category: string;
  notes: string;
  amount: number;
  date?: string;
  file_id?: string;
}

export interface FineInput {
  stock_id?: string | null;
  plate?: string | null;
  type: string;
  date?: string;
  amount: number;
  due_date?: string;
  reference?: string;
  notes?: string;
  status?: string;
}

export interface SellVehicleInput {
  stock_id: string;
  sold_price: number;
  sale_date?: string;
  investor_name?: string;
  investor_profit_share_pct?: number;
  platform?: string;
  invoice_number?: string;
  customer_name?: string;
  contact_info?: string;
  warranty?: string;
  autoguard_number?: string;
  notes?: string;
}

function financeEntryToRow(row: Record<string, unknown>): FinanceLogEntry {
  return {
    expense_id: String(row.expense_id),
    stock_id: (row.stock_id as string | null) || null,
    plate: String(row.plate || ""),
    model: String(row.model || ""),
    description: String(row.description || ""),
    category: String(row.category || "Other"),
    amount: Number(row.amount || 0),
    date: String(row.date || ""),
    direction: String(row.direction || "out"),
    entry_type: String(row.entry_type || "expense"),
    source_label: String(row.source_label || ""),
    payment_method: String(row.payment_method || ""),
    paid_by: String(row.paid_by || ""),
    notes: String(row.notes || ""),
  };
}

function buildInvoiceNumber(vehicle: VehicleSummary, explicitValue?: string): string {
  return explicitValue?.trim() || `${vehicle.stock_id}-${Date.now().toString().slice(-6)}`;
}

function buildInvoiceHtml(args: {
  vehicle: VehicleSummary;
  invoiceNumber: string;
  saleDate: string;
  soldPrice: number;
  totalCost: number;
  profit: number;
  investorName: string;
  investorPct: number;
  investorProfit: number;
  mpProfit: number;
  customerName: string;
  contactInfo: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${args.invoiceNumber}</title>
<style>
body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
.wrap { max-width: 820px; margin: 0 auto; }
.title { font-size: 30px; font-weight: 700; margin-bottom: 8px; }
.meta { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
.muted { color: #666; font-size: 12px; line-height: 1.6; }
table { width: 100%; border-collapse: collapse; margin-top: 16px; }
th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
th { background: #f5f5f5; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; }
.strong { font-weight: 700; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="title">DealerOS Invoice</div>
    <div class="meta">
      <div class="muted">
        <div><strong>Invoice:</strong> ${args.invoiceNumber}</div>
        <div><strong>Stock ID:</strong> ${args.vehicle.stock_id}</div>
        <div><strong>Vehicle:</strong> ${args.vehicle.model} (${args.vehicle.plate})</div>
        <div><strong>Sale Date:</strong> ${args.saleDate}</div>
      </div>
      <div class="muted">
        <div><strong>Customer:</strong> ${args.customerName || "N/A"}</div>
        <div><strong>Contact:</strong> ${args.contactInfo || "N/A"}</div>
        <div><strong>Investor:</strong> ${args.investorName || "SA"}</div>
        <div><strong>Investor Share:</strong> ${args.investorPct}%</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Purchase + Recon Total</td><td>£${args.totalCost.toFixed(2)}</td></tr>
        <tr><td>Sale Price</td><td>£${args.soldPrice.toFixed(2)}</td></tr>
        <tr><td class="strong">Gross Profit</td><td class="strong">£${args.profit.toFixed(2)}</td></tr>
        <tr><td>Investor Profit</td><td>£${args.investorProfit.toFixed(2)}</td></tr>
        <tr><td>Company Profit</td><td>£${args.mpProfit.toFixed(2)}</td></tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

export function listFinanceLog(): FinanceLogEntry[] {
  const rows = db
    .prepare(
      `SELECT e.*, v.plate as plate, v.model as model
       FROM expenses e
       LEFT JOIN vehicles v ON v.stock_id = e.stock_id
       ORDER BY COALESCE(e.date, '') DESC, e.created_at DESC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map(financeEntryToRow);
}

export function createExpense(input: ExpenseInput): FinanceLogEntry {
  const resolvedVehicle = resolveVehicleReference({ stock_id: input.stock_id, plate: input.plate });
  const stockId = resolvedVehicle?.stock_id || null;
  const amount = asNumber(input.amount);
  const applyToVehicleCosts =
    input.apply_to_vehicle_costs !== undefined ? input.apply_to_vehicle_costs : Boolean(stockId) && (input.direction || "out") !== "in";
  const timestamp = nowIso();
  const expenseId = createId("exp");
  db.prepare(
    `INSERT INTO expenses (
      expense_id, stock_id, legacy_plate, category, source_label, description, amount, payment_method, paid_by,
      month, date, entry_type, direction, notes, workbook_sheet, linked_sale_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
  ).run(
    expenseId,
    stockId,
    resolvedVehicle?.plate || toDisplayPlate(input.plate),
    input.category || "Other",
    input.source_label || "",
    input.description,
    amount,
    input.payment_method || "",
    input.paid_by || "",
    monthStart(input.date),
    input.date || todayIso(),
    input.entry_type || "expense",
    input.direction || "out",
    input.notes || "",
    input.workbook_sheet || "",
    timestamp,
    timestamp,
  );
  if (stockId && applyToVehicleCosts) {
    applyVehicleCostDelta(stockId, amount);
    recalculateInvestorSummaries();
  }
  const row = db
    .prepare(
      `SELECT e.*, v.plate as plate, v.model as model
       FROM expenses e
       LEFT JOIN vehicles v ON v.stock_id = e.stock_id
       WHERE e.expense_id = ?`,
    )
    .get(expenseId) as Record<string, unknown>;
  return financeEntryToRow(row);
}

export function createReceipt(input: ReceiptInput): { receipt_id: string; expense: FinanceLogEntry } {
  const resolvedVehicle = resolveVehicleReference({ stock_id: input.stock_id, plate: input.plate });
  const expense = createExpense({
    stock_id: resolvedVehicle?.stock_id,
    plate: resolvedVehicle?.plate || input.plate,
    category: input.category,
    description: `${input.notes || input.category} (receipt)`,
    amount: input.amount,
    date: input.date,
    entry_type: "receipt",
    direction: "out",
  });
  const receiptId = createId("receipt");
  db.prepare(
    `INSERT INTO receipts (
      receipt_id, stock_id, legacy_plate, model, category, notes, amount, date, file_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    receiptId,
    resolvedVehicle?.stock_id || null,
    resolvedVehicle?.plate || toDisplayPlate(input.plate),
    resolvedVehicle?.model || "",
    input.category,
    input.notes || "",
    asNumber(input.amount),
    input.date || todayIso(),
    input.file_id || "",
    nowIso(),
    nowIso(),
  );
  return { receipt_id: receiptId, expense };
}

export function listReceipts(): Array<{
  receipt_id: string;
  stock_id: string | null;
  plate: string;
  model: string;
  category: string;
  notes: string;
  amount: number;
  date: string;
  file_id: string;
  file_path: string | null;
}> {
  return db
    .prepare(
      `SELECT r.*, v.plate as plate, v.model as model, f.relative_path as file_path
       FROM receipts r
       LEFT JOIN vehicles v ON v.stock_id = r.stock_id
       LEFT JOIN files f ON f.file_id = r.file_id
       ORDER BY r.date DESC, r.created_at DESC`,
    )
    .all() as Array<{
    receipt_id: string;
    stock_id: string | null;
    plate: string;
    model: string;
    category: string;
    notes: string;
    amount: number;
    date: string;
    file_id: string;
    file_path: string | null;
  }>;
}

export function createFine(input: FineInput): {
  fine_id: string;
  stock_id: string | null;
  plate: string;
  type: string;
  date: string;
  amount: number;
  due_date: string;
  reference: string;
  notes: string;
  status: string;
} {
  const resolvedVehicle = resolveVehicleReference({ stock_id: input.stock_id, plate: input.plate });
  const fineId = createId("fine");
  db.prepare(
    `INSERT INTO fines (
      fine_id, stock_id, legacy_plate, type, date, amount, due_date, reference, notes, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    fineId,
    resolvedVehicle?.stock_id || null,
    resolvedVehicle?.plate || toDisplayPlate(input.plate),
    input.type || "",
    input.date || todayIso(),
    asNumber(input.amount),
    input.due_date || "",
    input.reference || "",
    input.notes || "",
    input.status || "Unpaid",
    nowIso(),
    nowIso(),
  );
  return db.prepare("SELECT * FROM fines WHERE fine_id = ?").get(fineId) as {
    fine_id: string;
    stock_id: string | null;
    plate: string;
    type: string;
    date: string;
    amount: number;
    due_date: string;
    reference: string;
    notes: string;
    status: string;
  };
}

export function updateFineStatus(fineId: string, status: string): void {
  db.prepare("UPDATE fines SET status = ?, updated_at = ? WHERE fine_id = ?").run(status, nowIso(), fineId);
}

export function listFines(): Array<{
  fine_id: string;
  stock_id: string | null;
  plate: string;
  type: string;
  date: string;
  amount: number;
  due_date: string;
  reference: string;
  notes: string;
  status: string;
}> {
  return db
    .prepare(
      `SELECT f.*, v.plate as plate
       FROM fines f
       LEFT JOIN vehicles v ON v.stock_id = f.stock_id
       ORDER BY f.date DESC, f.created_at DESC`,
    )
    .all() as Array<{
    fine_id: string;
    stock_id: string | null;
    plate: string;
    type: string;
    date: string;
    amount: number;
    due_date: string;
    reference: string;
    notes: string;
    status: string;
  }>;
}

export function sellVehicle(input: SellVehicleInput): { sale: SaleSummary; invoice: InvoiceSummary } {
  return withTransaction(() => {
    const vehicle = getVehicleByStockId(input.stock_id);
    if (!vehicle) {
      throw new Error(`Unknown vehicle reference: ${input.stock_id}`);
    }
    if (vehicle.current_stage === "sold") {
      throw new Error(`Vehicle ${vehicle.stock_id} is already sold.`);
    }
    const saleDate = input.sale_date || todayIso();
    const soldPrice = asNumber(input.sold_price);
    const totalCost = asNumber(vehicle.total_cost);
    const profit = Number((soldPrice - totalCost).toFixed(2));
    const investorName = (input.investor_name || vehicle.investor_name || "SA").trim();
    ensureInvestorExists(investorName);
    const investorPct = investorName && investorName.toLowerCase() !== "sa" ? asNumber(input.investor_profit_share_pct, 30) : 0;
    const investorProfit = Number(((profit * investorPct) / 100).toFixed(2));
    const mpProfit = Number((profit - investorProfit).toFixed(2));
    const invoiceNumber = buildInvoiceNumber(vehicle, input.invoice_number);
    const saleId = createId("sale");
    const invoiceId = createId("invoice");
    const invoiceHtml = buildInvoiceHtml({
      vehicle,
      invoiceNumber,
      saleDate,
      soldPrice,
      totalCost,
      profit,
      investorName,
      investorPct,
      investorProfit,
      mpProfit,
      customerName: input.customer_name || "",
      contactInfo: input.contact_info || "",
    });

    db.prepare(
      `INSERT INTO sales (
        sale_id, stock_id, month, date_sold, sold_price, total_cost, profit, investor_name,
        investor_profit_share_pct, investor_profit, mp_profit, platform, invoice_number,
        customer_name, contact_info, warranty, autoguard_number, part_exchange_value, date_listed,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?)`,
    ).run(
      saleId,
      vehicle.stock_id,
      monthStart(saleDate),
      saleDate,
      soldPrice,
      totalCost,
      profit,
      investorName,
      investorPct,
      investorProfit,
      mpProfit,
      input.platform || "",
      invoiceNumber,
      input.customer_name || "",
      input.contact_info || "",
      input.warranty || "",
      input.autoguard_number || "",
      nowIso(),
      nowIso(),
    );

    const savedInvoice = saveInvoiceHtml(vehicle.stock_id, invoiceNumber, invoiceHtml);
    registerFileRecord({
      file_id: savedInvoice.fileId,
      stock_id: vehicle.stock_id,
      invoice_id: invoiceId,
      entity_type: "invoice",
      entity_id: invoiceId,
      category: "Invoice",
      original_name: `${invoiceNumber}.html`,
      stored_name: savedInvoice.storedName,
      relative_path: savedInvoice.relativePath,
      mime_type: "text/html",
      size_bytes: Buffer.byteLength(invoiceHtml),
    });

    db.prepare(
      `INSERT INTO invoices (
        invoice_id, stock_id, sale_id, invoice_number, sale_date, sale_price, cost_total, profit_total,
        investor_name, investor_profit_share_pct, investor_profit, mp_profit, customer_name, contact_info,
        html_content, file_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      invoiceId,
      vehicle.stock_id,
      saleId,
      invoiceNumber,
      saleDate,
      soldPrice,
      totalCost,
      profit,
      investorName,
      investorPct,
      investorProfit,
      mpProfit,
      input.customer_name || "",
      input.contact_info || "",
      invoiceHtml,
      savedInvoice.fileId,
      nowIso(),
      nowIso(),
    );

    createExpense({
      stock_id: vehicle.stock_id,
      plate: vehicle.plate,
      category: "Money In",
      description: `Vehicle sale · ${vehicle.model}`,
      amount: soldPrice,
      date: saleDate,
      entry_type: "sale",
      direction: "in",
      apply_to_vehicle_costs: false,
    });

    markVehicleSold(vehicle.stock_id);
    recalculateInvestorSummaries();

    const sale = db
      .prepare(
        `SELECT s.*, v.plate as plate, v.model as model, v.date_acquired as date_acquired
         FROM sales s
         JOIN vehicles v ON v.stock_id = s.stock_id
         WHERE s.sale_id = ?`,
      )
      .get(saleId) as Record<string, unknown>;
    const invoice = db
      .prepare(
        `SELECT i.*, v.plate as plate, v.model as model
         FROM invoices i
         JOIN vehicles v ON v.stock_id = i.stock_id
         WHERE i.invoice_id = ?`,
      )
      .get(invoiceId) as Record<string, unknown>;

    return {
      sale: {
        sale_id: String(sale.sale_id),
        stock_id: String(sale.stock_id),
        plate: String(sale.plate || vehicle.plate),
        model: String(sale.model || vehicle.model),
        month: String(sale.month || monthStart(saleDate)),
        date_acquired: String(sale.date_acquired || vehicle.date_acquired),
        date_sold: String(sale.date_sold || saleDate),
        days_to_sell: daysBetween(String(sale.date_acquired || vehicle.date_acquired), String(sale.date_sold || saleDate)),
        total_cost: Number(sale.total_cost || totalCost),
        sold_price: Number(sale.sold_price || soldPrice),
        profit: Number(sale.profit || profit),
        investor: String(sale.investor_name || investorName),
        investor_profit_share_pct: Number(sale.investor_profit_share_pct || investorPct),
        investor_profit: Number(sale.investor_profit || investorProfit),
        mp_profit: Number(sale.mp_profit || mpProfit),
        platform: String(sale.platform || ""),
        invoice_number: String(sale.invoice_number || invoiceNumber),
        customer_name: String(sale.customer_name || ""),
        contact_info: String(sale.contact_info || ""),
        warranty: String(sale.warranty || ""),
        autoguard_number: String(sale.autoguard_number || ""),
        status: "Sold",
      },
      invoice: {
        invoice_id: String(invoice.invoice_id),
        invoice_number: String(invoice.invoice_number),
        stock_id: String(invoice.stock_id),
        plate: String(invoice.plate || vehicle.plate),
        model: String(invoice.model || vehicle.model),
        sale_date: String(invoice.sale_date || saleDate),
        sale_price: Number(invoice.sale_price || soldPrice),
        cost_total: Number(invoice.cost_total || totalCost),
        profit_total: Number(invoice.profit_total || profit),
        investor_name: String(invoice.investor_name || investorName),
        investor_profit: Number(invoice.investor_profit || investorProfit),
        mp_profit: Number(invoice.mp_profit || mpProfit),
        html_content: String(invoice.html_content || invoiceHtml),
      },
    };
  });
}

export function upsertImportedSale(input: {
  stock_id: string;
  month?: string;
  date_sold?: string;
  sold_price?: number;
  total_cost?: number;
  profit?: number;
  investor_name?: string;
  investor_profit_share_pct?: number;
  investor_profit?: number;
  mp_profit?: number;
  platform?: string;
  invoice_number?: string;
  customer_name?: string;
  contact_info?: string;
  warranty?: string;
  autoguard_number?: string;
  date_listed?: string;
}): void {
  const vehicle = getVehicleByStockId(input.stock_id);
  if (!vehicle) {
    return;
  }
  ensureInvestorExists(input.investor_name || vehicle.investor_name);
  const existing = db.prepare("SELECT sale_id FROM sales WHERE stock_id = ?").get(input.stock_id) as
    | { sale_id: string }
    | undefined;
  const saleId = existing?.sale_id || createId("sale");
  const timestamp = nowIso();
  db.prepare(
    `INSERT OR REPLACE INTO sales (
      sale_id, stock_id, month, date_sold, sold_price, total_cost, profit, investor_name,
      investor_profit_share_pct, investor_profit, mp_profit, platform, invoice_number, customer_name,
      contact_info, warranty, autoguard_number, part_exchange_value, date_listed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
  ).run(
    saleId,
    input.stock_id,
    input.month || monthStart(input.date_sold),
    input.date_sold || "",
    asNumber(input.sold_price),
    asNumber(input.total_cost, vehicle.total_cost),
    asNumber(input.profit),
    input.investor_name || vehicle.investor_name,
    asNumber(input.investor_profit_share_pct),
    asNumber(input.investor_profit),
    asNumber(input.mp_profit),
    input.platform || "",
    input.invoice_number || "",
    input.customer_name || "",
    input.contact_info || "",
    input.warranty || "",
    input.autoguard_number || "",
    input.date_listed || "",
    timestamp,
    timestamp,
  );
  markVehicleSold(input.stock_id);
}

export function listSales(): SaleSummary[] {
  const rows = db
    .prepare(
      `SELECT s.*, v.plate, v.model, v.date_acquired
       FROM sales s
       JOIN vehicles v ON v.stock_id = s.stock_id
       ORDER BY s.date_sold DESC, s.created_at DESC`,
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    sale_id: String(row.sale_id),
    stock_id: String(row.stock_id),
    plate: String(row.plate || ""),
    model: String(row.model || ""),
    month: String(row.month || ""),
    date_acquired: String(row.date_acquired || ""),
    date_sold: String(row.date_sold || ""),
    days_to_sell: daysBetween(String(row.date_acquired || ""), String(row.date_sold || "")),
    total_cost: Number(row.total_cost || 0),
    sold_price: Number(row.sold_price || 0),
    profit: Number(row.profit || 0),
    investor: String(row.investor_name || ""),
    investor_profit_share_pct: Number(row.investor_profit_share_pct || 0),
    investor_profit: Number(row.investor_profit || 0),
    mp_profit: Number(row.mp_profit || 0),
    platform: String(row.platform || ""),
    invoice_number: String(row.invoice_number || ""),
    customer_name: String(row.customer_name || ""),
    contact_info: String(row.contact_info || ""),
    warranty: String(row.warranty || ""),
    autoguard_number: String(row.autoguard_number || ""),
    status: "Sold",
  }));
}

export function listInvoices(): InvoiceSummary[] {
  return db
    .prepare(
      `SELECT i.*, v.plate, v.model
       FROM invoices i
       JOIN vehicles v ON v.stock_id = i.stock_id
       ORDER BY i.sale_date DESC, i.created_at DESC`,
    )
    .all() as InvoiceSummary[];
}
