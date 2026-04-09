# QC Automation App

A Streamlit-based tool for validating and enriching business contact data in Excel and CSV files. Each QC step adds new comment columns to flag issues — source data is never modified.

---

## Features

- Upload `.xlsx` or `.csv` files directly in the browser
- Auto-detect column mappings or configure manually
- Run 13 QC validation steps with live progress tracking
- Download the enriched Excel output — new columns are highlighted in purple
- Built-in data analysis dashboard with quality metrics and column explorer
- Post-pipeline analysis: compare before/after, inspect flagged rows

---

## Setup

### Requirements
- Python 3.9+
- Windows (uses `.bat` scripts)

### First-time Installation

1. Copy the project folder to your machine
2. Double-click **`install.bat`**

That's it. It will create a virtual environment and install all dependencies automatically.

---

## Running the App

Double-click **`run_app.bat`**

The app will open in your browser at `http://localhost:8501`. Close the terminal window to stop it.

---

## How to Use

1. **Upload** — drag and drop an `.xlsx` or `.csv` file in the sidebar
2. **Map Columns** — use Auto Match (detects template) or manually assign column roles
3. **Configure Pipeline** — toggle steps on/off, adjust fuzzy match thresholds
4. **Run Pipeline** — click ▶ Run Pipeline and watch live step-by-step progress
5. **Download** — get the QC output Excel file with new columns highlighted in purple

---

## QC Steps

| # | Step | What it checks |
|---|---|---|
| 1 | Dot Remove | Removes dots from name fields |
| 2 | Name / Company Match | Flags if company name appears in contact name |
| 3 | Non-Alpha Name | Detects non-alphabetic characters in names |
| 4 | Email Structure | Validates email format with regex |
| 5 | Company / Email Domain | Checks if email domain matches company name |
| 6 | Name / Email Fuzzy | Fuzzy-matches person name to email local part |
| 7 | Normalize Phone | Standardizes phone to `XXX-XXX-XXXX` format |
| 8 | Phone / State Validate | Validates area code against office state |
| 9 | Employee Count | Normalizes strings like "51-200 employees" to bands |
| 10 | LinkedIn Name Match | Fuzzy-matches name to LinkedIn URL slug |
| 11 | Primary Industry | Extracts primary industry from trade name |
| 12 | Job Title Category | Categorizes titles (C-Suite, VP, Director, etc.) |
| 13 | SIC → NAICS | Maps SIC codes to NAICS codes |

---

## Dashboard Tabs

### Data Preview
- **Table View** — raw data browser
- **Data Quality** — per-column null %, unique counts, sample values with color-coded quality indicators
- **Column Explorer** — select any column to see value distribution, top-N values, and interactive row filter

### Pipeline Results
- Step-by-step status (OK / Skipped / Failed)
- Per-step timing table
- Download button for QC output

### Pipeline Analysis *(available after running)*
- Columns added vs removed summary
- New column value distribution and charts
- Browse rows by flag value — filter by any QC result to see matching records

---

## Transferring to Another Machine

1. Copy the project folder — **skip the `venv/` folder**
2. On the new machine, double-click **`install.bat`**
3. Double-click **`run_app.bat`** to launch

Only Python needs to be pre-installed. Everything else is handled by `install.bat`.

---

## Configuration

| File | Purpose |
|---|---|
| `instructions/runner_config.json` | Default column mappings, step toggles, thresholds |
| `instructions/templates/*.json` | Per-template column overrides (manta_database, healthcare) |
| `data_postal/areaCodes.json` | Area code → US state lookup |
| `naic_sic_code_mapping/sic_naics_code.json` | SIC → NAICS mapping |
