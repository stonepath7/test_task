import { db } from "../db/database";
import { asNumber, createId, nowIso, safeJsonParse, todayIso } from "../utils/common";
import { resolveVehicleReference } from "./vehiclesService";

export function listCollections(): Array<{
  collection_id: string;
  stock_id: string | null;
  plate: string;
  model: string;
  type: string;
  source: string;
  date_won: string;
  date: string;
  scheduled_date: string;
  driver: string;
  addr: string;
  postcode: string;
  distance_note: string;
  cost: number;
  status: string;
  notes: string;
  days_pending: number;
  number_value: string;
  linked_stock_ids: string[];
}> {
  const rows = db
    .prepare(
      `SELECT c.*, v.plate as vehicle_plate, v.model as vehicle_model
       FROM collections c
       LEFT JOIN vehicles v ON v.stock_id = c.stock_id
       ORDER BY COALESCE(c.date_won, c.date, c.scheduled_date, '') DESC, c.created_at DESC`,
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    collection_id: String(row.collection_id),
    stock_id: (row.stock_id as string | null) || null,
    plate: String(row.vehicle_plate || row.legacy_plate || ""),
    model: String(row.vehicle_model || row.model || ""),
    type: String(row.type || "Incoming"),
    source: String(row.source || ""),
    date_won: String(row.date_won || ""),
    date: String(row.date || ""),
    scheduled_date: String(row.scheduled_date || ""),
    driver: String(row.driver || ""),
    addr: String(row.addr || ""),
    postcode: String(row.postcode || ""),
    distance_note: String(row.distance_note || ""),
    cost: Number(row.cost || 0),
    status: String(row.status || "Pending"),
    notes: String(row.notes || ""),
    days_pending: Number(row.days_pending || 0),
    number_value: String(row.number_value || ""),
    linked_stock_ids: safeJsonParse<string[]>(String(row.linked_vehicles_json || "[]"), []),
  }));
}

export function createCollection(input: {
  stock_id?: string | null;
  plate?: string | null;
  type: string;
  source?: string;
  date_won?: string;
  date?: string;
  scheduled_date?: string;
  driver?: string;
  addr?: string;
  postcode?: string;
  distance_note?: string;
  cost?: number;
  status?: string;
  notes?: string;
  number_value?: string;
  linked_vehicle_refs?: string[];
}): { collection_id: string } {
  const vehicle = resolveVehicleReference({ stock_id: input.stock_id, plate: input.plate });
  const linkedStockIds = (input.linked_vehicle_refs || [])
    .map((value) => resolveVehicleReference({ stock_id: value, plate: value })?.stock_id)
    .filter((value): value is string => Boolean(value));
  const collectionId = createId("collection");
  db.prepare(
    `INSERT INTO collections (
      collection_id, stock_id, legacy_plate, type, source, model, date_won, date, scheduled_date, driver,
      addr, postcode, distance_note, cost, status, notes, days_pending, number_value, linked_vehicles_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    collectionId,
    vehicle?.stock_id || null,
    vehicle?.plate || (input.plate || "").trim().toUpperCase(),
    input.type || "Incoming",
    input.source || "",
    vehicle?.model || "",
    input.date_won || todayIso(),
    input.date || "",
    input.scheduled_date || input.date || "",
    input.driver || "",
    input.addr || "",
    input.postcode || "",
    input.distance_note || "",
    asNumber(input.cost),
    input.status || "Pending",
    input.notes || "",
    0,
    input.number_value || "",
    JSON.stringify(linkedStockIds),
    nowIso(),
    nowIso(),
  );
  return { collection_id: collectionId };
}

export function upsertImportedCollection(input: {
  plate?: string | null;
  type?: string;
  source?: string;
  model?: string;
  date_won?: string;
  addr?: string;
  postcode?: string;
  distance_note?: string;
  scheduled_date?: string;
  status?: string;
  notes?: string;
  number_value?: string;
}): void {
  createCollection({
    plate: input.plate,
    type: input.type || "Incoming",
    source: input.source,
    date_won: input.date_won,
    scheduled_date: input.scheduled_date,
    addr: input.addr,
    postcode: input.postcode,
    distance_note: input.distance_note,
    status: input.status,
    notes: input.notes,
    number_value: input.number_value,
  });
}

export function listServiceRecords(): Array<{
  service_id: string;
  stock_id: string | null;
  plate: string;
  model: string;
  service_type: string;
  date: string;
  mileage: number;
  stamps: number;
  notes: string;
  reference: string;
  file_id: string;
  file_path: string | null;
}> {
  return db
    .prepare(
      `SELECT sr.*, v.plate, v.model, f.relative_path as file_path
       FROM service_records sr
       LEFT JOIN vehicles v ON v.stock_id = sr.stock_id
       LEFT JOIN files f ON f.file_id = sr.file_id
       ORDER BY sr.date DESC, sr.created_at DESC`,
    )
    .all() as Array<{
    service_id: string;
    stock_id: string | null;
    plate: string;
    model: string;
    service_type: string;
    date: string;
    mileage: number;
    stamps: number;
    notes: string;
    reference: string;
    file_id: string;
    file_path: string | null;
  }>;
}

export function createServiceRecord(input: {
  stock_id?: string | null;
  plate?: string | null;
  service_type?: string;
  date?: string;
  mileage?: number;
  stamps?: number;
  notes?: string;
  reference?: string;
  file_id?: string;
}): { service_id: string } {
  const vehicle = resolveVehicleReference({ stock_id: input.stock_id, plate: input.plate });
  const serviceId = createId("service");
  db.prepare(
    `INSERT INTO service_records (
      service_id, stock_id, legacy_plate, model, service_type, date, mileage, stamps, notes, reference,
      file_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    serviceId,
    vehicle?.stock_id || null,
    vehicle?.plate || (input.plate || "").trim().toUpperCase(),
    vehicle?.model || "",
    input.service_type || "Service",
    input.date || todayIso(),
    Math.round(asNumber(input.mileage)),
    Math.round(asNumber(input.stamps)),
    input.notes || "",
    input.reference || `SVC-${Date.now().toString().slice(-6)}`,
    input.file_id || "",
    nowIso(),
    nowIso(),
  );
  return { service_id: serviceId };
}

export function listViewings(): Array<{
  viewing_id: string;
  stock_id: string | null;
  vehicle_label: string;
  customer_name: string;
  phone: string;
  date: string;
  time: string;
  notes: string;
  status: string;
  source: string;
  finance: string;
  delivery: string;
  outcome: string;
}> {
  return db.prepare("SELECT * FROM viewings ORDER BY date DESC, time DESC, created_at DESC").all() as Array<{
    viewing_id: string;
    stock_id: string | null;
    vehicle_label: string;
    customer_name: string;
    phone: string;
    date: string;
    time: string;
    notes: string;
    status: string;
    source: string;
    finance: string;
    delivery: string;
    outcome: string;
  }>;
}

export function createViewing(input: {
  stock_id?: string | null;
  plate?: string | null;
  customer_name: string;
  phone?: string;
  date: string;
  time?: string;
  notes?: string;
  source?: string;
  finance?: string;
  delivery?: string;
}): { viewing_id: string } {
  const vehicle = resolveVehicleReference({ stock_id: input.stock_id, plate: input.plate });
  const viewingId = createId("viewing");
  db.prepare(
    `INSERT INTO viewings (
      viewing_id, stock_id, vehicle_label, customer_name, phone, date, time, notes, status, source, finance, delivery,
      outcome, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Booked', ?, ?, ?, 'Booked', ?, ?)`,
  ).run(
    viewingId,
    vehicle?.stock_id || null,
    vehicle ? `${vehicle.model} · ${vehicle.plate}` : "",
    input.customer_name,
    input.phone || "",
    input.date,
    input.time || "",
    input.notes || "",
    input.source || "Website",
    input.finance || "No",
    input.delivery || "No",
    nowIso(),
    nowIso(),
  );
  return { viewing_id: viewingId };
}

export function updateViewingStatus(viewingId: string, status: string): void {
  db.prepare("UPDATE viewings SET status = ?, outcome = ?, updated_at = ? WHERE viewing_id = ?").run(
    status,
    status,
    nowIso(),
    viewingId,
  );
}

export function listStaff(): Array<{
  staff_id: string;
  name: string;
  role: string;
  pay_type: string;
  rate: number;
  phone: string;
  owed: number;
  paid: number;
  linked_stock_id: string;
}> {
  return db.prepare("SELECT * FROM staff ORDER BY name").all() as Array<{
    staff_id: string;
    name: string;
    role: string;
    pay_type: string;
    rate: number;
    phone: string;
    owed: number;
    paid: number;
    linked_stock_id: string;
  }>;
}

export function createStaff(input: {
  name: string;
  role?: string;
  pay_type?: string;
  rate?: number;
  phone?: string;
  linked_stock_id?: string;
}): { staff_id: string } {
  const staffId = createId("staff");
  db.prepare(
    `INSERT INTO staff (
      staff_id, name, role, pay_type, rate, phone, owed, paid, linked_stock_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
  ).run(
    staffId,
    input.name.trim(),
    input.role || "",
    input.pay_type || "Per Job",
    asNumber(input.rate),
    input.phone || "",
    input.linked_stock_id || "",
    nowIso(),
    nowIso(),
  );
  return { staff_id: staffId };
}

export function adjustStaffOwed(staffId: string, amountDelta: number): void {
  db.prepare("UPDATE staff SET owed = owed + ?, updated_at = ? WHERE staff_id = ?").run(amountDelta, nowIso(), staffId);
}

export function logWagePayment(input: {
  staff_id: string;
  amount: number;
  date?: string;
  period?: string;
  method?: string;
  notes?: string;
}): { payment_id: string } {
  const paymentId = createId("wage");
  db.prepare(
    `INSERT INTO wage_payments (payment_id, staff_id, amount, date, period, method, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    paymentId,
    input.staff_id,
    asNumber(input.amount),
    input.date || todayIso(),
    input.period || "",
    input.method || "",
    input.notes || "",
    nowIso(),
  );
  db.prepare("UPDATE staff SET owed = MAX(0, owed - ?), paid = paid + ?, updated_at = ? WHERE staff_id = ?").run(
    asNumber(input.amount),
    asNumber(input.amount),
    nowIso(),
    input.staff_id,
  );
  return { payment_id: paymentId };
}

export function listWagePayments(): Array<{
  payment_id: string;
  staff_id: string | null;
  amount: number;
  date: string;
  period: string;
  method: string;
  notes: string;
}> {
  return db
    .prepare("SELECT * FROM wage_payments ORDER BY date DESC, created_at DESC")
    .all() as Array<{
    payment_id: string;
    staff_id: string | null;
    amount: number;
    date: string;
    period: string;
    method: string;
    notes: string;
  }>;
}
