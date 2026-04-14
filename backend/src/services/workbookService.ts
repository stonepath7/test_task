import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";

import { appConfig, appPaths } from "../config";
import { db, withTransaction } from "../db/database";
import { buildBootstrapState } from "./bootstrapService";
import { createExpense, upsertImportedSale } from "./financeService";
import { recalculateInvestorSummaries, upsertInvestorSnapshot } from "./investorService";
import { upsertImportedCollection } from "./operationsService";
import { clearDomainDataForImport, getVehicleByStockId, resolveVehicleReference, upsertImportedVehicle } from "./vehiclesService";
import { asNumber, createId, monthStart, normalizePlate, nowIso, todayIso } from "../utils/common";

function excelSerialToIso(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  if (Number.isNaN(dateInfo.getTime())) {
    return "";
  }
  return dateInfo.toISOString().slice(0, 10);
}

function cellToString(value: ExcelJS.CellValue | undefined | null): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("result" in value) {
      return cellToString(value.result as ExcelJS.CellValue);
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("").trim();
    }
  }
  return String(value).trim();
}

function cellToDateString(value: ExcelJS.CellValue | undefined | null): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    return excelSerialToIso(value);
  }
  const text = cellToString(value);
  if (!text) {
    return "";
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return text;
}

function writeSheetRows(
  worksheet: ExcelJS.Worksheet,
  headerRowIndex: number,
  headers: string[],
  rows: Array<Array<string | number>>,
): void {
  if (worksheet.rowCount >= headerRowIndex) {
    const deleteCount = Math.max(0, worksheet.rowCount - headerRowIndex);
    if (deleteCount > 0) {
      worksheet.spliceRows(headerRowIndex + 1, deleteCount);
    }
  }
  worksheet.getRow(headerRowIndex).values = headers;
  rows.forEach((row, index) => {
    worksheet.getRow(headerRowIndex + index + 1).values = row;
  });
}

function ensureWorksheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  return workbook.getWorksheet(name) || workbook.addWorksheet(name);
}

function startSyncRun(direction: "import" | "export", workbookPath: string): string {
  const syncId = createId("sync");
  db.prepare(
    `INSERT INTO sync_runs (sync_id, direction, workbook_path, status, started_at, completed_at, details_json)
     VALUES (?, ?, ?, 'running', ?, '', '{}')`,
  ).run(syncId, direction, workbookPath, nowIso());
  return syncId;
}

function finishSyncRun(syncId: string, status: "success" | "warning" | "failed", details: Record<string, unknown>): void {
  db.prepare("UPDATE sync_runs SET status = ?, completed_at = ?, details_json = ? WHERE sync_id = ?").run(
    status,
    nowIso(),
    JSON.stringify(details, null, 2),
    syncId,
  );
}

export async function importWorkbook(workbookPath = appConfig.workbookPath): Promise<{
  workbookPath: string;
  sheetNames: string[];
  warnings: string[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const warnings: string[] = [];
  const syncId = startSyncRun("import", workbookPath);

  try {
    withTransaction(() => {
      clearDomainDataForImport();
      db.prepare("DELETE FROM investors").run();

      const stockSheet = workbook.getWorksheet("Stock Data");
      if (stockSheet) {
        for (let rowNumber = 3; rowNumber <= stockSheet.rowCount; rowNumber += 1) {
          const row = stockSheet.getRow(rowNumber);
          const month = cellToDateString(row.getCell(1).value);
          const dateAcquired = cellToDateString(row.getCell(2).value);
          const plate = cellToString(row.getCell(3).value);
          const model = cellToString(row.getCell(4).value);
          if (!plate && !model) {
            continue;
          }
          if (!plate) {
            warnings.push(`Stock Data row ${rowNumber}: missing plate, row skipped.`);
            continue;
          }
          upsertImportedVehicle({
            plate,
            model: model || plate,
            month: month || monthStart(dateAcquired),
            date_acquired: dateAcquired,
            source: cellToString(row.getCell(6).value),
            investor_name: cellToString(row.getCell(5).value),
            purchase_price: asNumber(cellToString(row.getCell(8).value)),
            recon_cost: asNumber(cellToString(row.getCell(9).value)),
            total_cost: asNumber(cellToString(row.getCell(10).value)),
            status: cellToString(row.getCell(13).value) || "In Stock",
            notes: "",
            source_sheet: "Stock Data",
          });
        }
      } else {
        warnings.push("Workbook is missing the 'Stock Data' sheet.");
      }

      const soldSheet = workbook.getWorksheet("Sold Stock");
      if (soldSheet) {
        for (let rowNumber = 3; rowNumber <= soldSheet.rowCount; rowNumber += 1) {
          const row = soldSheet.getRow(rowNumber);
          const plate = cellToString(row.getCell(3).value);
          const model = cellToString(row.getCell(4).value);
          if (!plate && !model) {
            continue;
          }
          if (!plate) {
            warnings.push(`Sold Stock row ${rowNumber}: missing plate, row skipped.`);
            continue;
          }
          const vehicle =
            resolveVehicleReference({ plate }) ||
            upsertImportedVehicle({
              plate,
              model: model || plate,
              month: cellToDateString(row.getCell(1).value),
              date_acquired: cellToDateString(row.getCell(2).value),
              investor_name: cellToString(row.getCell(5).value),
              total_cost: asNumber(cellToString(row.getCell(6).value)),
              purchase_price: asNumber(cellToString(row.getCell(6).value)),
              recon_cost: 0,
              status: "Sold",
              source_sheet: "Sold Stock",
            });
          upsertImportedSale({
            stock_id: vehicle.stock_id,
            month: cellToDateString(row.getCell(1).value),
            date_sold: cellToDateString(row.getCell(14).value),
            sold_price: asNumber(cellToString(row.getCell(7).value)),
            total_cost: asNumber(cellToString(row.getCell(6).value)),
            profit: asNumber(cellToString(row.getCell(10).value)),
            investor_name: cellToString(row.getCell(5).value),
            investor_profit: asNumber(cellToString(row.getCell(11).value)),
            mp_profit: asNumber(cellToString(row.getCell(12).value)),
            platform: cellToString(row.getCell(16).value),
            invoice_number: cellToString(row.getCell(17).value),
            customer_name: cellToString(row.getCell(18).value),
            contact_info: cellToString(row.getCell(19).value),
            warranty: cellToString(row.getCell(20).value),
            autoguard_number: cellToString(row.getCell(21).value),
            date_listed: cellToDateString(row.getCell(13).value),
          });
        }
      } else {
        warnings.push("Workbook is missing the 'Sold Stock' sheet.");
      }

      const investorSheet = workbook.getWorksheet("Investor Budget");
      if (investorSheet) {
        for (let rowNumber = 2; rowNumber <= investorSheet.rowCount; rowNumber += 1) {
          const row = investorSheet.getRow(rowNumber);
          const name = cellToString(row.getCell(1).value);
          if (!name) {
            continue;
          }
          upsertInvestorSnapshot({
            name,
            initial_balance: asNumber(cellToString(row.getCell(2).value)),
            capital_returned: asNumber(cellToString(row.getCell(3).value)),
            total_balance: asNumber(cellToString(row.getCell(4).value)),
            purchased: asNumber(cellToString(row.getCell(5).value)),
            total_profit: asNumber(cellToString(row.getCell(6).value)),
            available: asNumber(cellToString(row.getCell(7).value)),
          });
        }
      } else {
        warnings.push("Workbook is missing the 'Investor Budget' sheet.");
      }

      const collectionSheet = workbook.getWorksheet("Collection");
      if (collectionSheet) {
        for (let rowNumber = 2; rowNumber <= collectionSheet.rowCount; rowNumber += 1) {
          const row = collectionSheet.getRow(rowNumber);
          const plate = cellToString(row.getCell(3).value);
          const model = cellToString(row.getCell(4).value);
          if (!plate && !model) {
            continue;
          }
          upsertImportedCollection({
            plate,
            source: cellToString(row.getCell(1).value),
            date_won: cellToDateString(row.getCell(2).value),
            model,
            addr: [cellToString(row.getCell(5).value), cellToString(row.getCell(6).value)].filter(Boolean).join(" "),
            postcode: cellToString(row.getCell(6).value),
            distance_note: cellToString(row.getCell(7).value),
            scheduled_date: cellToString(row.getCell(8).value),
            number_value: cellToString(row.getCell(9).value),
            notes: cellToString(row.getCell(10).value),
          });
        }
      }

      const expenseSheet = workbook.getWorksheet("Expense");
      if (expenseSheet) {
        for (let rowNumber = 2; rowNumber <= expenseSheet.rowCount; rowNumber += 1) {
          const row = expenseSheet.getRow(rowNumber);
          const category = cellToString(row.getCell(3).value);
          const amount = asNumber(cellToString(row.getCell(5).value));
          const notes = cellToString(row.getCell(8).value);
          const plateMatch = notes.match(/[A-Z]{2}\d{2}\s?[A-Z]{3}/i);
          if (!category && !amount && !notes) {
            continue;
          }
          createExpense({
            plate: plateMatch ? plateMatch[0] : "",
            category: category || "Other",
            description: [cellToString(row.getCell(4).value), notes].filter(Boolean).join(" · ") || category || "Expense",
            amount,
            date: cellToDateString(row.getCell(2).value),
            payment_method: cellToString(row.getCell(6).value),
            paid_by: cellToString(row.getCell(7).value),
            notes,
            entry_type: "expense",
            direction: "out",
            workbook_sheet: "Expense",
            apply_to_vehicle_costs: false,
          });
        }
      }

      const fuelSheet = workbook.getWorksheet("Fuel Expense");
      if (fuelSheet) {
        for (let rowNumber = 2; rowNumber <= fuelSheet.rowCount; rowNumber += 1) {
          const row = fuelSheet.getRow(rowNumber);
          const amount = asNumber(cellToString(row.getCell(4).value));
          const carName = cellToString(row.getCell(3).value);
          if (!carName && !amount) {
            continue;
          }
          createExpense({
            category: "Fuel",
            description: carName || "Fuel Expense",
            amount,
            date: cellToDateString(row.getCell(2).value),
            entry_type: "fuel",
            direction: "out",
            workbook_sheet: "Fuel Expense",
            apply_to_vehicle_costs: false,
          });
        }
      }

      const investorExpenseSheet = workbook.getWorksheet("Investor Car Expense");
      if (investorExpenseSheet) {
        for (let rowNumber = 2; rowNumber <= investorExpenseSheet.rowCount; rowNumber += 1) {
          const row = investorExpenseSheet.getRow(rowNumber);
          const amount = asNumber(cellToString(row.getCell(4).value));
          const description = cellToString(row.getCell(3).value);
          const regText = cellToString(row.getCell(5).value);
          if (!description && !amount && !regText) {
            continue;
          }
          createExpense({
            plate: regText,
            category: "Investor Car Expense",
            description,
            amount,
            date: cellToDateString(row.getCell(2).value),
            notes: regText,
            entry_type: "investor_car_expense",
            direction: "out",
            workbook_sheet: "Investor Car Expense",
            apply_to_vehicle_costs: false,
          });
        }
      }

      const moneyInSheet = workbook.getWorksheet("Money in");
      if (moneyInSheet) {
        for (let rowNumber = 2; rowNumber <= moneyInSheet.rowCount; rowNumber += 1) {
          const row = moneyInSheet.getRow(rowNumber);
          const category = cellToString(row.getCell(3).value);
          const amount = asNumber(cellToString(row.getCell(4).value));
          const plate = cellToString(row.getCell(5).value);
          if (!category && !amount && !plate) {
            continue;
          }
          createExpense({
            plate,
            category: category || "Money In",
            description: [category, cellToString(row.getCell(6).value)].filter(Boolean).join(" · "),
            amount,
            date: cellToDateString(row.getCell(2).value),
            notes: cellToString(row.getCell(6).value),
            entry_type: "money_in",
            direction: "in",
            workbook_sheet: "Money in",
            apply_to_vehicle_costs: false,
          });
        }
      }

      const moneyOutSheet = workbook.getWorksheet("Money Out");
      if (moneyOutSheet) {
        for (let rowNumber = 2; rowNumber <= moneyOutSheet.rowCount; rowNumber += 1) {
          const row = moneyOutSheet.getRow(rowNumber);
          const category = cellToString(row.getCell(3).value);
          const amount = asNumber(cellToString(row.getCell(4).value));
          if (!category && !amount) {
            continue;
          }
          createExpense({
            category: category || "Money Out",
            description: [category, cellToString(row.getCell(5).value)].filter(Boolean).join(" · "),
            amount,
            date: cellToDateString(row.getCell(2).value),
            notes: cellToString(row.getCell(5).value),
            entry_type: "money_out",
            direction: "out",
            workbook_sheet: "Money Out",
            apply_to_vehicle_costs: false,
          });
        }
      }

      recalculateInvestorSummaries();
    });

    const ignoredBreakdownSheets = workbook.worksheets
      .map((worksheet) => worksheet.name)
      .filter(
        (name) =>
          ![
            "Front Sheet",
            "Sold Stock",
            "Stock Data",
            "Collection",
            "Investor Budget",
            "SOR",
            "Investor Car Expense",
            "Expense",
            "Fuel Expense",
            "Money in",
            "Cash Spending",
            "Money Out",
          ].includes(name),
      );
    if (ignoredBreakdownSheets.length) {
      warnings.push(
        `Preserved ${ignoredBreakdownSheets.length} per-vehicle/legacy sheets without expanding them into the ledger to avoid double counting.`,
      );
    }

    finishSyncRun(syncId, warnings.length ? "warning" : "success", {
      warnings,
      sheetNames: workbook.worksheets.map((worksheet) => worksheet.name),
    });

    return {
      workbookPath,
      sheetNames: workbook.worksheets.map((worksheet) => worksheet.name),
      warnings,
    };
  } catch (error) {
    finishSyncRun(syncId, "failed", {
      message: error instanceof Error ? error.message : String(error),
      warnings,
    });
    throw error;
  }
}

export async function exportWorkbook(outputWorkbookPath?: string): Promise<{
  exportPath: string;
  workbookPath: string;
}> {
  const requestedExportPath = outputWorkbookPath?.trim() || "";
  const sourceWorkbookPath = appConfig.workbookPath;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DealerOS";
  workbook.created = new Date();
  const state = buildBootstrapState();
  const syncId = startSyncRun("export", sourceWorkbookPath);
  try {
    const frontSheet = ensureWorksheet(workbook, "Front Sheet");
    writeSheetRows(
      frontSheet,
      3,
      [
        "Month",
        "Cars Sold",
        "Total Revenue",
        "Total Gross Profit",
        "Company Expenses",
        "Total SA Gross Profit",
        "Investor Net Profit",
        "Investor Expense",
        "Company Fuel Costs",
        "Other Money In",
        "Other Money Out",
        "Net Profit Exc Investor",
        "Net Exc Investor",
        "Notes",
      ],
      state.monthly.map((row) => [
        row.month,
        row.cars_sold,
        row.revenue,
        row.gross_profit,
        row.expenses,
        row.gross_profit,
        "",
        "",
        row.fuel,
        0,
        0,
        row.net_profit,
        row.net_profit,
        "",
      ]),
    );

    const stockSheet = ensureWorksheet(workbook, "Stock Data");
    writeSheetRows(
      stockSheet,
      2,
      [
        "Month",
        "Date Aquired",
        "Plate Number",
        "Make & Model",
        "Investor/SA",
        "Source",
        "PX Value",
        "Price",
        "Reconditioning costs",
        "Total Cost",
        "Sold",
        "Profit",
        "Status",
        "Stock ID",
        "Notes",
      ],
      state.stock.map((vehicle) => [
        vehicle.month,
        vehicle.date_acquired,
        vehicle.plate,
        vehicle.model,
        vehicle.investor,
        vehicle.source,
        "",
        vehicle.purchase_price,
        vehicle.recon_cost,
        vehicle.total_cost,
        "",
        "",
        vehicle.status,
        vehicle.stock_id,
        vehicle.notes,
      ]),
    );

    const soldSheet = ensureWorksheet(workbook, "Sold Stock");
    writeSheetRows(
      soldSheet,
      2,
      [
        "Month",
        "Date Aquired",
        "Number Plate reference",
        "Make & Model",
        "SA/Investor Name",
        "Total Cost",
        "Sold",
        "Part Ex",
        "SA/Investor Profit Share",
        "Total Profit",
        "Investor Profit",
        "SA Profit",
        "Date Listed",
        "Date Sold",
        "Days to Sell",
        "Platfrom",
        "Invoice Number",
        "Customer Name",
        "Contact info",
        "Warranty",
        "AutoGuard Number",
        "Stock ID",
      ],
      state.sold.map((sale) => [
        sale.month,
        sale.date_acquired,
        sale.plate,
        sale.model,
        sale.investor,
        sale.total_cost,
        sale.sold_price,
        "",
        sale.investor_profit ? 30 : "",
        sale.profit,
        sale.investor_profit,
        sale.mp_profit,
        "",
        sale.date_sold,
        sale.days_in_stock,
        sale.platform,
        sale.invoice_number,
        sale.customer_name,
        sale.contact_info,
        sale.warranty,
        sale.autoguard,
        sale.stock_id,
      ]),
    );

    const investorSheet = ensureWorksheet(workbook, "Investor Budget");
    writeSheetRows(
      investorSheet,
      1,
      [
        "Investors",
        "Initial Balance",
        "Capital Returned",
        "Total Balance",
        "Purchased",
        "Total Profit (since Nov-25)",
        "Available",
      ],
      state.investors.map((investor) => [
        investor.name,
        investor.initial_balance,
        investor.capital_returned,
        investor.total_balance,
        investor.purchased,
        investor.total_profit,
        investor.available,
      ]),
    );

    const collectionSheet = ensureWorksheet(workbook, "Collection");
    writeSheetRows(
      collectionSheet,
      1,
      [
        "Source",
        "Date Won",
        "Plate Number",
        "Make & Model",
        "Location",
        "Post Code",
        "How Far?",
        "Collection Date",
        "Number",
        "Additional notes",
        "Stock ID",
      ],
      state.collections.map((row) => [
        row.source,
        row.date_won,
        row.plate,
        row.model,
        row.addr,
        "",
        row.distance_note,
        row.collection_date,
        "",
        row.notes,
        row.stock_id || "",
      ]),
    );

    const expenseSheet = ensureWorksheet(workbook, "Expense");
    writeSheetRows(
      expenseSheet,
      1,
      [
        "Month",
        "Date",
        "Category",
        "From",
        "Amount ",
        "Payment Method",
        "Paid By",
        "Notes",
        "Stock ID",
      ],
      state.financeLog
        .filter((entry) => entry.direction === "out" && entry.entry_type !== "fuel")
        .map((entry) => [
          monthStart(entry.date),
          entry.date,
          entry.cat,
          entry.source_label || entry.desc,
          entry.amount,
          entry.payment_method || "",
          entry.paid_by || "",
          entry.notes || entry.desc,
          entry.stock_id || "",
        ]),
    );

    const fuelSheet = ensureWorksheet(workbook, "Fuel Expense");
    writeSheetRows(
      fuelSheet,
      1,
      ["Month", "Date", "Car", "Amount ", "Stock ID"],
      state.financeLog
        .filter((entry) => entry.cat === "Fuel")
        .map((entry) => [monthStart(entry.date), entry.date, entry.model || entry.plate, entry.amount, entry.stock_id || ""]),
    );

    const moneyInSheet = ensureWorksheet(workbook, "Money in");
    writeSheetRows(
      moneyInSheet,
      1,
      ["Month", "Date", "Category", "Amount ", "Reg", "Notes", "Stock ID"],
      state.financeLog
        .filter((entry) => entry.direction === "in")
        .map((entry) => [
          monthStart(entry.date),
          entry.date,
          entry.cat,
          entry.amount,
          entry.plate,
          entry.notes || entry.desc,
          entry.stock_id || "",
        ]),
    );

    const moneyOutSheet = ensureWorksheet(workbook, "Money Out");
    writeSheetRows(
      moneyOutSheet,
      1,
      ["Month", "Date", "Category", "Amount ", "Notes", "Stock ID"],
      state.financeLog
        .filter((entry) => entry.direction === "out")
        .map((entry) => [
          monthStart(entry.date),
          entry.date,
          entry.cat,
          entry.amount,
          entry.notes || entry.desc,
          entry.stock_id || "",
        ]),
    );

    ensureWorksheet(workbook, "SOR");
    ensureWorksheet(workbook, "Investor Car Expense");
    ensureWorksheet(workbook, "Cash Spending");

    fs.mkdirSync(appPaths.workbookExportsDir, { recursive: true });
    const stamp = nowIso().replace(/[:.]/g, "-");
    const exportPath = requestedExportPath || path.join(appPaths.workbookExportsDir, `DealerOS_export_${stamp}.xlsx`);
    fs.mkdirSync(path.dirname(exportPath), { recursive: true });
    await workbook.xlsx.writeFile(exportPath);
    finishSyncRun(syncId, "success", { exportPath });
    return { exportPath, workbookPath: sourceWorkbookPath };
  } catch (error) {
    finishSyncRun(syncId, "failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
