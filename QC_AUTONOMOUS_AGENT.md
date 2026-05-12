# QC Autonomous Agent

Fully autonomous business contact data QC tool. Upload a file → AI maps columns → runs all applicable QC checks → download cleaned Excel with flag columns added.

## Architecture

```
frontend (React + Vite :5173)
    ↕ axios
backend (FastAPI :8000)
    ├── POST /api/upload           — parse file, store session
    ├── POST /api/pipeline/run     — start autonomous pipeline job
    ├── GET  /api/pipeline/status/{job_id}  — poll progress
    ├── GET  /api/download/{session_id}     — download result Excel
    ├── GET  /api/settings         — load settings (API key, etc.)
    └── POST /api/settings         — save settings
```

## How It Works

1. **Upload**: User drops an Excel/CSV file
2. **Column Detection (LLM)**: The agent reads columns in **batches of 6** with 3 sample rows per batch. This prevents token exhaustion with 24–42 column files.
3. **Auto Step Selection**: Every QC step whose required roles are satisfied is automatically enabled — no manual toggles
4. **Pipeline Execution**: Steps run sequentially, each adding flag columns to the DataFrame
5. **Results**: New QC columns highlighted in purple; full report shown in UI; Excel download

## LLM Configuration

- **Provider**: Groq
- **Model**: `openai/gpt-oss-120b` (locked — do not change)
- **Rate limits**: 30 RPM, 6K TPM — handled automatically with sliding-window rate limiter
- **Batch strategy**: 6 columns per LLM call → merge role assignments → run pipeline

API key is stored in `data/settings.json` and entered once via the Settings page.

## QC Steps (fully autonomous — no manual selection)

| Step | Required Roles | Adds Column |
|---|---|---|
| email_structure_validation | email | comments_email_structure_valid |
| email_tld_check | email | comments_email_tld_valid |
| email_disposable_check | email | comments_email_disposable |
| email_role_check | email | comments_email_role_account |
| email_reuse_check | email | comments_email_reused_column |
| company_email_domain_match | company, email | comments_company_email_domain_match |
| name_email_fuzzy_match | first_name/full_name, email | comments_fuzzy_email_name_match |
| null_name_check | first_name, last_name | comments_first/last_name_null_values |
| dummy_names_check | first_name, last_name | comments_dummy_names_check |
| non_alpha_name_handle | first_name, last_name | comments_name_non_alphabetic_content |
| dot_remove | first_name, last_name | (modifies in place) |
| name_company_match | first_name, last_name, company | comments_name_company_appeared |
| name_split | full_name | First_Name, Middle_Name, Last_Name columns |
| normalize_phone | phone | country_code, standardized_number, ext, is_valid, region_us, number_type |
| validate_phone_state | phone, office_state | comments_area_code_state_mismatch |
| reused_phone_check | phone | comments_reused_phone_number |
| normalize_employee_count | employee_count | normalized_employee_count |
| linkedin_url_check | linkedin | comments_linkedin_url_valid |
| name_linkedin_fuzzy_match | first_name, last_name, linkedin | comments_linkedin_name_match |
| extract_primary_industry | primary_industry | primary_industry_extracted |
| job_title_categories | job_title | comments_job_title_category |
| job_title_non_alpha | job_title | comments_job_title_non_alpha |
| sic_code_naics | sic_code | naics_code |
| link_text_match | company, (first+last OR full_name), link_text, description | comments_link_text_match |
| facebook_match | first_name, last_name, facebook | comments_facebook_name_match |
| company_revenue_check | company_revenue | comments_company_revenue_unusual_chars |
| city_state_postal_match | city, state, postal_code | comments_city_state_postal_match |

## Running

```bash
# Install dependencies
cd /Users/pavithiranv/office_work/QC_Automation_App
pip install -r requirements.txt
cd frontend && npm install && cd ..

# Start backend
uvicorn backend.main:app --reload --port 8000

# Start frontend (separate terminal)
cd frontend && npm run dev
```

Open http://localhost:5173 → go to Settings → enter Groq API key → upload file → run.

## Directory Structure

```
QC_Automation_App/
├── backend/              FastAPI backend
│   ├── main.py
│   ├── session_store.py
│   ├── job_store.py
│   ├── settings_store.py
│   ├── llm_client.py     Groq batch analysis
│   ├── rate_limiter.py   Sliding-window rate limiter
│   ├── pipeline_runner.py
│   └── routers/
├── functions_qc/         QC functions (copied from qc_old)
├── data_postal/          Area code → state lookup
├── naic_sic_code_mapping/
├── data/                 Runtime data (outputs, settings.json)
├── frontend/             React + Vite UI
└── qc_old/               Original project (reference only)
```
