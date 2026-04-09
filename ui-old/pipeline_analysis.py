import pandas as pd
import streamlit as st


def render_pipeline_analysis(
    df_before: pd.DataFrame,
    df_after:  pd.DataFrame,
    original_cols: set,
    pipeline_results: list,
):
    added_cols   = [c for c in df_after.columns  if c not in original_cols]
    removed_cols = [c for c in original_cols      if c not in df_after.columns]
    kept_orig    = [c for c in df_before.columns  if c in df_after.columns]

    # ── 1. Change Overview ─────────────────────────────────────────────
    m1, m2, m3, m4, m5 = st.columns(5)
    m1.metric("Columns Before",  len(original_cols))
    m2.metric("Columns After",   len(df_after.columns))
    m3.metric("Added",           len(added_cols))
    m4.metric("Removed",         len(removed_cols))
    m5.metric("Rows",            f"{len(df_after):,}")

    st.divider()

    # ── 2. New Columns Summary Table ───────────────────────────────────
    if not added_cols:
        st.info("No new columns were added by the pipeline.")
    else:
        st.subheader(f"New Columns Added  ({len(added_cols)})")

        summary_rows = []
        for col in added_cols:
            s = df_after[col]
            top_val = str(s.value_counts().index[0]) if s.notna().any() else "—"
            summary_rows.append({
                "Column":         col,
                "Populated":      int(s.notna().sum()),
                "Null":           int(s.isna().sum()),
                "Null %":         round(s.isna().mean() * 100, 1),
                "Unique Values":  int(s.nunique()),
                "Most Common":    top_val,
            })

        def _color_null(series):
            def _c(v):
                if v >= 50: return "background-color: #f4999a"
                if v >= 20: return "background-color: #fad4a6"
                if v >  0:  return "background-color: #fef3cd"
                return ""
            return [_c(v) for v in series]

        summary_df = pd.DataFrame(summary_rows)
        st.dataframe(
            summary_df.style.apply(_color_null, subset=["Null %"]),
            use_container_width=True,
            hide_index=True,
        )

        st.divider()

        # ── 3. New Column Deep Dive ────────────────────────────────────
        st.subheader("New Column Deep Dive")

        selected_col = st.selectbox(
            "Select a new column to inspect",
            options=added_cols,
            key="analysis_new_col",
        )

        if selected_col:
            col_series = df_after[selected_col]

            d1, d2, d3, d4 = st.columns(4)
            d1.metric("Populated",     f"{col_series.notna().sum():,}")
            d2.metric("Null",          f"{col_series.isna().sum():,}")
            d3.metric("Unique Values", f"{col_series.nunique():,}")
            d4.metric("Null %",        f"{round(col_series.isna().mean()*100, 1)}%")

            st.divider()

            vc    = col_series.value_counts()
            vc_df = vc.reset_index()
            vc_df.columns  = ["Value", "Count"]
            vc_df["% of Rows"] = (vc_df["Count"] / len(df_after) * 100).round(1)

            left, right = st.columns([2, 3])
            with left:
                st.markdown("**Value Distribution**")
                st.dataframe(vc_df, use_container_width=True, hide_index=True, height=340)
            with right:
                st.markdown("**Chart**")
                st.bar_chart(vc, height=320)

            st.divider()

            # ── 4. Browse flagged rows ─────────────────────────────────
            st.subheader("Browse Rows by Flag Value")

            flag_opts = sorted(col_series.dropna().astype(str).unique().tolist())
            selected_flags = st.multiselect(
                f"Filter '{selected_col}' by value",
                options=flag_opts,
                key="analysis_flag_filter",
            )

            if selected_flags:
                mask         = col_series.astype(str).isin(selected_flags)
                filtered     = df_after[mask]
                display_cols = kept_orig + [selected_col]
                st.markdown(f"**{len(filtered):,} of {len(df_after):,} rows** match")
                st.dataframe(
                    filtered[display_cols],
                    use_container_width=True,
                    height=340,
                )
            else:
                st.caption("Select one or more values above to browse matching rows.")

    # ── 5. Removed Columns ────────────────────────────────────────────
    if removed_cols:
        st.divider()
        st.subheader(f"Columns Removed  ({len(removed_cols)})")
        st.dataframe(
            pd.DataFrame({"Removed Column": removed_cols}),
            use_container_width=True,
            hide_index=True,
        )
