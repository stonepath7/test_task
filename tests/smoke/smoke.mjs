import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const fixtureWorkbook = path.join(rootDir, 'data', 'workbook', 'Master_Spreadsheet_TRIAL_sanitised.xlsx');
const serverEntry = path.join(rootDir, 'dist', 'backend', 'src', 'server.js');
const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'dealeros-smoke-'));
const workbookDir = path.join(runtimeDir, 'workbook');
const uploadsDir = path.join(runtimeDir, 'uploads');
const dbPath = path.join(runtimeDir, 'data', 'dealeros.sqlite');
const workbookPath = path.join(workbookDir, 'Master_Spreadsheet_TRIAL_sanitised.xlsx');
const exportPath = path.join(workbookDir, 'exports', 'smoke-export.xlsx');
const port = 3200 + Math.floor(Math.random() * 200);
const baseUrl = `http://127.0.0.1:${port}`;
const folderChecks = ['Photos', 'Documents', 'Service History', 'MOT', 'Purchase', 'Sale Delivery', 'Collection'];

let keepArtifacts = false;
let server;
let serverLogs = '';

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function request(method, route, body) {
  const options = { method, headers: {} };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(baseUrl + route, options);
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (_error) {
    payload = raw;
  }
  if (!response.ok) {
    throw new Error(`${method} ${route} failed: ${(payload && payload.error) || raw || response.statusText}`);
  }
  return payload;
}

async function waitForHealth(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const health = await request('GET', '/api/health');
      if (health && health.ok) return;
    } catch (_error) {
      // Keep polling until the server is ready.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for the server to become healthy.\n' + serverLogs);
}

async function stopServer() {
  if (!server || server.killed) return;
  server.kill('SIGTERM');
  await new Promise(resolve => server.once('exit', resolve));
}

try {
  await mkdir(path.dirname(dbPath), { recursive: true });
  await mkdir(workbookDir, { recursive: true });
  await copyFile(fixtureWorkbook, workbookPath);

  server = spawn(process.execPath, [serverEntry], {
    cwd: rootDir,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DB_PATH: dbPath,
      WORKBOOK_PATH: workbookPath,
      UPLOADS_DIR: uploadsDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', chunk => {
    serverLogs += chunk.toString();
  });
  server.stderr.on('data', chunk => {
    serverLogs += chunk.toString();
  });

  await waitForHealth();

  const vehicle = await request('POST', '/api/vehicles', {
    plate: 'SM66 TST',
    model: 'Smoke Test Hatchback',
    source: 'Copart',
    investor_name: 'SA',
    purchase_price: 4500,
    recon_cost: 250,
    notes: 'Created by automated smoke test',
  });

  expect(Boolean(vehicle.stock_id), 'Vehicle creation did not return a stock_id.');
  const vehicleRoot = path.join(uploadsDir, 'Cars', vehicle.stock_id);
  for (const folder of folderChecks) {
    expect(await exists(path.join(vehicleRoot, folder)), `Missing vehicle folder: ${folder}`);
  }

  const updatedVehicle = await request('PUT', `/api/vehicles/${vehicle.stock_id}`, {
    model: 'Smoke Test Hatchback Updated',
    notes: 'Updated by automated smoke test',
    purchase_price: 4600,
    recon_cost: 300,
    total_cost: 4900,
  });
  expect(updatedVehicle.model === 'Smoke Test Hatchback Updated', 'Vehicle update did not persist.');

  const uploadForm = new FormData();
  uploadForm.append('category', 'Photos');
  uploadForm.append('files', new Blob(['smoke-photo-bytes'], { type: 'image/jpeg' }), 'front.jpg');
  const uploadResult = await request('POST', `/api/vehicles/${vehicle.stock_id}/files`, uploadForm);
  expect(uploadResult.files && uploadResult.files.length === 1, 'Photo upload did not return one stored file.');
  expect(await exists(path.join(uploadsDir, uploadResult.files[0].relative_path)), 'Uploaded photo is missing on disk.');

  const expense = await request('POST', '/api/expenses', {
    stock_id: vehicle.stock_id,
    category: 'Parts',
    description: 'Smoke brake pads',
    amount: 123.45,
    date: '2026-04-13',
  });
  expect(expense.stock_id === vehicle.stock_id, 'Expense did not link back to the created vehicle.');

  const saleResult = await request('POST', `/api/vehicles/${vehicle.stock_id}/sell`, {
    sold_price: 6400,
    sale_date: '2026-04-13',
    investor_name: 'SA',
    investor_profit_share_pct: 0,
  });
  expect(saleResult.sale && saleResult.sale.stock_id === vehicle.stock_id, 'Vehicle sale did not create a sold history row.');
  expect(saleResult.invoice && saleResult.invoice.invoice_number, 'Vehicle sale did not create an invoice.');

  const importResult = await request('POST', '/api/workbook/import', { path: workbookPath });
  expect(Array.isArray(importResult.sheetNames) && importResult.sheetNames.includes('Stock Data'), 'Workbook import did not parse the expected sheets.');

  const exportResult = await request('POST', '/api/workbook/export', { path: exportPath });
  expect(await exists(exportPath), 'Workbook export did not write an .xlsx file.');

  console.log(JSON.stringify({
    ok: true,
    vehicle: vehicle.stock_id,
    uploaded_file: uploadResult.files[0].relative_path,
    sale_invoice: saleResult.invoice.invoice_number,
    imported_sheets: importResult.sheetNames.length,
    export_path: exportResult.workbookPath || exportPath,
  }, null, 2));
} catch (error) {
  keepArtifacts = true;
  console.error(error instanceof Error ? error.message : String(error));
  console.error(serverLogs);
  console.error(`Smoke artifacts kept at ${runtimeDir}`);
  process.exitCode = 1;
} finally {
  await stopServer();
  if (!keepArtifacts) {
    await rm(runtimeDir, { recursive: true, force: true });
  }
}
