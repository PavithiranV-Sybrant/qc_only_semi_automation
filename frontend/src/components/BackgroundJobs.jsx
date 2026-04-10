import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getBackgroundJobs, dismissSingleJob, dismissBatchJob,
  storedFileDownloadUrl, batchDownloadAllUrl,
} from '../api'

// ─── helpers ──────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch { return iso }
}

function fmtElapsed(secs) {
  if (!secs) return ''
  return secs < 60 ? `${secs.toFixed(1)}s` : `${(secs / 60).toFixed(1)}m`
}

const S_COLOR = {
  pending:   'bg-amber-100 text-amber-700',
  running:   'bg-violet-100 text-violet-700',
  done:      'bg-green-100 text-green-700',
  error:     'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  preparing_download: 'bg-violet-100 text-violet-700',
}
const S_LABEL = {
  pending:   'Queued',
  running:   'Running',
  done:      'Done',
  error:     'Failed',
  cancelled: 'Cancelled',
  preparing_download: 'Preparing…',
}

function StatusBadge({ status }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${S_COLOR[status] || 'bg-gray-100 text-gray-600'}`}>
      {S_LABEL[status] || status}
    </span>
  )
}

function ProgressBar({ stepIndex, totalSteps, label }) {
  const pct = totalSteps > 0 ? Math.round((stepIndex / totalSteps) * 100) : 0
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span className="truncate">{label || 'Processing…'}</span>
        <span className="shrink-0 ml-2">{stepIndex}/{totalSteps}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-violet-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function DismissBtn({ onClick }) {
  return (
    <button onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
      title="Dismiss">
      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}

// ─── Single Job Card ──────────────────────────────────────────────────────

function SingleJobCard({ job, onDismiss }) {
  const isActive = ['pending', 'running', 'preparing_download'].includes(job.status)
  const isDone   = job.status === 'done'

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">📄</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {job.file_name || 'Unknown file'}
            </p>
            <StatusBadge status={job.status} />
            {job.elapsed_total > 0 && (
              <span className="text-xs text-gray-400">{fmtElapsed(job.elapsed_total)}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(job.started_at)}</p>

          {isActive && (
            <ProgressBar stepIndex={job.step_index} totalSteps={job.total_steps} label={job.current_step} />
          )}
          {job.status === 'error' && job.error && (
            <p className="text-xs text-red-500 mt-1 truncate">{job.error}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isDone && job.storage_file_id && (
            <a href={storedFileDownloadUrl(job.storage_file_id)}
              download
              className="text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              ↓ Download
            </a>
          )}
          {!isActive && <DismissBtn onClick={onDismiss} />}
        </div>
      </div>
    </div>
  )
}

// ─── Batch Section ────────────────────────────────────────────────────────

function BatchSection({ batches, onDismiss }) {
  const [selectedId, setSelectedId] = useState(null)

  // Auto-select the most recent batch
  useEffect(() => {
    if (batches.length > 0 && !selectedId) setSelectedId(batches[0].id)
  }, [batches])

  // Keep selectedId valid if list changes
  useEffect(() => {
    if (selectedId && !batches.find(b => b.id === selectedId)) {
      setSelectedId(batches[0]?.id || null)
    }
  }, [batches])

  const batch = batches.find(b => b.id === selectedId)

  if (!batch) return null

  const done      = batch.files?.filter(f => f.status === 'done') || []
  const running   = batch.files?.filter(f => f.status === 'running') || []
  const pending   = batch.files?.filter(f => f.status === 'pending') || []
  const failed    = batch.files?.filter(f => f.status === 'error') || []
  const isActive  = ['running', 'pending'].includes(batch.status) || running.length > 0 || pending.length > 0
  const isDismissable = !isActive

  return (
    <div className="space-y-3">
      {/* Batch selector dropdown */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">
          Batch
        </label>
        <select
          value={selectedId || ''}
          onChange={e => setSelectedId(e.target.value)}
          className="flex-1 min-w-0 text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 bg-white"
        >
          {batches.map(b => (
            <option key={b.id} value={b.id}>
              {b.name || `Batch`} — {fmtDate(b.started_at)} ({b.files?.length || 0} files)
            </option>
          ))}
        </select>
        {isDismissable && (
          <DismissBtn onClick={() => { onDismiss(batch.id); setSelectedId(batches.find(b => b.id !== batch.id)?.id || null) }} />
        )}
      </div>

      {/* Batch summary */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <StatusBadge status={batch.status} />
            {done.length > 0    && <span className="text-green-600 font-medium">{done.length} done</span>}
            {running.length > 0 && <span className="text-violet-600 font-medium">{running.length} running</span>}
            {pending.length > 0 && <span className="text-amber-600 font-medium">{pending.length} queued</span>}
            {failed.length > 0  && <span className="text-red-600 font-medium">{failed.length} failed</span>}
          </div>

          {done.length > 0 && (
            <a
              href={batchDownloadAllUrl(batch.id)}
              download
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              ↓ Download All ({done.length})
            </a>
          )}
        </div>

        {/* File list */}
        <div className="divide-y divide-gray-100">
          {(batch.files || []).map(f => {
            const fileActive = ['running', 'pending'].includes(f.status)
            const fileDone   = f.status === 'done'
            return (
              <div key={f.session_id} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-base shrink-0">📄</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-gray-800 truncate">{f.file_name}</p>
                      <StatusBadge status={f.status} />
                      {f.elapsed && <span className="text-xs text-gray-400">{fmtElapsed(f.elapsed)}</span>}
                      <span className="text-xs text-gray-400">{f.rows?.toLocaleString()} rows</span>
                    </div>
                    {fileActive && (
                      <ProgressBar stepIndex={f.step_index} totalSteps={f.total_steps} label={f.current_step} />
                    )}
                    {f.status === 'error' && f.error && (
                      <p className="text-xs text-red-500 mt-1 truncate">{f.error}</p>
                    )}
                  </div>

                  {fileDone && (
                    <a
                      href={f.storage_file_id
                        ? storedFileDownloadUrl(f.storage_file_id)
                        : `/api/batch/download/${f.session_id}`}
                      download
                      className="shrink-0 text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                      ↓ Download
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function BackgroundJobs({ onBack }) {
  const [jobs,    setJobs]    = useState({ single: [], batch: [] })
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  const hasActive = useCallback((data) => {
    const activeStatuses = ['pending', 'running', 'preparing_download']
    const singleActive = data.single.some(j => activeStatuses.includes(j.status))
    const batchActive  = data.batch.some(b =>
      activeStatuses.includes(b.status) ||
      (b.files || []).some(f => activeStatuses.includes(f.status))
    )
    return singleActive || batchActive
  }, [])

  const loadJobs = useCallback(async () => {
    try {
      const data = await getBackgroundJobs()
      setJobs(data)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
    pollRef.current = setInterval(loadJobs, 2000)
    return () => clearInterval(pollRef.current)
  }, [loadJobs])

  async function handleDismissSingle(jobId) {
    try { await dismissSingleJob(jobId) } catch { /* already gone */ }
    setJobs(prev => ({ ...prev, single: prev.single.filter(j => j.id !== jobId) }))
  }

  async function handleDismissBatch(batchId) {
    try { await dismissBatchJob(batchId) } catch { /* already gone */ }
    setJobs(prev => ({ ...prev, batch: prev.batch.filter(b => b.id !== batchId) }))
  }

  async function handleDismissAllDone() {
    const doneSingle = jobs.single.filter(j => !['pending', 'running', 'preparing_download'].includes(j.status))
    const doneBatch  = jobs.batch.filter(b => !['pending', 'running'].includes(b.status) &&
      !(b.files || []).some(f => ['pending', 'running'].includes(f.status)))

    await Promise.allSettled([
      ...doneSingle.map(j => dismissSingleJob(j.id)),
      ...doneBatch.map(b => dismissBatchJob(b.id)),
    ])
    setJobs(prev => ({
      single: prev.single.filter(j => ['pending', 'running', 'preparing_download'].includes(j.status)),
      batch:  prev.batch.filter(b => ['pending', 'running'].includes(b.status) ||
        (b.files || []).some(f => ['pending', 'running'].includes(f.status))),
    }))
  }

  const totalJobs    = jobs.single.length + jobs.batch.length
  const anyCompleted = jobs.single.some(j => !['pending', 'running', 'preparing_download'].includes(j.status)) ||
    jobs.batch.some(b => !['pending', 'running'].includes(b.status))

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={onBack}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
            title="Back to home">
            <BackIcon />
          </button>
          <h1 className="text-lg font-bold text-violet-700">Background Jobs</h1>
          {hasActive(jobs) && (
            <span className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              Processing
            </span>
          )}
          {anyCompleted && (
            <button onClick={handleDismissAllDone}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Dismiss all completed
            </button>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>
        ) : totalJobs === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No background jobs</h2>
            <p className="text-gray-400 text-sm max-w-sm">
              Jobs appear here when you run a pipeline from Single File or Batch Processing.
              They continue running even if you navigate away.
            </p>
          </div>
        ) : (
          <>
            {/* ── Single File Jobs ──────────────────────────────── */}
            {jobs.single.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Single File Jobs
                  <span className="ml-2 font-normal normal-case text-gray-400">
                    — {jobs.single.length} job{jobs.single.length !== 1 ? 's' : ''}
                  </span>
                </h2>
                {jobs.single.map(job => (
                  <SingleJobCard key={job.id} job={job} onDismiss={() => handleDismissSingle(job.id)} />
                ))}
              </section>
            )}

            {/* ── Batch Jobs ────────────────────────────────────── */}
            {jobs.batch.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Batch Jobs
                  <span className="ml-2 font-normal normal-case text-gray-400">
                    — {jobs.batch.length} batch{jobs.batch.length !== 1 ? 'es' : ''}
                  </span>
                </h2>
                <BatchSection batches={jobs.batch} onDismiss={handleDismissBatch} />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
