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
| v4.0.0 | Landing screen, Batch Processing, Template Manager, Settings, Background Jobs, persistent file storage, global sequential job queue, + New Job panel |
| v4.1.0 | Final Output Template Detection & Normalizer — capture golden Excel column order + header colors, check/normalize any file with auto-rename, reorder, fuzzy matching |

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
    ├── POST /api/upload                         — parse file, store session
    ├── POST /api/run-pipeline                   — enqueue single-file job, return job_id
    ├── GET  /api/pipeline-status/{job_id}       — poll progress
    ├── POST /api/cancel-pipeline/{job_id}       — set cancel flag
    ├── GET  /api/download/{session_id}          — serve pre-generated Excel
    ├── POST /api/batch/upload                   — parse multi-file upload, create batch
    ├── POST /api/batch/run                      — enqueue batch job (files run serially)
    ├── GET  /api/batch/status/{batch_id}        — poll batch progress
    ├── POST /api/batch/cancel/{batch_id}        — cancel entire batch
    ├── POST /api/batch/cancel-file/{batch_id}/{session_id} — cancel one file within batch
    ├── GET  /api/batch/download/{session_id}    — download one batch file
    ├── GET  /api/batch/download-all/{batch_id}  — download ZIP of all completed files
    ├── GET  /api/sessions/{session_id}/columns  — return column names for a session
    ├── GET  /api/background-jobs                — all single + batch jobs
    ├── GET  /api/queue                          — global job queue state
    ├── GET  /api/templates                      — list templates
    ├── POST /api/templates/{name}               — save template
    ├── DELETE /api/templates/{name}             — delete template
    ├── POST /api/final-templates/extract-headers — upload golden .xlsx, return columns + ARGB colors
    ├── POST /api/final-templates/check          — compare file columns vs final template
    ├── POST /api/final-templates/normalize      — rearrange/rename/recolor columns, return .xlsx
    ├── GET  /api/final-templates                — list final output templates
    ├── GET  /api/final-templates/{name}         — get single final template
    ├── POST /api/final-templates/{name}         — save final template
    ├── DELETE /api/final-templates/{name}       — delete final template
    ├── GET  /api/settings                       — load settings (backup_days)
    ├── POST /api/settings                       — save settings
    ├── GET  /api/storage/files                  — list persisted output files
    ├── DELETE /api/storage/files/{id}           — delete one stored file
    ├── DELETE /api/storage/files                — delete all stored files
    ├── POST /api/storage/cleanup                — run retention cleanup manually
    └── GET  /api/storage/download/{id}          — download a stored output file
```

### Job Queue Architecture

All jobs (single-file and batch) go through a **global sequential queue** (`backend/job_queue.py`):
- A single daemon thread (`job-queue-worker`) processes one job at a time in submission order.
- Within a batch, files run **serially** (file 2 starts only after file 1 completes).
- Queue state is exposed via `GET /api/queue` and shown live on the Background Jobs page.
- Jobs survive browser close — they continue running in the backend process.

### Data Flow

```
[user lands on LandingScreen — chooses mode]
    ↓
[Single File mode]
    → upload → session stored in session_store
    → map columns → configure steps
    → POST /api/run-pipeline → job enqueued in job_queue
    → frontend polls /api/pipeline-status every 2s
    → Excel cached in session + persisted to data/outputs/
    → user downloads instantly; file available on Settings page

[Batch mode]
    → upload N files → N sessions created; batch_id returned
    → map columns (first file used) → configure steps
    → POST /api/batch/run → batch enqueued in job_queue
    → files run serially inside the queue worker thread
    → each file's Excel persisted to disk
    → Download individual or Download All (ZIP)

[Background Jobs page]
    → polls /api/queue + /api/background-jobs every 2s
    → "+ New Job" button → slide-in panel → upload → map → queue
    → shows Queue section (waiting/running) + Single/Batch job cards

[Output Normalizer mode]
    → Create Template: upload golden .xlsx → extract-headers reads column order + ARGB colors
      from xl/theme/theme1.xml (resolves theme colors) → save to instructions/final_templates/
    → Check & Arrange: upload any file + select template → /check runs 3-pass matching
      (exact → normalized e.g. "first name"→"first_name" → fuzzy ≥70%) → mapping review table
      with per-row override dropdowns → /normalize rearranges columns, renames headers,
      applies stored ARGB colors to header cells, returns .xlsx download
```

Files are persisted to `data/outputs/` and tracked in `data/file_registry.json`.
Auto-cleanup runs on startup and every 24 h using the `backup_days` setting.

### Backend (`backend/`)

| File | Role |
|---|---|
| `main.py` | FastAPI app, CORS, router registration; startup cleanup + daily scheduler |
| `session_store.py` | In-memory dict: UUID → `{df_original, df_working, original_columns, excel_bytes}` |
| `job_store.py` | In-memory dict: UUID → job progress; `list_jobs()`, `dismiss_job()` |
| `job_queue.py` | Global sequential queue; single daemon worker thread; `enqueue()`, `mark_*()` |
| `pipeline_executor.py` | Sequential pipeline runner; `execute_pipeline()` with `progress_cb` + `cancel_check` |
| `file_store.py` | Persist Excel bytes to `data/outputs/`; registry at `data/file_registry.json` |
| `settings_store.py` | Read/write `data/settings.json`; default `backup_days: 7` |
| `routers/upload.py` | `POST /api/upload` — 500 MB limit, NaN-safe JSON, data quality stats; `GET /api/sessions/{id}/columns` |
| `routers/pipeline.py` | Run / status / cancel; enqueues via `job_queue`; pre-generates Excel |
| `routers/download.py` | `GET /api/download/{session_id}` — serves cached Excel bytes |
| `routers/batch.py` | Batch upload / run (serial) / status / cancel / cancel-file / download / download-all; per-file `cancel_requested` flag |
| `routers/background.py` | `GET /api/background-jobs`, `GET /api/queue`, dismiss endpoints |
| `routers/templates.py` | CRUD for `instructions/templates/*.json` |
| `routers/storage.py` | List / delete / download stored output files |
| `routers/final_output_templates.py` | Final Output Template CRUD + `extract-headers` (openpyxl + theme XML) + `check` (3-pass column matching) + `normalize` (reorder/rename/recolor → .xlsx) |

Job status flow: `pending → running → preparing_download → done | error | cancelled`

### Frontend (`frontend/src/`)

| File | Role |
|---|---|
| `App.jsx` | Mode router: LandingScreen → Single / Batch / Templates / Settings / Background / FinalOutput |
| `api.js` | All axios calls: upload, pipeline, batch, templates, settings, storage, background, queue, final-templates (`ft*` functions) |
| `components/LandingScreen.jsx` | Home screen with 5 mode cards + gear icon → Settings |
| `components/FileUpload.jsx` | Drag & drop; violet progress bar (0–99%); amber parsing spinner (100%) |
| `components/ColumnMapper.jsx` | Auto-detect template or manual role→column mapping; phone multi-select |
| `components/PipelineControls.jsx` | Step toggles, threshold sliders, Run button; `hideRunButton` + `onConfigChange` props |
| `components/DataPreview.jsx` | Metrics row; Table View; Data Quality table; Column Explorer + bar chart |
| `components/PipelineResults.jsx` | Step cards; download button; new columns summary table |
| `components/PipelineAnalysis.jsx` | Overview metrics; value distribution; flag-value row browser |
| `components/BatchProcessor.jsx` | Multi-file upload; shared column mapping; run all; per-file status |
| `components/BackgroundJobs.jsx` | Unified time-sorted job cards (singles + batches mixed); collapsible `JobCard`; cancel buttons per-job and per-file; "+ New Job" button |
| `components/NewJobPanel.jsx` | Slide-in drawer: type selector → file drop → ColumnMapper → PipelineControls → queue |
| `components/TemplateManager.jsx` | View / create / edit column mapping templates; file drop on new template auto-fills column dropdowns |
| `components/FinalOutputTemplateManager.jsx` | Output Normalizer — two sub-modes: Create Template (upload golden .xlsx, capture column order + ARGB colors, save) and Check & Arrange (upload file, select template, mapping review table with overrides, normalize & download) |
| `components/SettingsPage.jsx` | Backup retention slider; stored files list with delete; manual cleanup |
| `components/InfoPanel.jsx` | Pipeline documentation overlay |

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
- `instructions/final_templates/<name>.json` — final output templates: ordered `columns` array with `{name, argb}` per column; ARGB resolved from source file's theme XML

### String Normalization Convention

All matching/comparison logic normalizes strings by: lowercase → strip whitespace → remove non-alphabetic characters before comparison.
