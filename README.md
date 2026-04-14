# DealerOS Takeover

Local dealership operating system takeover built around `stock_id`, SQLite, workbook sync, and real folder-based file storage.

## Run locally

Requirements:

- Node.js 20+
- npm

Install and start:

```bash
 npm install
 npm run dev
```

Open:

- `http://127.0.0.1:3000`

Defaults:

- SQLite DB: `./data/dealeros.sqlite`
- Workbook: `./data/workbook/Master_Spreadsheet_TRIAL_sanitised.xlsx`
- Upload root: `./uploads`

Optional environment variables are documented in `.env.example`.

## Workbook sync

The workbook remains part of the operating workflow. This project supports a practical bidirectional local process:

- workbook -> app through explicit import/sync
- app -> workbook through explicit export/write-back

This is intentional. The app does not mutate the workbook implicitly after every UI action, which keeps file changes predictable for a local dealership workflow and avoids hidden spreadsheet writes.

Import the workbook into SQLite with an explicit sync step:

```bash
 npm run import:workbook
```

The import reads workbook-driven operational data into SQLite and keeps workbook compatibility in mind. Legacy or per-vehicle sheets are preserved during import, but they are not expanded into the ledger when doing so would risk double counting. If incomplete or ambiguous rows cannot be mapped safely, they are skipped with explicit warning logging.

Export the current SQLite state back into a workbook copy with an explicit write-back step:

```bash
 npm run export:workbook
```

This provides a safe write-back flow for spreadsheet-based review or handoff without implicit file mutation during day-to-day app usage.

Warnings should be treated as non-blocking when they relate to preserved legacy sheets or skipped ambiguous rows. In that case, the sync has completed safely; it is not a failed import, but deliberate handling of workbook ambiguity.

The backend also auto-imports the configured workbook on first run if the local database is empty.

## Smoke test

Run the end-to-end smoke script:

```bash
 npm run smoke
```

This validates:

- add vehicle
- create stock folders on disk
- upload a file
- add an expense
- sell a vehicle
- import workbook
- export workbook

## Repo layout

```text
backend/
  src/
    db/
    routes/
    scripts/
    services/
    utils/
frontend/
  public/
tests/
  smoke/
data/
  workbook/
uploads/
```
