import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  getBackgroundJobs, dismissSingleJob, dismissBatchJob,
  storedFileDownloadUrl, batchDownloadAllUrl, getQueue,
} from '../api'
import NewJobPanel from './NewJobPanel'

// ─── helpers ──────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(iso))
  } catch { return iso }
}

function fmtTimeOnly(iso) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    }).format(new Date(iso))
  } catch { return null }
}

function fmtElapsed(secs) {
  if (!secs && secs !== 0) return ''
  return secs < 60 ? `${secs.toFixed(1)}s` : `${(secs / 60).toFixed(1)}m`
}

const S_COLOR = {
  pending:            'bg-amber-100 text-amber-700',
  running:            'bg-violet-100 text-violet-700',
  done:               'bg-green-100 text-green-700',
  error:              'bg-red-100 text-red-700',
  cancelled:          'bg-gray-100 text-gray-500',
  preparing_download: 'bg-violet-100 text-violet-700',
  ready:              'bg-gray-100 text-gray-600',
}
const S_LABEL = {
  pending:            'Waiting',
  running:            'Running',
  done:               'Done',
  error:              'Failed',
  cancelled:          'Cancelled',
  preparing_download: 'Preparing…',
  ready:              'Ready',
}

function StatusBadge({ status }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0
      ${S_COLOR[status] || 'bg-gray-100 text-gray-600'}`}>
      {S_LABEL[status] || status}
    </span>
  )
}

function Chevron({ open }) {
  return (
    <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
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

function ProgressBar({ stepIndex, totalSteps, label }) {
  const pct = totalSteps > 0 ? Math.round((stepIndex / totalSteps) * 100) : 0
  return (
    <div className="mt-1.5">
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

// ─── Single job expanded body ──────────────────────────────────────────────

function SingleExpanded({ job }) {
  const isActive = ['pending', 'running', 'preparing_download'].includes(job.status)
  return (
    <div className="px-5 py-4 bg-gray-50 space-y-3">
      {/* Timing */}
      <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
        {job.started_at && (
          <span>Started: <span className="font-medium text-gray-700">{fmtTimeOnly(job.started_at)}</span></span>
        )}
        {job.status === 'done' && job.elapsed_total > 0 && (
          <span>Duration: <span className="font-medium text-gray-700">{fmtElapsed(job.elapsed_total)}</span></span>
        )}
      </div>

      {/* Progress */}
      {isActive && (
        <ProgressBar stepIndex={job.step_index || 0} totalSteps={job.total_steps || 0} label={job.current_step} />
      )}

      {/* Error */}
      {job.status === 'error' && job.error && (
        <p className="text-xs text-red-500">{job.error}</p>
      )}

      {/* Download */}
      {job.status === 'done' && job.storage_file_id && (
        <a href={storedFileDownloadUrl(job.storage_file_id)} download
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800
            bg-white hover:bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg transition-colors">
          ↓ Download
        </a>
      )}
    </div>
  )
}

// ─── Batch file row ────────────────────────────────────────────────────────

function BatchFileRow({ f }) {
  const startTime = fmtTimeOnly(f.started_at)
  const endTime   = fmtTimeOnly(f.completed_at)

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <span className="text-sm shrink-0 text-gray-400 mt-0.5">📄</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-gray-800 truncate">{f.file_name}</p>
          <StatusBadge status={f.status} />
          {f.detected_template && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
              {f.detected_template}
            </span>
          )}
          {f.rows > 0 && (
            <span className="text-xs text-gray-400">{f.rows?.toLocaleString()} rows</span>
          )}
        </div>

        {/* Timing */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5 flex-wrap">
          {startTime && <span>Started {startTime}</span>}
          {startTime && endTime && <span className="text-gray-300">→</span>}
          {endTime   && <span>Completed {endTime}</span>}
          {f.elapsed > 0 && <span className="text-gray-400">({fmtElapsed(f.elapsed)})</span>}
          {f.status === 'pending' && !startTime && <span className="text-amber-500">Waiting in queue…</span>}
        </div>

        {/* Progress bar for running file */}
        {f.status === 'running' && (
          <ProgressBar stepIndex={f.step_index || 0} totalSteps={f.total_steps || 0} label={f.current_step} />
        )}

        {/* Error */}
        {f.status === 'error' && f.error && (
          <p className="text-xs text-red-500 mt-0.5 truncate">{f.error}</p>
        )}
      </div>

      {/* Per-file download */}
      {f.status === 'done' && (
        <a href={f.storage_file_id
            ? storedFileDownloadUrl(f.storage_file_id)
            : `/api/batch/download/${f.session_id}`}
          download
          className="shrink-0 text-xs font-semibold text-violet-600 hover:text-violet-800
            bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors mt-0.5">
          ↓ Download
        </a>
      )}
    </div>
  )
}

// ─── Batch expanded body ───────────────────────────────────────────────────

function BatchExpanded({ batch }) {
  const done = (batch.files || []).filter(f => f.status === 'done')
  return (
    <div>
      {done.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <span className="text-xs text-gray-500">{done.length} of {batch.files?.length} files completed</span>
          <a href={batchDownloadAllUrl(batch.id)} download
            className="flex items-center gap-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700
              text-white px-3 py-1.5 rounded-lg transition-colors">
            ↓ Download All ({done.length})
          </a>
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {(batch.files || []).map(f => (
          <BatchFileRow key={f.session_id} f={f} />
        ))}
      </div>
    </div>
  )
}

// ─── Unified job card ──────────────────────────────────────────────────────

function JobCard({ item, onDismiss }) {
  const isBatch  = item._kind === 'batch'
  const isActive = item._isActive
  const [open, setOpen] = useState(isActive)

  // Auto-open when a job transitions from queued → active
  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive])

  return (
    <div className={`bg-white rounded-xl border overflow-hidden
      ${isActive ? 'border-violet-200 shadow-sm' : 'border-gray-200'}`}>

      {/* Header row — always visible, click to toggle */}
      <div
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 select-none"
      >
        <span className="text-xl shrink-0">{isBatch ? '📂' : '📄'}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800 truncate">{item._name}</p>
            <StatusBadge status={item.status} />
            {isBatch && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                {item.files?.length} file{item.files?.length !== 1 ? 's' : ''}
              </span>
            )}
            {item._elapsed > 0 && (
              <span className="text-xs text-gray-400">{fmtElapsed(item._elapsed)}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{fmtDateTime(item.started_at)}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isActive && (
            <DismissBtn onClick={e => { e.stopPropagation(); onDismiss() }} />
          )}
          <Chevron open={open} />
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-gray-100">
          {isBatch
            ? <BatchExpanded batch={item} />
            : <SingleExpanded job={item} />
          }
        </div>
      )}
    </div>
  )
}

// ─── Queue indicator ───────────────────────────────────────────────────────

function QueueIndicator({ items }) {
  const running = items.filter(i => i.status === 'running').length
  const waiting = items.filter(i => i.status === 'queued').length
  if (running === 0 && waiting === 0) return null
  return (
    <div className="flex items-center gap-2 text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-4 py-2">
      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
      {running > 0 && <span>{running} running</span>}
      {running > 0 && waiting > 0 && <span className="text-violet-300">·</span>}
      {waiting > 0 && <span>{waiting} waiting in queue</span>}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function BackgroundJobs({ onBack }) {
  const [jobs,      setJobs]      = useState({ single: [], batch: [] })
  const [queue,     setQueue]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const pollRef = useRef(null)

  const loadJobs = useCallback(async () => {
    try {
      const [data, qData] = await Promise.all([getBackgroundJobs(), getQueue()])
      setJobs(data)
      setQueue(qData)
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

  // Merge singles + batches, sort newest first
  const ACTIVE = ['pending', 'running', 'preparing_download']
  const allItems = useMemo(() => {
    const singles = jobs.single.map(j => ({
      ...j,
      _kind:     'single',
      _name:     j.file_name || 'Unknown file',
      _isActive: ACTIVE.includes(j.status),
      _elapsed:  j.elapsed_total,
    }))
    const batches = jobs.batch.map(b => ({
      ...b,
      _kind:     'batch',
      _name:     b.name || 'Batch',
      _isActive: ACTIVE.includes(b.status) ||
        (b.files || []).some(f => ACTIVE.includes(f.status)),
      _elapsed:  null,
    }))
    return [...singles, ...batches].sort((a, b) =>
      (b.started_at || '').localeCompare(a.started_at || '')
    )
  }, [jobs])

  async function handleDismiss(item) {
    try {
      if (item._kind === 'single') await dismissSingleJob(item.id)
      else await dismissBatchJob(item.id)
    } catch {}
    loadJobs()
  }

  async function handleDismissAllDone() {
    const done = allItems.filter(i => !i._isActive)
    await Promise.allSettled(
      done.map(i => i._kind === 'single'
        ? dismissSingleJob(i.id)
        : dismissBatchJob(i.id)
      )
    )
    loadJobs()
  }

  const anyCompleted = allItems.some(i => !i._isActive)
  const hasActive    = allItems.some(i => i._isActive)

  return (
    <div className="min-h-screen bg-gray-50">
      <NewJobPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmitted={() => { setTimeout(loadJobs, 500) }}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={onBack}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
            title="Back to home">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-violet-700">Background Jobs</h1>
          {hasActive && (
            <span className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              Processing
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            {anyCompleted && (
              <button onClick={handleDismissAllDone}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Dismiss all completed
              </button>
            )}
            <button onClick={() => setPanelOpen(true)}
              className="flex items-center gap-1.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700
                text-white px-3.5 py-1.5 rounded-lg transition-colors">
              + New Job
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">

        {/* Queue indicator */}
        <QueueIndicator items={queue} />

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>
        ) : allItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No background jobs</h2>
            <p className="text-gray-400 text-sm max-w-sm">
              Click <strong>+ New Job</strong> to add a single file or batch job to the queue.
              Jobs continue running even if you navigate away.
            </p>
          </div>
        ) : (
          allItems.map(item => (
            <JobCard
              key={`${item._kind}-${item.id}`}
              item={item}
              onDismiss={() => handleDismiss(item)}
            />
          ))
        )}
      </div>
    </div>
  )
}
