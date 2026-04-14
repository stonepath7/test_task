import { db } from "../db/database";
import { daysBetween, monthStart, normalizePlate } from "../utils/common";
import { listFinanceLog, listFines, listInvoices, listReceipts, listSales } from "./financeService";
import { listInvestors } from "./investorService";
import {
  listCollections,
  listServiceRecords,
  listStaff,
  listViewings,
  listWagePayments,
} from "./operationsService";
import { listCurrentVehicles } from "./vehiclesService";
import { listFilesForVehicle } from "./fileService";
import { toPublicUploadUrl } from "./storageService";

function computeMonthlyRollups() {
  const sales = listSales();
  const financeLog = listFinanceLog();
  const months = new Map<
    string,
    {
      month: string;
      label: string;
      cars_sold: number;
      revenue: number;
      gross_profit: number;
      net_profit: number;
      expenses: number;
      fuel: number;
    }
  >();

  function ensureMonth(monthValue: string) {
    if (!months.has(monthValue)) {
      const labelDate = new Date(monthValue);
      months.set(monthValue, {
        month: monthValue.slice(0, 7),
        label: Number.isNaN(labelDate.getTime())
          ? monthValue
          : labelDate.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        cars_sold: 0,
        revenue: 0,
        gross_profit: 0,
        net_profit: 0,
        expenses: 0,
        fuel: 0,
      });
    }
    return months.get(monthValue)!;
  }

  sales.forEach((sale) => {
    const monthValue = sale.month || monthStart(sale.date_sold);
    const row = ensureMonth(monthValue);
    row.cars_sold += 1;
    row.revenue += sale.sold_price;
    row.gross_profit += sale.profit;
  });

  financeLog.forEach((entry) => {
    const monthValue = monthStart(entry.date);
    const row = ensureMonth(monthValue);
    if (entry.direction === "out") {
      if (entry.category === "Fuel") {
        row.fuel += entry.amount;
      } else {
        row.expenses += entry.amount;
      }
    }
  });

  return [...months.values()]
    .map((row) => ({
      ...row,
      net_profit: Number((row.gross_profit - row.expenses - row.fuel).toFixed(2)),
      revenue: Number(row.revenue.toFixed(2)),
      gross_profit: Number(row.gross_profit.toFixed(2)),
      expenses: Number(row.expenses.toFixed(2)),
      fuel: Number(row.fuel.toFixed(2)),
    }))
    .sort((left, right) => left.month.localeCompare(right.month));
}

function buildVehiclePhotos() {
  const currentVehicles = listCurrentVehicles();
  const photoMap: Record<string, Array<Record<string, unknown>>> = {};
  currentVehicles.forEach((vehicle) => {
    const photoFiles = listFilesForVehicle(vehicle.stock_id).filter((file) => file.category === "Photos");
    photoMap[normalizePlate(vehicle.plate)] = photoFiles.map((file, index) => ({
      id: file.file_id,
      url: toPublicUploadUrl(file.relative_path),
      tag: index === 0 ? "front" : "gallery",
      cover: index === 0,
      order: index,
      atUploaded: false,
      igUsed: false,
    }));
  });
  return photoMap;
}

export function buildBootstrapState() {
  const stock = listCurrentVehicles().map((vehicle) => ({
    stock_id: vehicle.stock_id,
    plate: vehicle.plate,
    model: vehicle.model,
    month: vehicle.month,
    date_acquired: vehicle.date_acquired,
    source: vehicle.source,
    investor: vehicle.investor_name,
    purchase_price: vehicle.purchase_price,
    recon_cost: vehicle.recon_cost,
    total_cost: vehicle.total_cost,
    status: vehicle.status,
    notes: vehicle.notes,
    days_in_stock: vehicle.days_in_stock,
    folder_root: vehicle.folder_root,
  }));

  const sold = listSales().map((sale) => ({
    stock_id: sale.stock_id,
    plate: sale.plate,
    model: sale.model,
    month: sale.month,
    date_acquired: sale.date_acquired,
    date_sold: sale.date_sold,
    days_in_stock: sale.days_to_sell,
    total_cost: sale.total_cost,
    sold_price: sale.sold_price,
    profit: sale.profit,
    investor: sale.investor,
    investor_profit: sale.investor_profit,
    mp_profit: sale.mp_profit,
    platform: sale.platform,
    customer_name: sale.customer_name,
    contact_info: sale.contact_info,
    warranty: sale.warranty,
    invoice_number: sale.invoice_number,
    autoguard: sale.autoguard_number,
    status: sale.status,
  }));

  const financeLog = listFinanceLog().map((entry) => ({
    id: entry.expense_id,
    stock_id: entry.stock_id,
    date: entry.date,
    plate: entry.plate,
    model: entry.model,
    desc: entry.description,
    cat: entry.category,
    amount: entry.amount,
    direction: entry.direction,
    entry_type: entry.entry_type,
    source_label: entry.source_label,
    payment_method: entry.payment_method,
    paid_by: entry.paid_by,
    notes: entry.notes,
  }));

  const collectionRows = listCollections();
  const collections = collectionRows
    .filter((row) => row.type !== "Delivery")
    .map((row) => ({
      id: row.collection_id,
      stock_id: row.stock_id,
      plate: row.plate,
      model: row.model,
      source: row.source,
      date_won: row.date_won,
      addr: row.addr,
      distance_note: row.distance_note,
      status: row.status,
      notes: row.notes,
      collection_date: row.scheduled_date,
      days_pending: row.days_pending,
      linked_stock_ids: row.linked_stock_ids,
    }));
  const deliveries = collectionRows
    .filter((row) => row.type === "Delivery")
    .map((row) => ({
      id: row.collection_id,
      stock_id: row.stock_id,
      plate: row.plate,
      model: row.model,
      date: row.date,
      scheduled_date: row.scheduled_date,
      driver: row.driver,
      addr: row.addr,
      cost: row.cost,
      status: row.status,
      linked_stock_ids: row.linked_stock_ids,
    }));

  const serviceRecords = listServiceRecords().map((row) => ({
    id: row.service_id,
    stock_id: row.stock_id,
    plate: row.plate,
    model: row.model,
    type: row.service_type,
    date: row.date,
    miles: row.mileage,
    stamps: row.stamps,
    notes: row.notes,
    ref: row.reference,
    photo: row.file_path ? toPublicUploadUrl(row.file_path) : null,
  }));

  const fines = listFines().map((row) => ({
    id: row.fine_id,
    stock_id: row.stock_id,
    plate: row.plate,
    type: row.type,
    date: row.date,
    amount: row.amount,
    due: row.due_date,
    ref: row.reference,
    notes: row.notes,
    status: row.status,
  }));

  const receipts = listReceipts().map((row) => ({
    id: row.receipt_id,
    stock_id: row.stock_id,
    plate: row.plate,
    model: row.model,
    cat: row.category,
    notes: row.notes,
    amount: row.amount,
    date: row.date,
    img: row.file_path ? toPublicUploadUrl(row.file_path) : null,
  }));

  const invoices = listInvoices().map((invoice) => ({
    id: invoice.invoice_id,
    invNum: invoice.invoice_number,
    stock_id: invoice.stock_id,
    model: invoice.model,
    plate: invoice.plate,
    sale: invoice.sale_price,
    cost: invoice.cost_total,
    profit: invoice.profit_total,
    invP: invoice.investor_profit,
    pct: 0,
    investor: invoice.investor_name,
    saleDate: invoice.sale_date,
    html: invoice.html_content,
  }));

  const viewings = listViewings().map((row) => ({
    id: row.viewing_id,
    stock_id: row.stock_id,
    name: row.customer_name,
    phone: row.phone,
    vehicle: row.vehicle_label,
    date: row.date,
    time: row.time,
    notes: row.notes,
    status: row.status,
    source: row.source,
    finance: row.finance,
    delivery: row.delivery,
    outcome: row.outcome,
  }));

  const staff = listStaff().map((row) => ({
    id: row.staff_id,
    name: row.name,
    role: row.role,
    payType: row.pay_type,
    rate: row.rate,
    phone: row.phone,
    owed: row.owed,
    paid: row.paid,
    linkedStockId: row.linked_stock_id,
  }));

  const wagePayments = listWagePayments().map((row) => ({
    id: row.payment_id,
    staff_id: row.staff_id,
    amount: row.amount,
    date: row.date,
    period: row.period,
    method: row.method,
    notes: row.notes,
  }));

  const latestSync = db
    .prepare("SELECT sync_id, direction, workbook_path, status, started_at, completed_at FROM sync_runs ORDER BY started_at DESC LIMIT 1")
    .get() as
    | {
        sync_id: string;
        direction: string;
        workbook_path: string;
        status: string;
        started_at: string;
        completed_at: string;
      }
    | undefined;

  return {
    stock,
    sold,
    investors: listInvestors(),
    monthly: computeMonthlyRollups(),
    collections,
    deliveries,
    financeLog,
    serviceRecords,
    fines,
    receipts,
    invoices,
    viewings,
    staff,
    wagePayments,
    vehiclePhotos: buildVehiclePhotos(),
    workbook: {
      lastSync: latestSync || null,
    },
  };
}
