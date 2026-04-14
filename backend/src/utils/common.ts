import crypto from "crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  return nowIso().slice(0, 10);
}

export function normalizePlate(plate: string | null | undefined): string {
  return (plate || "").replace(/\s+/g, "").toUpperCase();
}

export function toDisplayPlate(plate: string | null | undefined): string {
  return (plate || "").trim().toUpperCase();
}

export function slugify(value: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function monthStart(value?: string | null): string {
  const source = value ? new Date(value) : new Date();
  if (Number.isNaN(source.getTime())) {
    return `${todayIso().slice(0, 7)}-01`;
  }
  return `${source.toISOString().slice(0, 7)}-01`;
}

export function daysBetween(start?: string | null, end?: string | null): number {
  if (!start) {
    return 0;
  }
  const startDate = new Date(start);
  const endDate = new Date(end || todayIso());
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch (_error) {
    return fallback;
  }
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
