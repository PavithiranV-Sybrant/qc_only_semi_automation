import streamlit as st

from ui.file_handler    import load_file, render_preview, render_download
from ui.column_mapper   import render_column_mapper
from ui.pipeline_runner  import render_pipeline_controls, run_pipeline, render_results_summary, render_elapsed, render_step_timings
from ui.pipeline_analysis import render_pipeline_analysis

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="QC Automation",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Session state defaults
# ---------------------------------------------------------------------------
DEFAULTS = {
    "df_original":        None,
    "df_working":         None,
    "column_mapping":     {},
    "step_toggles":       {},
    "thresholds":         {},
    "pipeline_results":   [],
    "pipeline_complete":  False,
    "elapsed_time":       0.0,
    "_last_file_name":    "",
    "_run_now":           False,
    "_original_columns":  set(),
}
for k, v in DEFAULTS.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
with st.sidebar:
    st.title("QC Automation")
    st.divider()

    uploaded = st.file_uploader(
        "Upload file (.xlsx or .csv)",
        type=["xlsx", "csv"],
        help="Drag & drop or click to browse",
    )

    if uploaded:
        # Load (cached) + reset state on new file
        with st.spinner("Loading..."):
            df = load_file(uploaded)

        if uploaded.name != st.session_state._last_file_name:
            st.session_state.df_original        = df
            st.session_state.df_working         = df.copy()
            st.session_state.pipeline_results   = []
            st.session_state.pipeline_complete  = False
            st.session_state.column_mapping     = {}
            st.session_state._last_file_name    = uploaded.name
            st.session_state._original_columns  = set(df.columns)

        st.success(f"{uploaded.name}  —  {len(df):,} rows × {len(df.columns)} cols")
        st.divider()

        tab_map, tab_pipe = st.tabs(["Column Mapping", "Pipeline"])

        with tab_map:
            render_column_mapper(df)

        with tab_pipe:
            render_pipeline_controls()
            st.divider()

            mapping = st.session_state.column_mapping
            if not mapping:
                st.warning("Apply a column mapping first.")
            else:
                st.markdown(f"**{len(mapping)} columns mapped**")
                if st.button("▶  Run Pipeline", type="primary", use_container_width=True):
                    # Reset working df and flag pipeline to run
                    st.session_state.df_working       = st.session_state.df_original.copy()
                    st.session_state.pipeline_results = []
                    st.session_state.pipeline_complete = False
                    st.session_state._run_now         = True
                    st.rerun()
    else:
        st.info("Upload a file to get started.")

# ---------------------------------------------------------------------------
# Main area
# ---------------------------------------------------------------------------
st.header("QC Automation Pipeline")

if st.session_state.df_original is None:
    st.markdown("""
    ### Getting Started
    1. **Upload** an Excel or CSV file in the sidebar
    2. **Map columns** — auto-detect or manually assign
    3. **Toggle steps** and adjust thresholds
    4. Click **Run Pipeline** to process
    5. **Download** the QC output
    """)
    st.stop()

tab_preview, tab_results, tab_analysis = st.tabs(["📊 Data Preview", "⚙️ Pipeline Results", "🔬 Pipeline Analysis"])

with tab_preview:
    render_preview(st.session_state.df_original)

with tab_results:

    # --- Execute pipeline if flagged ---
    if st.session_state._run_now:
        st.session_state._run_now = False
        df_out, results, elapsed = run_pipeline(
            st.session_state.df_working,
            st.session_state.column_mapping,
            st.session_state.step_toggles,
            st.session_state.thresholds,
        )
        st.session_state.df_working        = df_out
        st.session_state.pipeline_results  = results
        st.session_state.elapsed_time      = elapsed
        st.session_state.pipeline_complete = True

    # --- Show results ---
    if st.session_state.pipeline_complete:
        render_results_summary(st.session_state.pipeline_results)
        st.divider()
        render_download(st.session_state.df_working, st.session_state._original_columns)
        render_elapsed(st.session_state.get("elapsed_time", 0.0))
        render_step_timings(st.session_state.pipeline_results)

    elif st.session_state.pipeline_results:
        # Partial / previous results
        render_results_summary(st.session_state.pipeline_results)
    else:
        st.info("Pipeline results will appear here after you click **Run Pipeline**.")

with tab_analysis:
    if st.session_state.pipeline_complete:
        render_pipeline_analysis(
            st.session_state.df_original,
            st.session_state.df_working,
            st.session_state._original_columns,
            st.session_state.pipeline_results,
        )
    else:
        st.info("Run the pipeline first to see the analysis.")
