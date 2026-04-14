import { exportWorkbook } from "../services/workbookService";
import { ensureBaseDirectories } from "../services/storageService";

async function main() {
  ensureBaseDirectories();
  const result = await exportWorkbook();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
