# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Python-based QC automation tool that validates and enriches business contact data in Excel files. Each validation module adds new "comment" columns to a workbook rather than modifying source data. The sole interface is a Streamlit web app.

## Dependencies

Install from `requirements.txt`:

```bash
pip install -r requirements.txt
```

## Off-Limits

- `isolated_folder_don't_open/` — never read, modify, or reference anything in this folder.

## Running the App

**Double-click `run_app.bat`** — activates the venv and launches the Streamlit app.

Or manually:
```bash
venv\Scripts\activate
streamlit run streamlit_app.py
```

First-time setup on a new machine: double-click `install.bat` first.

Each module in `functions_qc/` can also be called independently:

```python
import pandas as pd
from functions_qc.email_handling.email_structure_validation import validate_email_structure
df = pd.read_excel("path/to/file.xlsx")
df, result = validate_email_structure(df, email_column="email")
```

Pipeline step toggles, column mappings, and thresholds are in `instructions/runner_config.json`.

## Architecture

### Data Flow

```
[user uploads .xlsx/.csv]
    → [~13 validation steps run in-memory]
    → [user downloads qc_output.xlsx]
         └── new column headers highlighted in light purple (#B19CD9)
```

Everything is in-memory — no files are read from or written to disk by the app itself.

### Module Pattern

Every module in `functions_qc/` follows the same contract:
1. Accept a pandas DataFrame as input
2. Find the target column(s) by header name
3. Create a new `comments_*` column or update existing columns with validation results
4. Return tuple: `(df, status_dict)` where status_dict contains `{"column_created": str, "matched": int, ...}`

**Exception:** `phone_number_handling/standaize_phone_number.py` creates 6 new columns (`country_code`, `standardized_number`, `ext`, `is_valid`, `region_us`, `number_type`) instead of a single `comments_*` column.

**Phone column array:** `phone_columns` in `runner_config.json` is an array — the pipeline generates one step-pair (standardize + area code validation) per phone column listed.

### Streamlit UI (`ui/`)

| File | Role |
|---|---|
| `ui/file_handler.py` | `load_file()` — reads uploaded file; `render_preview()` — 3-tab dashboard (Table View, Data Quality, Column Explorer); `render_download()` — writes Excel with purple headers for new columns |
| `ui/column_mapper.py` | `render_column_mapper()` — auto-detects or manually maps logical roles to actual column headers; saves to `st.session_state.column_mapping` |
| `ui/pipeline_runner.py` | `render_pipeline_controls()` — step toggles + threshold sliders; `run_pipeline()` — executes steps with live progress + per-step timing; `render_results_summary()`, `render_step_timings()` |
| `ui/pipeline_analysis.py` | `render_pipeline_analysis()` — post-run tab: change overview, new columns summary, value distribution deep dive, flag-value row browser, removed columns list |

Session state keys: `df_original`, `df_working`, `column_mapping`, `step_toggles`, `thresholds`, `pipeline_results`, `pipeline_complete`, `elapsed_time`, `_original_columns`, `_last_file_name`, `_run_now`.

### Main Area Tabs

| Tab | Shows |
|---|---|
| 📊 Data Preview | Data quality dashboard (always visible after upload) |
| ⚙️ Pipeline Results | Step results, timing table, download button |
| 🔬 Pipeline Analysis | Before/after comparison, new column analysis (visible after pipeline runs) |

### Functional Domains

| Directory | What it does |
|---|---|
| `email_handling/` | Structure regex validation; company/domain match (excludes free providers: gmail, yahoo, outlook, etc.); fuzzy name-email match (fuzzywuzzy, threshold 80%) |
| `name_handling/` | Company name appearing in contact name, non-alpha character detection, dot removal |
| `phone_number_handling/` | Standardizes to `XXX-XXX-XXXX` format (extracts country code + ext); validates area code against office state via `data_postal/areaCodes.json` |
| `employee_count_handler/` | Maps raw strings like "51-200 employees" to normalized bands ("50-100") |
| `linkedin_handler/` | Fuzzy-matches person names to LinkedIn URL slug using `difflib` |
| `job_title_handler/` | Categorizes job titles into Founder, Owner, C-Suite, VP, Director, Head, Manager, Partner, Principal |
| `sic_code_naics_handler/` | Extracts 4-digit SIC codes and maps to NAICS via `naic_sic_code_mapping/sic_naics_code.json` |
| `primary_industry/` | Splits trade name column by `>` and extracts the 3rd element as primary industry |

> Note: `email_handling/special_charactors_appeared.py` and `functions_qc/bulk_column_remove/` exist on disk but are not wired into the pipeline.

### Configuration Files

- `data_postal/areaCodes.json` — lookup table `"+1 ###"` → US state; used by `address_phone_postal.py`
- `naic_sic_code_mapping/sic_naics_code.json` — SIC → NAICS mapping; used by `sic_naics_handler.py`
- `instructions/runner_config.json` — column name mappings, step toggles, and thresholds
- `instructions/templates/<name>.json` — per-template column overrides; currently: `manta_database.json`, `healthcare.json`

### String Normalization Convention

All matching/comparison logic normalizes strings by: lowercase → strip whitespace → remove non-alphabetic characters before comparison.
