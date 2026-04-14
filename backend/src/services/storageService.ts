import fs from "fs";
import path from "path";

import { appConfig, appPaths } from "../config";
import { createId, slugify } from "../utils/common";

const VEHICLE_SUBFOLDERS = [
  "Photos",
  "Documents",
  "Service History",
  "MOT",
  "Purchase",
  "Sale Delivery",
  "Collection",
] as const;

export function ensureBaseDirectories(): void {
  [
    path.dirname(appConfig.dbPath),
    appConfig.uploadsDir,
    appPaths.carsDir,
    appPaths.investorsDir,
    appPaths.invoicesDir,
    appPaths.workbookDir,
    appPaths.workbookExportsDir,
  ].forEach((directoryPath) => fs.mkdirSync(directoryPath, { recursive: true }));
}

export function ensureVehicleDirectories(stockId: string): string[] {
  const createdPaths = VEHICLE_SUBFOLDERS.map((folderName) => {
    const folderPath = path.join(appPaths.carsDir, stockId, folderName);
    fs.mkdirSync(folderPath, { recursive: true });
    return folderPath;
  });
  return createdPaths;
}

export function ensureInvestorDirectories(investorName: string): string {
  const investorPath = path.join(appPaths.investorsDir, slugify(investorName), "Documents");
  fs.mkdirSync(investorPath, { recursive: true });
  return investorPath;
}

export function ensureInvoiceDirectory(stockId: string): string {
  const invoicePath = path.join(appPaths.invoicesDir, stockId);
  fs.mkdirSync(invoicePath, { recursive: true });
  return invoicePath;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function toStoredUploadPath(absolutePath: string): string {
  return toPosixPath(path.relative(appConfig.uploadsDir, absolutePath));
}

export function toPublicUploadUrl(relativePath: string): string {
  const normalized = toPosixPath(String(relativePath || "")).replace(/^\/+/, "");
  if (!normalized) {
    return "";
  }
  return normalized.startsWith("uploads/") ? `/${normalized}` : `/uploads/${normalized}`;
}

export function vehicleFolderForCategory(stockId: string, category: string): string {
  const normalized = category.trim().toLowerCase();
  const folder =
    normalized === "photos"
      ? "Photos"
      : normalized === "documents"
        ? "Documents"
        : normalized === "service history"
          ? "Service History"
          : normalized === "mot"
            ? "MOT"
            : normalized === "purchase"
              ? "Purchase"
              : normalized === "sale delivery"
                ? "Sale Delivery"
                : normalized === "collection"
                  ? "Collection"
                  : "Documents";
  const folderPath = path.join(appPaths.carsDir, stockId, folder);
  fs.mkdirSync(folderPath, { recursive: true });
  return folderPath;
}

export function saveVehicleUpload(
  stockId: string,
  category: string,
  file: Express.Multer.File,
): { fileId: string; relativePath: string; absolutePath: string; storedName: string } {
  const targetFolder = vehicleFolderForCategory(stockId, category);
  const fileId = createId("file");
  const storedName = `${fileId}_${sanitizeFilename(file.originalname || "upload.bin")}`;
  const absolutePath = path.join(targetFolder, storedName);
  fs.writeFileSync(absolutePath, file.buffer);
  const relativePath = toStoredUploadPath(absolutePath);
  return { fileId, relativePath, absolutePath, storedName };
}

export function saveInvoiceHtml(
  stockId: string,
  invoiceNumber: string,
  html: string,
): { relativePath: string; absolutePath: string; fileId: string; storedName: string } {
  const folderPath = ensureInvoiceDirectory(stockId);
  const fileId = createId("file");
  const storedName = `${fileId}_${sanitizeFilename(invoiceNumber)}.html`;
  const absolutePath = path.join(folderPath, storedName);
  fs.writeFileSync(absolutePath, html, "utf8");
  const relativePath = toStoredUploadPath(absolutePath);
  return { relativePath, absolutePath, fileId, storedName };
}
