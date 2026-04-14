import { db, nextStockId } from "../db/database";
import { appPaths } from "../config";
import {
  asNumber,
  createId,
  daysBetween,
  monthStart,
  normalizePlate,
  nowIso,
  safeJsonParse,
  toDisplayPlate,
} from "../utils/common";
import { ensureVehicleDirectories, toPublicUploadUrl } from "./storageService";
import { ensureInvestorExists } from "./investorService";

export interface VehicleRecord {
  stock_id: string;
  plate: string;
  normalized_plate: string;
  model: string;
  month: string;
  date_acquired: string;
  source: string;
  investor_name: string;
  purchase_price: number;
  recon_cost: number;
  total_cost: number;
  status: string;
  notes: string;
  current_stage: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleSummary extends VehicleRecord {
  days_in_stock: number;
  folder_root: string;
}

export interface VehicleInput {
  plate: string;
  model: string;
  month?: string;
  date_acquired?: string;
  source?: string;
  investor_name?: string;
  purchase_price?: number;
  recon_cost?: number;
  total_cost?: number;
  status?: string;
  notes?: string;
}

function mapVehicleRow(row: VehicleRecord): VehicleSummary {
  return {
    ...row,
    days_in_stock: row.current_stage === "sold" ? 0 : daysBetween(row.date_acquired),
    folder_root: `${appPaths.carsDir}/${row.stock_id}`,
  };
}

export function listCurrentVehicles(): VehicleSummary[] {
  const rows = db
    .prepare("SELECT * FROM vehicles WHERE current_stage != 'sold' ORDER BY date_acquired DESC, created_at DESC")
    .all() as VehicleRecord[];
  return rows.map(mapVehicleRow);
}

export function listAllVehicles(): VehicleSummary[] {
  const rows = db.prepare("SELECT * FROM vehicles ORDER BY date_acquired DESC, created_at DESC").all() as VehicleRecord[];
  return rows.map(mapVehicleRow);
}

export function getVehicleByStockId(stockId: string): VehicleSummary | null {
  const row = db.prepare("SELECT * FROM vehicles WHERE stock_id = ?").get(stockId) as VehicleRecord | undefined;
  return row ? mapVehicleRow(row) : null;
}

function insertVehicleAlias(stockId: string, plate: string, aliasType = "plate", sourceSheet = "", sourceValue = ""): void {
  const normalizedPlate = normalizePlate(plate);
  if (!normalizedPlate) {
    return;
  }
  db.prepare(
    `INSERT OR REPLACE INTO vehicle_aliases (alias_key, stock_id, alias_type, source_sheet, source_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(normalizedPlate, stockId, aliasType, sourceSheet, sourceValue, nowIso());
}

export function resolveVehicleReference(input: { stock_id?: string | null; plate?: string | null }): VehicleSummary | null {
  if (input.stock_id) {
    return getVehicleByStockId(input.stock_id);
  }
  const normalizedPlate = normalizePlate(input.plate);
  if (!normalizedPlate) {
    return null;
  }
  const directMatch = db.prepare("SELECT * FROM vehicles WHERE normalized_plate = ?").get(normalizedPlate) as
    | VehicleRecord
    | undefined;
  if (directMatch) {
    return mapVehicleRow(directMatch);
  }
  const alias = db.prepare("SELECT stock_id FROM vehicle_aliases WHERE alias_key = ?").get(normalizedPlate) as
    | { stock_id: string }
    | undefined;
  return alias ? getVehicleByStockId(alias.stock_id) : null;
}

export function createVehicle(input: VehicleInput & { stock_id?: string | null }): VehicleSummary {
  const timestamp = nowIso();
  const stockId = input.stock_id?.trim() || nextStockId();
  const plate = toDisplayPlate(input.plate);
  const normalizedPlate = normalizePlate(plate);
  const purchasePrice = asNumber(input.purchase_price);
  const reconCost = asNumber(input.recon_cost);
  const totalCost = input.total_cost !== undefined ? asNumber(input.total_cost) : purchasePrice + reconCost;
  const investorName = (input.investor_name || "").trim();
  ensureInvestorExists(investorName);

  db.prepare(
    `INSERT INTO vehicles (
      stock_id, plate, normalized_plate, model, month, date_acquired, source, investor_name,
      purchase_price, recon_cost, total_cost, status, notes, current_stage, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'stock', ?, ?)`,
  ).run(
    stockId,
    plate,
    normalizedPlate,
    input.model.trim(),
    input.month || monthStart(input.date_acquired),
    input.date_acquired || "",
    input.source || "",
    investorName,
    purchasePrice,
    reconCost,
    totalCost,
    input.status || "In Stock",
    input.notes || "",
    timestamp,
    timestamp,
  );

  insertVehicleAlias(stockId, plate);
  ensureVehicleDirectories(stockId);
  return getVehicleByStockId(stockId)!;
}

export function updateVehicle(stockId: string, input: Partial<VehicleInput>): VehicleSummary | null {
  const existing = getVehicleByStockId(stockId);
  if (!existing) {
    return null;
  }
  const plate = input.plate !== undefined ? toDisplayPlate(input.plate) : existing.plate;
  const normalizedPlate = normalizePlate(plate);
  const investorName = input.investor_name !== undefined ? input.investor_name.trim() : existing.investor_name;
  ensureInvestorExists(investorName);
  db.prepare(
    `UPDATE vehicles
     SET plate = ?, normalized_plate = ?, model = ?, month = ?, date_acquired = ?, source = ?, investor_name = ?,
         purchase_price = ?, recon_cost = ?, total_cost = ?, status = ?, notes = ?, updated_at = ?
     WHERE stock_id = ?`,
  ).run(
    plate,
    normalizedPlate,
    input.model !== undefined ? input.model.trim() : existing.model,
    input.month !== undefined ? input.month : existing.month,
    input.date_acquired !== undefined ? input.date_acquired : existing.date_acquired,
    input.source !== undefined ? input.source : existing.source,
    investorName,
    input.purchase_price !== undefined ? asNumber(input.purchase_price) : existing.purchase_price,
    input.recon_cost !== undefined ? asNumber(input.recon_cost) : existing.recon_cost,
    input.total_cost !== undefined ? asNumber(input.total_cost) : existing.total_cost,
    input.status !== undefined ? input.status : existing.status,
    input.notes !== undefined ? input.notes : existing.notes,
    nowIso(),
    stockId,
  );
  insertVehicleAlias(stockId, plate);
  return getVehicleByStockId(stockId);
}

export function markVehicleSold(stockId: string, status = "Sold"): void {
  db.prepare("UPDATE vehicles SET current_stage = 'sold', status = ?, updated_at = ? WHERE stock_id = ?").run(
    status,
    nowIso(),
    stockId,
  );
}

export function applyVehicleCostDelta(stockId: string, amountDelta: number): void {
  db.prepare(
    `UPDATE vehicles
     SET recon_cost = recon_cost + ?,
         total_cost = total_cost + ?,
         updated_at = ?
     WHERE stock_id = ?`,
  ).run(amountDelta, amountDelta, nowIso(), stockId);
}

export function replaceVehicleCosts(stockId: string, purchasePrice: number, reconCost: number, totalCost: number): void {
  db.prepare(
    `UPDATE vehicles
     SET purchase_price = ?, recon_cost = ?, total_cost = ?, updated_at = ?
     WHERE stock_id = ?`,
  ).run(purchasePrice, reconCost, totalCost, nowIso(), stockId);
}

export function clearDomainDataForImport(): void {
  [
    "DELETE FROM sales",
    "DELETE FROM invoices",
    "DELETE FROM files",
    "DELETE FROM receipts",
    "DELETE FROM fines",
    "DELETE FROM service_records",
    "DELETE FROM collections",
    "DELETE FROM expenses",
    "DELETE FROM viewings",
    "DELETE FROM wage_payments",
    "DELETE FROM vehicle_aliases",
    "DELETE FROM vehicles",
  ].forEach((statement) => db.prepare(statement).run());
}

export function vehicleFileSummary(stockId: string): { photos: string[]; documents: string[] } {
  const rows = db
    .prepare("SELECT category, relative_path FROM files WHERE stock_id = ? ORDER BY created_at DESC")
    .all(stockId) as Array<{ category: string; relative_path: string }>;
  return {
    photos: rows.filter((row) => row.category === "Photos").map((row) => toPublicUploadUrl(row.relative_path)),
    documents: rows.filter((row) => row.category !== "Photos").map((row) => toPublicUploadUrl(row.relative_path)),
  };
}

export function vehicleLookupMap(): Map<string, string> {
  const rows = db.prepare("SELECT stock_id, plate, normalized_plate FROM vehicles").all() as VehicleRecord[];
  const map = new Map<string, string>();
  rows.forEach((row) => {
    if (row.stock_id) {
      map.set(row.stock_id, row.stock_id);
    }
    if (row.normalized_plate) {
      map.set(row.normalized_plate, row.stock_id);
    }
  });
  const aliases = db.prepare("SELECT alias_key, stock_id FROM vehicle_aliases").all() as Array<{ alias_key: string; stock_id: string }>;
  aliases.forEach((row) => {
    map.set(row.alias_key, row.stock_id);
  });
  return map;
}

export function linkedVehiclesFromJson(value: string): string[] {
  return safeJsonParse<string[]>(value, []);
}

export function upsertImportedVehicle(input: VehicleInput & { stock_id?: string | null; source_sheet?: string }): VehicleSummary {
  const resolved = resolveVehicleReference({ stock_id: input.stock_id, plate: input.plate });
  if (resolved) {
    return updateVehicle(resolved.stock_id, input) || resolved;
  }
  const created = createVehicle(input);
  if (input.source_sheet) {
    insertVehicleAlias(created.stock_id, input.plate, "plate", input.source_sheet, input.plate);
  }
  return created;
}

export function listSoldVehicleShells(): Array<{ stock_id: string; plate: string; model: string; investor_name: string; date_acquired: string }> {
  return db
    .prepare("SELECT stock_id, plate, model, investor_name, date_acquired FROM vehicles WHERE current_stage = 'sold'")
    .all() as Array<{ stock_id: string; plate: string; model: string; investor_name: string; date_acquired: string }>;
}
