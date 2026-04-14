import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

import { appConfig } from "../config";
import { createId, nowIso } from "../utils/common";

const dbDirectory = path.dirname(appConfig.dbPath);
fs.mkdirSync(dbDirectory, { recursive: true });

export const db = new Database(appConfig.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS vehicles (
    stock_id TEXT PRIMARY KEY,
    plate TEXT NOT NULL DEFAULT '',
    normalized_plate TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    month TEXT NOT NULL DEFAULT '',
    date_acquired TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    investor_name TEXT NOT NULL DEFAULT '',
    purchase_price REAL NOT NULL DEFAULT 0,
    recon_cost REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'In Stock',
    notes TEXT NOT NULL DEFAULT '',
    current_stage TEXT NOT NULL DEFAULT 'stock',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(normalized_plate)`,
  `CREATE TABLE IF NOT EXISTS vehicle_aliases (
    alias_key TEXT PRIMARY KEY,
    stock_id TEXT NOT NULL,
    alias_type TEXT NOT NULL,
    source_sheet TEXT NOT NULL DEFAULT '',
    source_value TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(stock_id) REFERENCES vehicles(stock_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
    sale_id TEXT PRIMARY KEY,
    stock_id TEXT NOT NULL,
    month TEXT NOT NULL DEFAULT '',
    date_sold TEXT NOT NULL DEFAULT '',
    sold_price REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    profit REAL NOT NULL DEFAULT 0,
    investor_name TEXT NOT NULL DEFAULT '',
    investor_profit_share_pct REAL NOT NULL DEFAULT 0,
    investor_profit REAL NOT NULL DEFAULT 0,
    mp_profit REAL NOT NULL DEFAULT 0,
    platform TEXT NOT NULL DEFAULT '',
    invoice_number TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL DEFAULT '',
    contact_info TEXT NOT NULL DEFAULT '',
    warranty TEXT NOT NULL DEFAULT '',
    autoguard_number TEXT NOT NULL DEFAULT '',
    part_exchange_value REAL NOT NULL DEFAULT 0,
    date_listed TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(stock_id) REFERENCES vehicles(stock_id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sales_stock_id ON sales(stock_id)`,
  `CREATE TABLE IF NOT EXISTS investors (
    investor_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    initial_balance REAL NOT NULL DEFAULT 0,
    capital_returned REAL NOT NULL DEFAULT 0,
    total_balance REAL NOT NULL DEFAULT 0,
    purchased REAL NOT NULL DEFAULT 0,
    total_profit REAL NOT NULL DEFAULT 0,
    available REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS expenses (
    expense_id TEXT PRIMARY KEY,
    stock_id TEXT,
    legacy_plate TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Other',
    source_label TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT '',
    paid_by TEXT NOT NULL DEFAULT '',
    month TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    entry_type TEXT NOT NULL DEFAULT 'expense',
    direction TEXT NOT NULL DEFAULT 'out',
    notes TEXT NOT NULL DEFAULT '',
    workbook_sheet TEXT NOT NULL DEFAULT '',
    linked_sale_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(stock_id) REFERENCES vehicles(stock_id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_stock_id ON expenses(stock_id)`,
  `CREATE TABLE IF NOT EXISTS collections (
    collection_id TEXT PRIMARY KEY,
    stock_id TEXT,
    legacy_plate TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'Incoming',
    source TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    date_won TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    scheduled_date TEXT NOT NULL DEFAULT '',
    driver TEXT NOT NULL DEFAULT '',
    addr TEXT NOT NULL DEFAULT '',
    postcode TEXT NOT NULL DEFAULT '',
    distance_note TEXT NOT NULL DEFAULT '',
    cost REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending',
    notes TEXT NOT NULL DEFAULT '',
    days_pending INTEGER NOT NULL DEFAULT 0,
    number_value TEXT NOT NULL DEFAULT '',
    linked_vehicles_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(stock_id) REFERENCES vehicles(stock_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS service_records (
    service_id TEXT PRIMARY KEY,
    stock_id TEXT,
    legacy_plate TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    service_type TEXT NOT NULL DEFAULT 'Service',
    date TEXT NOT NULL DEFAULT '',
    mileage INTEGER NOT NULL DEFAULT 0,
    stamps INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    reference TEXT NOT NULL DEFAULT '',
    file_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(stock_id) REFERENCES vehicles(stock_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS fines (
    fine_id TEXT PRIMARY KEY,
    stock_id TEXT,
    legacy_plate TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL DEFAULT '',
    reference TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Unpaid',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(stock_id) REFERENCES vehicles(stock_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS receipts (
    receipt_id TEXT PRIMARY KEY,
    stock_id TEXT,
    legacy_plate TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Other',
    notes TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    date TEXT NOT NULL DEFAULT '',
    file_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(stock_id) REFERENCES vehicles(stock_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    invoice_id TEXT PRIMARY KEY,
    stock_id TEXT NOT NULL,
    sale_id TEXT NOT NULL DEFAULT '',
    invoice_number TEXT NOT NULL UNIQUE,
    sale_date TEXT NOT NULL DEFAULT '',
    sale_price REAL NOT NULL DEFAULT 0,
    cost_total REAL NOT NULL DEFAULT 0,
    profit_total REAL NOT NULL DEFAULT 0,
    investor_name TEXT NOT NULL DEFAULT '',
    investor_profit_share_pct REAL NOT NULL DEFAULT 0,
    investor_profit REAL NOT NULL DEFAULT 0,
    mp_profit REAL NOT NULL DEFAULT 0,
    customer_name TEXT NOT NULL DEFAULT '',
    contact_info TEXT NOT NULL DEFAULT '',
    html_content TEXT NOT NULL DEFAULT '',
    file_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(stock_id) REFERENCES vehicles(stock_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS files (
    file_id TEXT PRIMARY KEY,
    stock_id TEXT,
    investor_name TEXT NOT NULL DEFAULT '',
    invoice_id TEXT NOT NULL DEFAULT '',
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(stock_id) REFERENCES vehicles(stock_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS viewings (
    viewing_id TEXT PRIMARY KEY,
    stock_id TEXT,
    vehicle_label TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    time TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Booked',
    source TEXT NOT NULL DEFAULT 'Website',
    finance TEXT NOT NULL DEFAULT 'No',
    delivery TEXT NOT NULL DEFAULT 'No',
    outcome TEXT NOT NULL DEFAULT 'Booked',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(stock_id) REFERENCES vehicles(stock_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS staff (
    staff_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT '',
    pay_type TEXT NOT NULL DEFAULT 'Per Job',
    rate REAL NOT NULL DEFAULT 0,
    phone TEXT NOT NULL DEFAULT '',
    owed REAL NOT NULL DEFAULT 0,
    paid REAL NOT NULL DEFAULT 0,
    linked_stock_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS wage_payments (
    payment_id TEXT PRIMARY KEY,
    staff_id TEXT,
    amount REAL NOT NULL DEFAULT 0,
    date TEXT NOT NULL DEFAULT '',
    period TEXT NOT NULL DEFAULT '',
    method TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(staff_id) REFERENCES staff(staff_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_runs (
    sync_id TEXT PRIMARY KEY,
    direction TEXT NOT NULL,
    workbook_path TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT '',
    details_json TEXT NOT NULL DEFAULT '{}'
  )`,
];

schemaStatements.forEach((statement) => db.prepare(statement).run());

const existingSeedSetting = db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").get("stock_counter") as
  | { setting_value: string }
  | undefined;

if (!existingSeedSetting) {
  db.prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)").run("stock_counter", "0");
}

const existingStaffCount = db.prepare("SELECT COUNT(*) as count FROM staff").get() as { count: number };
if (existingStaffCount.count === 0) {
  const insertedAt = nowIso();
  const insert = db.prepare(
    `INSERT INTO staff (staff_id, name, role, pay_type, rate, phone, owed, paid, linked_stock_id, created_at, updated_at)
     VALUES (@staff_id, @name, @role, @pay_type, @rate, @phone, @owed, @paid, @linked_stock_id, @created_at, @updated_at)`,
  );
  [
    {
      staff_id: createId("staff"),
      name: "Jatin",
      role: "Driver / Runner",
      pay_type: "Per Job",
      rate: 80,
      phone: "",
      owed: 0,
      paid: 0,
      linked_stock_id: "",
      created_at: insertedAt,
      updated_at: insertedAt,
    },
    {
      staff_id: createId("staff"),
      name: "Ernest",
      role: "Prep / Bodywork",
      pay_type: "Per Car",
      rate: 150,
      phone: "",
      owed: 0,
      paid: 0,
      linked_stock_id: "",
      created_at: insertedAt,
      updated_at: insertedAt,
    },
  ].forEach((row) => insert.run(row));
}

export function nextStockId(): string {
  const current = db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").get("stock_counter") as {
    setting_value: string;
  };
  const nextValue = Number(current?.setting_value || "0") + 1;
  db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ?").run(String(nextValue), "stock_counter");
  return `STK-${String(nextValue).padStart(5, "0")}`;
}

export function withTransaction<T>(callback: () => T): T {
  const transaction = db.transaction(callback);
  return transaction();
}
