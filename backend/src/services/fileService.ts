import { db } from "../db/database";
import { nowIso } from "../utils/common";

export interface FileRecordInput {
  file_id: string;
  stock_id?: string | null;
  investor_name?: string;
  invoice_id?: string;
  entity_type: string;
  entity_id?: string;
  category: string;
  original_name: string;
  stored_name: string;
  relative_path: string;
  mime_type?: string;
  size_bytes?: number;
}

export function registerFileRecord(input: FileRecordInput): void {
  db.prepare(
    `INSERT INTO files (
      file_id,
      stock_id,
      investor_name,
      invoice_id,
      entity_type,
      entity_id,
      category,
      original_name,
      stored_name,
      relative_path,
      mime_type,
      size_bytes,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.file_id,
    input.stock_id || null,
    input.investor_name || "",
    input.invoice_id || "",
    input.entity_type,
    input.entity_id || "",
    input.category,
    input.original_name,
    input.stored_name,
    input.relative_path,
    input.mime_type || "",
    input.size_bytes || 0,
    nowIso(),
  );
}

export function listFilesForVehicle(stockId: string): Array<{
  file_id: string;
  category: string;
  original_name: string;
  relative_path: string;
  mime_type: string;
}> {
  return db
    .prepare(
      "SELECT file_id, category, original_name, relative_path, mime_type FROM files WHERE stock_id = ? ORDER BY created_at DESC",
    )
    .all(stockId) as Array<{
    file_id: string;
    category: string;
    original_name: string;
    relative_path: string;
    mime_type: string;
  }>;
}
