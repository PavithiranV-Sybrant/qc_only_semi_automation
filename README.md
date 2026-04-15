# QC Automation App

A React + FastAPI web application for validating and enriching business contact data in Excel and CSV files. Each QC step adds new comment columns to flag issues — source data is never modified. New columns are highlighted in purple in the output.

> **Current version: v4.1.0**

---

## Setup

### Requirements
- Python 3.9+
- Node.js 18+
- Windows (uses `.bat` scripts)

### First-time Installation

1. Copy the project folder to your machine
2. Double-click **`install.bat`**

This creates a Python virtual environment and installs all Python and Node.js dependencies automatically.

---

## Running the App

Double-click **`run_app.bat`**

The app opens at **http://localhost:5173**. The FastAPI backend runs on port 8000.

---

## Modes

### Single File
Upload one Excel or CSV file, map columns to their logical roles, configure which QC steps to run, and download the enriched output. Progress is shown live step-by-step.

### Batch Processing
Upload multiple files at once. Column mapping is configured once (using the first file) and applied to all files. Files run serially. Download each file individually or as a ZIP.

### Background Jobs
Monitor all running and queued jobs in one place. Jobs keep running even after you close the browser — reconnect any time to check progress. The **+ New Job** button opens a slide-in panel to queue additional jobs without leaving the page.

### Template Manager
Save and manage column mapping templates for different data source formats (e.g. healthcare, manta_database). Templates are auto-detected on upload and pre-fill the column mapping UI.

### Output Normalizer *(v4.1.0)*
Final QC step for normalizing output file structure to a known-good standard.

**Create Template** — Upload a golden `.xlsx` file. The app reads every column's header cell background color directly from the Excel file (including theme colors resolved from the embedded theme XML). Save the column order + colors as a reusable final output template.

**Check & Arrange** — Upload any file and select a saved template. The app runs a 3-pass column matching algorithm:
1. **Exact match** — column name matches perfectly
2. **Auto-rename** — normalized name matches (e.g. `"first name"` → `"first_name"`)
3. **Fuzzy match** — close enough (≥70% similarity) with a confidence score

A mapping review table shows each column's match status. You can override any auto-detected mapping via dropdown. Click **Normalize & Download** to get an Excel file with columns reordered, headers renamed, and original template header colors applied.

### Settings
Configure backup retention (1–90 days) for stored output files. View, download, or delete stored output files individually or all at once.

---

## QC Pipeline Steps (15 total)

| # | Step | Default | What it checks |
|---|---|---|---|
| 1 | Name Split | OFF | Splits full name → First / Middle / Last |
| 2 | Dot Remove | ON | Removes dots from name fields |
| 3 | Name / Company Match | ON | Flags if company name appears in contact name |
| 4 | Non-Alpha Name | ON | Detects non-alphabetic characters in names |
| 5 | Email Structure | ON | Validates email format with regex |
| 6 | Company / Email Domain | ON | Checks if email domain matches company name |
| 7 | Name / Email Fuzzy | ON | Fuzzy-matches person name to email local part (threshold slider) |
| 8 | Normalize Phone | ON | Standardizes phone to `XXX-XXX-XXXX` |
| 9 | Phone / State Validate | ON | Validates area code against office state |
| 10 | Employee Count | ON | Normalizes values like `"5k"` → `5000`; maps to bands |
| 11 | LinkedIn Name Match | ON | Fuzzy-matches name to LinkedIn URL slug (threshold slider) |
| 12 | Primary Industry | ON | Extracts primary industry from `>`-delimited trade name string |
| 13 | Job Title Category | ON | Categorizes titles: Founder / C-Suite / VP / Director / etc. |
| 14 | SIC → NAICS | ON | Maps SIC codes to NAICS codes |
| 15 | Link Text / Description Match | ON | Fuzzy-matches link text and description fields against company name and contact name (threshold slider) |

---

## Dashboard Tabs (Single File mode)

### Data Preview
- **Table View** — raw data browser (first 200 rows)
- **Data Quality** — per-column null %, unique counts, sample values with color-coded indicators
- **Column Explorer** — select any column to see value distribution and interactive row filter

### Pipeline Results
- Step-by-step status (OK / Skipped / Failed) with per-step timing
- Download button for QC output Excel file (new columns highlighted purple)
- New Columns Added summary table

### Pipeline Analysis
- Overview metrics comparing before and after
- New column value distribution and charts
- Browse rows by flag value — filter by any QC result

---

## Configuration Files

| File | Purpose |
|---|---|
| `instructions/runner_config.json` | Default column mappings, step toggles, thresholds |
| `instructions/templates/*.json` | Column mapping templates (manta_database, healthcare) |
| `instructions/final_templates/*.json` | Final output templates — ordered columns with header ARGB colors |
| `data_postal/areaCodes.json` | Area code → US state lookup |
| `naic_sic_code_mapping/sic_naics_code.json` | SIC → NAICS mapping |
| `data/settings.json` | App settings (backup_days, default 7) |
| `data/file_registry.json` | Registry of persisted output files |

---

## Transferring to Another Machine

1. Copy the project folder — **skip the `venv/` and `frontend/node_modules/` folders**
2. On the new machine, double-click **`install.bat`**
3. Double-click **`run_app.bat`** to launch

Only Python and Node.js need to be pre-installed.

---

## Version History

| Version | Description |
|---|---|
| v1.0.0 | Initial Streamlit app |
| v2.0.0 | React + FastAPI UI |
| v2.2.0 | Fully responsive UI, mobile sidebar |
| v4.0.0 | Batch Processing, Background Jobs, Template Manager, Settings, persistent storage, global job queue |
| v4.1.0 | Output Normalizer — final output template detection & normalization with Excel header color capture |
| v4.2.0 | Step 15 Link Text / Description match — fuzzy match link text + description against company and contact name |
