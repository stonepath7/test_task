import express from "express";
import fs from "fs";
import path from "path";

import { appConfig } from "./config";
import { db } from "./db/database";
import apiRouter from "./routes/api";
import { ensureBaseDirectories } from "./services/storageService";
import { importWorkbook } from "./services/workbookService";

async function bootstrap() {
  ensureBaseDirectories();

  const vehiclesCount = db.prepare("SELECT COUNT(*) as count FROM vehicles").get() as { count: number };
  if (vehiclesCount.count === 0 && fs.existsSync(appConfig.workbookPath)) {
    await importWorkbook(appConfig.workbookPath);
  }

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", apiRouter);
  app.use("/uploads", express.static(appConfig.uploadsDir));
  app.use(express.static(path.join(appConfig.rootDir, "frontend/public")));

  app.use((_req, res) => {
    res.sendFile(path.join(appConfig.rootDir, "frontend/public/index.html"));
  });

  app.listen(appConfig.port, appConfig.host, () => {
    console.log(`DealerOS running at http://${appConfig.host}:${appConfig.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("DealerOS failed to start", error);
  process.exit(1);
});
