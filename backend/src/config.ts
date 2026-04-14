import path from "path";

const rootDir = process.cwd();

function resolveFromRoot(inputPath: string): string {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(rootDir, inputPath);
}

export const appConfig = {
  rootDir,
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "127.0.0.1",
  dbPath: resolveFromRoot(process.env.DB_PATH || "./data/dealeros.sqlite"),
  workbookPath: resolveFromRoot(
    process.env.WORKBOOK_PATH || "./data/workbook/Master_Spreadsheet_TRIAL_sanitised.xlsx",
  ),
  uploadsDir: resolveFromRoot(process.env.UPLOADS_DIR || "./uploads"),
};

export const appPaths = {
  carsDir: path.join(appConfig.uploadsDir, "Cars"),
  investorsDir: path.join(appConfig.uploadsDir, "Investors"),
  invoicesDir: path.join(appConfig.uploadsDir, "Invoices"),
  workbookDir: path.dirname(appConfig.workbookPath),
  workbookExportsDir: path.join(path.dirname(appConfig.workbookPath), "exports"),
};
