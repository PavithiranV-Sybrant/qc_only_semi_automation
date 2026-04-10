"""
Shared ThreadPoolExecutor for dispatching pipeline jobs (both single-file and batch).

The pipeline executor itself spins up its own inner pool for parallel steps, so this
outer pool is purely for job dispatch — not for the step-level work itself.

Worker count: 2× CPU count, capped at 16.  On a 4-core machine that is 8 workers,
meaning up to 8 files can be processed concurrently before queueing.
"""
import os
import concurrent.futures

_n_workers = min(16, max(4, (os.cpu_count() or 4) * 2))

pool = concurrent.futures.ThreadPoolExecutor(
    max_workers=_n_workers,
    thread_name_prefix="qc_job",
)
