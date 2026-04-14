import { db } from "../db/database";
import { createId, nowIso } from "../utils/common";

export interface InvestorRecord {
  investor_id: string;
  name: string;
  initial_balance: number;
  capital_returned: number;
  total_balance: number;
  purchased: number;
  total_profit: number;
  available: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

function cleanInvestorName(name: string | null | undefined): string {
  return (name || "").trim();
}

function isTrackedInvestor(name: string): boolean {
  const cleaned = cleanInvestorName(name);
  return Boolean(cleaned) && cleaned.toLowerCase() !== "sa";
}

export function ensureInvestorExists(name: string): void {
  const cleaned = cleanInvestorName(name);
  if (!isTrackedInvestor(cleaned)) {
    return;
  }
  const existing = db.prepare("SELECT investor_id FROM investors WHERE lower(name) = lower(?)").get(cleaned) as
    | { investor_id: string }
    | undefined;
  if (existing) {
    return;
  }
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO investors (
      investor_id,
      name,
      initial_balance,
      capital_returned,
      total_balance,
      purchased,
      total_profit,
      available,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, 0, 0, 0, 0, 0, 0, '', ?, ?)`,
  ).run(createId("investor"), cleaned, timestamp, timestamp);
}

export function upsertInvestorSnapshot(input: {
  name: string;
  initial_balance?: number;
  capital_returned?: number;
  total_balance?: number;
  purchased?: number;
  total_profit?: number;
  available?: number;
  notes?: string;
}): void {
  const cleaned = cleanInvestorName(input.name);
  if (!isTrackedInvestor(cleaned)) {
    return;
  }
  const timestamp = nowIso();
  const existing = db.prepare("SELECT investor_id FROM investors WHERE lower(name) = lower(?)").get(cleaned) as
    | { investor_id: string }
    | undefined;
  if (existing) {
    db.prepare(
      `UPDATE investors
       SET initial_balance = ?,
           capital_returned = ?,
           total_balance = ?,
           purchased = ?,
           total_profit = ?,
           available = ?,
           notes = ?,
           updated_at = ?
       WHERE investor_id = ?`,
    ).run(
      input.initial_balance || 0,
      input.capital_returned || 0,
      input.total_balance || 0,
      input.purchased || 0,
      input.total_profit || 0,
      input.available || 0,
      input.notes || "",
      timestamp,
      existing.investor_id,
    );
    return;
  }
  db.prepare(
    `INSERT INTO investors (
      investor_id,
      name,
      initial_balance,
      capital_returned,
      total_balance,
      purchased,
      total_profit,
      available,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    createId("investor"),
    cleaned,
    input.initial_balance || 0,
    input.capital_returned || 0,
    input.total_balance || 0,
    input.purchased || 0,
    input.total_profit || 0,
    input.available || 0,
    input.notes || "",
    timestamp,
    timestamp,
  );
}

export function recalculateInvestorSummaries(): void {
  const investors = db.prepare("SELECT * FROM investors").all() as InvestorRecord[];
  const purchasedByInvestor = db
    .prepare(
      `SELECT investor_name as name, COALESCE(SUM(total_cost), 0) as purchased
       FROM vehicles
       WHERE current_stage != 'sold' AND trim(investor_name) != '' AND lower(trim(investor_name)) != 'sa'
       GROUP BY investor_name`,
    )
    .all() as Array<{ name: string; purchased: number }>;
  const profitByInvestor = db
    .prepare(
      `SELECT investor_name as name, COALESCE(SUM(investor_profit), 0) as total_profit
       FROM sales
       WHERE trim(investor_name) != '' AND lower(trim(investor_name)) != 'sa'
       GROUP BY investor_name`,
    )
    .all() as Array<{ name: string; total_profit: number }>;

  const purchasedMap = new Map(purchasedByInvestor.map((row) => [row.name.toLowerCase(), Number(row.purchased || 0)]));
  const profitMap = new Map(profitByInvestor.map((row) => [row.name.toLowerCase(), Number(row.total_profit || 0)]));
  const update = db.prepare(
    `UPDATE investors
     SET total_balance = ?,
         purchased = ?,
         total_profit = ?,
         available = ?,
         updated_at = ?
     WHERE investor_id = ?`,
  );
  const updatedAt = nowIso();
  investors.forEach((investor) => {
    const key = investor.name.toLowerCase();
    const purchased = purchasedMap.get(key) || 0;
    const totalProfit = profitMap.get(key) || 0;
    const totalBalance = Number((investor.initial_balance + totalProfit - investor.capital_returned).toFixed(2));
    const available = Number((totalBalance - purchased).toFixed(2));
    update.run(totalBalance, purchased, totalProfit, available, updatedAt, investor.investor_id);
  });
}

export function listInvestors(): InvestorRecord[] {
  return db.prepare("SELECT * FROM investors ORDER BY name").all() as InvestorRecord[];
}
