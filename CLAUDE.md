# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Python-based QC automation tool that validates and enriches business contact data in Excel files. Each validation module adds new columns to a DataFrame rather than modifying source data. The primary interface is a **React + FastAPI web app** (v2+). A legacy Streamlit UI exists in `ui-old/` but is not actively developed.

## Dependencies

**Python (backend + pipeline):**
```bash
pip install -r requirements.txt
```

**Node.js (frontend):**
```bash
cd frontend && npm install
```

**First-time setup on a new machine:** double-click `install.bat` — installs both Python venv and Node.js dependencies.

## Git Workflow

Working branches:
- `dev` — all active development happens here; commit and push here after every change
- `main` — stable releases only; merge dev → main when releasing

After every change, commit and push to dev:
```bash
git add <changed files>
git commit -m "short description"
git push origin dev
```

Merge dev → main for releases:
```bash
git checkout main
git merge dev --no-ff
git push origin main
git checkout dev
```

Remote: `https://github.com/PavithiranV-Sybrant/QC_Automation_App`

Use semantic versioning tags for releases:
```bash
git tag v2.2.0 -m "release description"
git push origin v2.2.0
```

## Version History

| Tag | Description |
|---|---|
| v1.0.0 | Initial Streamlit app |
| v1.1.0 | Full name split step |
| v1.2.0 | Select-all toggle, non-alpha name fix |
| v2.0.0 | React + FastAPI UI (Streamlit moved to ui-old/) |
| v2.1.0 | Employee count k-notation support (5k→5000) |
| v2.1.1 | Sidebar UX tweaks, removed null% chart from Data Quality |
| v2.2.0 | Fully responsive UI, mobile sidebar drawer, adaptive grids |

## Off-Limits

- `isolated_folder_don't_open/` — never read, modify, or reference anything in this folder.

## Running the App

**Double-click `run_app.bat`** — starts the FastAPI backend (port 8000) and React frontend (port 5173) in separate windows, then opens http://localhost:5173.

Or manually:
```bash
# Terminal 1 — backend
venv\Scripts\activate
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Legacy Streamlit app (not maintained):
```bash
venv\Scripts\activate
streamlit run streamlit_app.py
```

Each module in `functions_qc/` can also be called independently:
```python
import pandas as pd
from functions_qc.email_handling.email_structure_validation import validate_email_structure
df = pd.read_excel("path/to/file.xlsx")
df, result = validate_email_structure(df, email_column="email")
```

Pipeline step toggles, column mappings, and thresholds are in `instructions/runner_config.json`.

## Architecture

### System Overview

```
[React frontend :5173]
    ↕ axios (proxied via vite)
[FastAPI backend :8000]
    ├── POST /api/upload                       — parse file, store session
    ├── POST /api/run-pipeline                 — start background job, return job_id
    ├── GET  /api/pipeline-status/{job_id}     — poll progress
    ├── POST /api/cancel-pipeline/{job_id}     — set cancel flag
    └── GET  /api/download/{session_id}        — serve pre-generated Excel
```

### Data Flow

```
[user uploads .xlsx/.csv]
    → [FastAPI parses file, stores DataFrame in session_store (in-memory)]
    → [user maps columns, configures steps in sidebar]
    → [pipeline runs in background ThreadPoolExecutor]
    → [frontend polls /api/pipeline-status every 2s for live progress]
    → [Excel pre-generated after pipeline, cached in session]
    → [user downloads qc_output.xlsx instantly]
         └── new column headers highlighted in light purple (#B19CD9)
```

Everything is in-memory — no files are read from or written to disk by the app.

### Backend (`backend/`)

| File | Role |
|---|---|
| `main.py` | FastAPI app, CORS, router registration under `/api` |
| `session_store.py` | In-memory dict: UUID → `{df_original, df_working, original_columns, excel_bytes}` |
| `job_store.py` | In-memory dict: UUID → `{status, step_index, total_steps, current_step, results, cancelled, ...}` |
| `pipeline_executor.py` | Streamlit-free pipeline runner; `execute_pipeline()` accepts `progress_cb` + `cancel_check` |
| `routers/upload.py` | `POST /api/upload` — 500 MB limit, NaN-safe JSON serialization, data quality stats |
| `routers/pipeline.py` | Run / status / cancel endpoints; pre-generates Excel after pipeline completes |
| `routers/download.py` | `GET /api/download/{session_id}` — serves cached Excel bytes |

Job status flow: `pending → running → preparing_download → done | error | cancelled`

### Frontend (`frontend/src/`)

| File | Role |
|---|---|
| `App.jsx` | Root layout: resizable sidebar (desktop, drag handle) / drawer overlay (mobile, hamburger) + main tabs |
| `api.js` | axios calls: `uploadFile` (with progress), `startPipeline`, `pollJobStatus`, `cancelPipeline`, `downloadUrl` |
| `components/FileUpload.jsx` | Drag & drop upload; violet progress bar (0–99%); amber parsing spinner (100%) |
| `components/ColumnMapper.jsx` | Auto-detect template or manual role→column mapping; phone columns multi-select |
| `components/PipelineControls.jsx` | Step toggles with "All" master toggle, threshold sliders, Run/Running button |
| `components/DataPreview.jsx` | Metrics row; Table View; Data Quality table; Column Explorer with bar chart |
| `components/PipelineResults.jsx` | Step result cards; download button (spinner → green "Ready"); new columns summary table |
| `components/PipelineAnalysis.jsx` | Overview metrics; value distribution deep dive; flag-value row browser |

### Module Pattern

Every module in `functions_qc/` follows the same contract:
1. Accept a pandas DataFrame as input
2. Find the target column(s) by header name
3. Create a new column (or update existing columns) with validation results
4. Return tuple: `(df, status_dict)`

**Exception:** `phone_number_handling/standaize_phone_number.py` creates 6 new columns (`country_code`, `standardized_number`, `ext`, `is_valid`, `region_us`, `number_type`).

**Phone column array:** `phone_columns` in `runner_config.json` is an array — the pipeline generates one step-pair (standardize + area code validation) per phone column listed.

### Pipeline Steps (14 total)

| Key | Step | Default |
|---|---|---|
| `name_split` | Split full name → First / Middle / Last | OFF |
| `dot_remove` | Remove dots from names | ON |
| `name_company_match` | Name appears in company field | ON |
| `non_alpha_name_handle` | Non-ASCII or special chars in names (allows `-` and `'`) | ON |
| `email_structure_validation` | Email format validation | ON |
| `company_email_domain_match` | Company name vs email domain | ON |
| `name_email_fuzzy_match` | Fuzzy name-email match (threshold slider, default 80%) | ON |
| `normalize_phone_excel` | Standardize phone to XXX-XXX-XXXX | ON |
| `validate_phone_state` | Area code vs office state | ON |
| `normalize_employee_count` | Map to bands; handles k-notation (5k→5000) | ON |
| `name_linkedin_fuzzy_match` | Name vs LinkedIn URL slug (threshold slider, default 0.5) | ON |
| `extract_primary_industry` | Extract 3rd element from `>` delimited string | ON |
| `job_title_categories` | Categorize: Founder / C-Suite / VP / Director / etc. | ON |
| `sic_code_naics` | SIC → NAICS mapping | ON |

### Functional Domains

| Directory | What it does |
|---|---|
| `email_handling/` | Structure regex; company/domain match (excludes gmail, yahoo, etc.); fuzzy name-email (fuzzywuzzy) |
| `name_handling/` | Company name in contact; non-alpha/non-ASCII detection; dot removal |
| `phone_number_handling/` | Standardize to `XXX-XXX-XXXX`; validate area code vs state via `data_postal/areaCodes.json` |
| `employee_count_handler/` | k-notation pre-processing (5k→5000, 1.5k→1500); map to normalized bands |
| `linkedin_handler/` | Fuzzy name vs LinkedIn URL slug via `difflib` |
| `job_title_handler/` | Job title categorization |
| `sic_code_naics_handler/` | SIC → NAICS via `naic_sic_code_mapping/sic_naics_code.json` |
| `primary_industry/` | Split by `>`, extract 3rd element |

> Note: `email_handling/special_charactors_appeared.py` and `functions_qc/bulk_column_remove/` exist on disk but are not wired into the pipeline.

### Configuration Files

- `data_postal/areaCodes.json` — `"+1 ###"` → US state lookup
- `naic_sic_code_mapping/sic_naics_code.json` — SIC → NAICS mapping
- `instructions/runner_config.json` — column name mappings, step toggles, thresholds
- `instructions/templates/<name>.json` — per-template column overrides: `manta_database.json`, `healthcare.json`

### String Normalization Convention

All matching/comparison logic normalizes strings by: lowercase → strip whitespace → remove non-alphabetic characters before comparison.
