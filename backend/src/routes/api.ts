import express from "express";
import multer from "multer";
import fs from "fs";

import { buildBootstrapState } from "../services/bootstrapService";
import {
  createExpense,
  createFine,
  createReceipt,
  listFinanceLog,
  sellVehicle,
  updateFineStatus,
} from "../services/financeService";
import { registerFileRecord, listFilesForVehicle } from "../services/fileService";
import {
  createCollection,
  createServiceRecord,
  createStaff,
  createViewing,
  logWagePayment,
  updateViewingStatus,
  adjustStaffOwed,
} from "../services/operationsService";
import { ensureBaseDirectories, saveVehicleUpload, toPublicUploadUrl } from "../services/storageService";
import { exportWorkbook, importWorkbook } from "../services/workbookService";
import { createVehicle, getVehicleByStockId, updateVehicle } from "../services/vehiclesService";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

const router = express.Router();

function respondError(
  res: express.Response,
  statusCode: number,
  message: string,
  details?: Record<string, unknown>,
): void {
  res.status(statusCode).json({
    error: message,
    ...(details ? { details } : {}),
  });
}

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.get("/bootstrap", (_req, res) => {
  res.json(buildBootstrapState());
});

router.post("/vehicles", (req, res) => {
  const { plate, model } = req.body as { plate?: string; model?: string };
  if (!plate || !model) {
    return respondError(res, 400, "Vehicle creation requires both plate and model.");
  }
  try {
    const vehicle = createVehicle({
      plate,
      model,
      month: req.body.month,
      date_acquired: req.body.date_acquired,
      source: req.body.source,
      investor_name: req.body.investor_name || req.body.investor,
      purchase_price: Number(req.body.purchase_price || req.body.price || 0),
      recon_cost: Number(req.body.recon_cost || req.body.recon || 0),
      total_cost: req.body.total_cost ? Number(req.body.total_cost) : undefined,
      status: req.body.status,
      notes: req.body.notes,
    });
    res.status(201).json(vehicle);
  } catch (error) {
    respondError(res, 500, error instanceof Error ? error.message : "Vehicle creation failed.");
  }
});

router.put("/vehicles/:stockId", (req, res) => {
  const stockId = String(req.params.stockId);
  const vehicle = updateVehicle(stockId, req.body);
  if (!vehicle) {
    return respondError(res, 404, `Unknown vehicle reference: ${stockId}`);
  }
  res.json(vehicle);
});

router.post("/vehicles/:stockId/sell", (req, res) => {
  const stockId = String(req.params.stockId);
  try {
    const result = sellVehicle({
      stock_id: stockId,
      sold_price: Number(req.body.sold_price || req.body.sale_price || 0),
      sale_date: req.body.sale_date || req.body.date_sold,
      investor_name: req.body.investor_name || req.body.investor,
      investor_profit_share_pct: Number(req.body.investor_profit_share_pct || req.body.share_pct || req.body.sell_share || 30),
      platform: req.body.platform,
      invoice_number: req.body.invoice_number,
      customer_name: req.body.customer_name,
      contact_info: req.body.contact_info,
      warranty: req.body.warranty,
      autoguard_number: req.body.autoguard_number,
      notes: req.body.notes,
    });
    res.status(201).json(result);
  } catch (error) {
    respondError(res, 400, error instanceof Error ? error.message : "Vehicle sale failed.");
  }
});

router.get("/vehicles/:stockId/files", (req, res) => {
  const stockId = String(req.params.stockId);
  const vehicle = getVehicleByStockId(stockId);
  if (!vehicle) {
    return respondError(res, 404, `Unknown vehicle reference: ${stockId}`);
  }
  res.json({
    stock_id: vehicle.stock_id,
    files: listFilesForVehicle(vehicle.stock_id).map((file) => ({
      ...file,
      url: toPublicUploadUrl(file.relative_path),
    })),
  });
});

router.post("/vehicles/:stockId/files", upload.array("files"), (req, res) => {
  ensureBaseDirectories();
  const stockId = String(req.params.stockId);
  const vehicle = getVehicleByStockId(stockId);
  if (!vehicle) {
    return respondError(res, 404, `Unknown vehicle reference: ${stockId}`);
  }
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    return respondError(res, 400, "Malformed upload: at least one file is required.");
  }
  const category = String(req.body.category || "Documents");
  try {
    const storedFiles = req.files.map((file) => {
      const saved = saveVehicleUpload(vehicle.stock_id, category, file);
      registerFileRecord({
        file_id: saved.fileId,
        stock_id: vehicle.stock_id,
        entity_type: "vehicle_file",
        entity_id: vehicle.stock_id,
        category,
        original_name: file.originalname,
        stored_name: saved.storedName,
        relative_path: saved.relativePath,
        mime_type: file.mimetype,
        size_bytes: file.size,
      });
      return {
        file_id: saved.fileId,
        category,
        original_name: file.originalname,
        url: toPublicUploadUrl(saved.relativePath),
        relative_path: saved.relativePath,
      };
    });
    res.status(201).json({
      stock_id: vehicle.stock_id,
      files: storedFiles,
    });
  } catch (error) {
    respondError(res, 500, "File operation failed.", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/expenses", (req, res) => {
  const description = String(req.body.description || req.body.desc || "").trim();
  if (!description) {
    return respondError(res, 400, "Expense description is required.");
  }
  const amount = Number(req.body.amount || 0);
  if (!amount) {
    return respondError(res, 400, "Expense amount must be non-zero.");
  }
  const entry = createExpense({
    stock_id: req.body.stock_id,
    plate: req.body.plate,
    category: req.body.category || req.body.cat || "Other",
    description,
    amount,
    date: req.body.date,
    payment_method: req.body.payment_method,
    paid_by: req.body.paid_by,
    source_label: req.body.source_label || req.body.from,
    notes: req.body.notes,
  });
  res.status(201).json(entry);
});

router.post("/receipts", upload.single("file"), (req, res) => {
  const amount = Number(req.body.amount || 0);
  if (!amount) {
    return respondError(res, 400, "Receipt amount must be provided.");
  }
  let fileId = "";
  let filePath = "";
  if (req.file) {
    const stockId = String(req.body.stock_id || "UNASSIGNED");
    const saved = saveVehicleUpload(stockId, "Documents", req.file);
    fileId = saved.fileId;
    filePath = saved.relativePath;
    registerFileRecord({
      file_id: saved.fileId,
      stock_id: req.body.stock_id || null,
      entity_type: "receipt",
      category: "Documents",
      original_name: req.file.originalname,
      stored_name: saved.storedName,
      relative_path: saved.relativePath,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
    });
  }
  const receipt = createReceipt({
    stock_id: req.body.stock_id,
    plate: req.body.plate,
    category: req.body.category || req.body.cat || "Other",
    notes: req.body.notes || "",
    amount,
    date: req.body.date,
    file_id: fileId,
  });
  res.status(201).json({
    ...receipt,
    file_path: filePath ? toPublicUploadUrl(filePath) : null,
  });
});

router.post("/fines", (req, res) => {
  const amount = Number(req.body.amount || 0);
  if (!amount) {
    return respondError(res, 400, "Fine amount must be provided.");
  }
  const fine = createFine({
    stock_id: req.body.stock_id,
    plate: req.body.plate,
    type: req.body.type,
    date: req.body.date,
    amount,
    due_date: req.body.due_date || req.body.due,
    reference: req.body.reference || req.body.ref,
    notes: req.body.notes,
    status: req.body.status,
  });
  res.status(201).json(fine);
});

router.patch("/fines/:fineId/status", (req, res) => {
  const fineId = String(req.params.fineId);
  const status = String(req.body.status || "").trim();
  if (!status) {
    return respondError(res, 400, "Fine status is required.");
  }
  updateFineStatus(fineId, status);
  res.json({ ok: true });
});

router.post("/collections", (req, res) => {
  const result = createCollection({
    stock_id: req.body.stock_id,
    plate: req.body.plate,
    type: req.body.type,
    source: req.body.source,
    date_won: req.body.date_won,
    date: req.body.date,
    scheduled_date: req.body.scheduled_date,
    driver: req.body.driver,
    addr: req.body.addr,
    postcode: req.body.postcode,
    distance_note: req.body.distance_note,
    cost: Number(req.body.cost || 0),
    status: req.body.status,
    notes: req.body.notes,
    number_value: req.body.number_value,
    linked_vehicle_refs: Array.isArray(req.body.linked_vehicle_refs)
      ? req.body.linked_vehicle_refs
      : String(req.body.linked_vehicle_refs || req.body.link || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
  });
  res.status(201).json(result);
});

router.post("/service-records", upload.single("file"), (req, res) => {
  let fileId = "";
  if (req.file && req.body.stock_id) {
    const saved = saveVehicleUpload(String(req.body.stock_id), "Service History", req.file);
    fileId = saved.fileId;
    registerFileRecord({
      file_id: saved.fileId,
      stock_id: String(req.body.stock_id),
      entity_type: "service_record",
      category: "Service History",
      original_name: req.file.originalname,
      stored_name: saved.storedName,
      relative_path: saved.relativePath,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
    });
  }
  const result = createServiceRecord({
    stock_id: req.body.stock_id,
    plate: req.body.plate,
    service_type: req.body.service_type || req.body.type,
    date: req.body.date,
    mileage: Number(req.body.mileage || req.body.miles || 0),
    stamps: Number(req.body.stamps || 0),
    notes: req.body.notes,
    reference: req.body.reference || req.body.ref,
    file_id: fileId,
  });
  res.status(201).json(result);
});

router.post("/viewings", (req, res) => {
  if (!req.body.customer_name && !req.body.name) {
    return respondError(res, 400, "Viewing customer name is required.");
  }
  const result = createViewing({
    stock_id: req.body.stock_id,
    plate: req.body.plate,
    customer_name: req.body.customer_name || req.body.name,
    phone: req.body.phone,
    date: req.body.date,
    time: req.body.time,
    notes: req.body.notes,
    source: req.body.source,
    finance: req.body.finance,
    delivery: req.body.delivery,
  });
  res.status(201).json(result);
});

router.patch("/viewings/:viewingId/status", (req, res) => {
  const viewingId = String(req.params.viewingId);
  const status = String(req.body.status || "").trim();
  if (!status) {
    return respondError(res, 400, "Viewing status is required.");
  }
  updateViewingStatus(viewingId, status);
  res.json({ ok: true });
});

router.post("/staff", (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) {
    return respondError(res, 400, "Staff name is required.");
  }
  const result = createStaff({
    name,
    role: req.body.role,
    pay_type: req.body.pay_type || req.body.payType,
    rate: Number(req.body.rate || 0),
    phone: req.body.phone,
    linked_stock_id: req.body.linked_stock_id,
  });
  res.status(201).json(result);
});

router.post("/staff/:staffId/owed", (req, res) => {
  const staffId = String(req.params.staffId);
  const amount = Number(req.body.amount || 0);
  if (!amount) {
    return respondError(res, 400, "A non-zero amount is required.");
  }
  adjustStaffOwed(staffId, amount);
  res.json({ ok: true });
});

router.post("/wage-payments", (req, res) => {
  const staffId = String(req.body.staff_id || "").trim();
  if (!staffId) {
    return respondError(res, 400, "staff_id is required.");
  }
  const amount = Number(req.body.amount || 0);
  if (!amount) {
    return respondError(res, 400, "Payment amount must be non-zero.");
  }
  const result = logWagePayment({
    staff_id: staffId,
    amount,
    date: req.body.date,
    period: req.body.period,
    method: req.body.method,
    notes: req.body.notes,
  });
  res.status(201).json(result);
});

router.post("/workbook/import", async (req, res) => {
  const workbookPath = String(req.body.path || "").trim() || undefined;
  if (workbookPath && !fs.existsSync(workbookPath)) {
    return respondError(res, 400, "Workbook path does not exist.", { workbookPath });
  }
  try {
    const result = await importWorkbook(workbookPath);
    res.status(201).json(result);
  } catch (error) {
    respondError(res, 500, "Workbook import failed.", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/workbook/export", async (req, res) => {
  const workbookPath = String(req.body.path || "").trim() || undefined;
  try {
    const result = await exportWorkbook(workbookPath);
    res.status(201).json(result);
  } catch (error) {
    respondError(res, 500, "Workbook export failed.", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/finance-log", (_req, res) => {
  res.json(listFinanceLog());
});

export default router;
