import { useState, useEffect, useRef, useCallback } from 'react'
import { getConfig, batchUpload, runBatch, pollBatchStatus, cancelBatch } from '../api'
import ColumnMapper from './ColumnMapper'

const STATUS_COLORS = {
  ready:     'bg-gray-100 text-gray-600',
  pending:   'bg-amber-100 text-amber-700',
  running:   'bg-violet-100 text-violet-700',
  done:      'bg-green-100 text-green-700',
  error:     'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS = {
  ready:     'Ready',
  pending:   'Queued',
  running:   'Running',
  done:      'Done',
  error:     'Error',
  cancelled: 'Cancelled',
}

export default function BatchProcessor({ onBack }) {
  // Upload phase
  const [dragOver,       setDragOver]       = useState(false)
  const [uploading,      setUploading]      = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [uploadError,    setUploadError]    = useState(null)

  // Batch state
  const [batchId,        setBatchId]        = useState(null)
  const [files,          setFiles]          = useState([])         // from upload response
  const [batchStatus,    setBatchStatus]    = useState(null)

  // Config
  const [columnMapping,  setColumnMapping]  = useState(null)
  const [stepLabels,     setStepLabels]     = useState({})
  const [toggles,        setToggles]        = useState({})
  const [thresholds,     setThresholds]     = useState({ name_email_fuzzy: 80, linkedin_fuzzy: 0.5 })
  const [allOn,          setAllOn]          = useState(true)

  // Run state
  const [running,        setRunning]        = useState(false)
  const [error,          setError]          = useState(null)
  const pollRef = useRef(null)

  const fileInputRef = useRef(null)

  useEffect(() => {
    getConfig().then(cfg => {
      setStepLabels(cfg.step_labels || {})
      setToggles(cfg.steps || {})
    })
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // ── drag & drop ────────────────────────────────────────────────────────────

  const onDrop = useCallback(async (e) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer?.files || [])
    await handleFiles(dropped)
  }, [])

  async function handleFiles(fileList) {
    if (!fileList.length) return
    setUploading(true)
    setUploadProgress(0)
    setUploadError(null)
    setError(null)
    try {
      const data = await batchUpload(fileList, setUploadProgress)
      setBatchId(data.batch_id)
      setFiles(data.files)
      setBatchStatus(null)
      setColumnMapping(null)
      setRunning(false)
    } catch (e) {
      setUploadError(e.response?.data?.detail || 'Upload failed.')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  // ── toggles ────────────────────────────────────────────────────────────────

  function toggleAll(val) {
    setAllOn(val)
    setToggles(prev => Object.fromEntries(Object.keys(prev).map(k => [k, val])))
  }

  // ── run / poll ─────────────────────────────────────────────────────────────

  async function handleRun() {
    if (!columnMapping) return
    setError(null)
    setRunning(true)
    try {
      await runBatch(batchId, columnMapping, toggles, thresholds)
      pollRef.current = setInterval(async () => {
        try {
          const status = await pollBatchStatus(batchId)
          setBatchStatus(status)
          setFiles(status.files || [])
          if (['done', 'cancelled'].includes(status.status)) {
            clearInterval(pollRef.current)
            setRunning(false)
          }
        } catch {
          clearInterval(pollRef.current)
          setRunning(false)
          setError('Lost connection to server.')
        }
      }, 2000)
    } catch (e) {
      setRunning(false)
      setError(e.response?.data?.detail || 'Failed to start batch.')
    }
  }

  async function handleCancel() {
    try {
      await cancelBatch(batchId)
      clearInterval(pollRef.current)
      setRunning(false)
    } catch {
      setError('Failed to cancel batch.')
    }
  }

  function handleReset() {
    clearInterval(pollRef.current)
    setBatchId(null)
    setFiles([])
    setBatchStatus(null)
    setColumnMapping(null)
    setRunning(false)
    setError(null)
    setUploadError(null)
  }

  // ── derived ────────────────────────────────────────────────────────────────

  const doneCount    = files.filter(f => f.status === 'done').length
  const errorCount   = files.filter(f => f.status === 'error').length
  const runningCount = files.filter(f => f.status === 'running').length
  const firstFile    = files[0]
  const batchDone    = batchStatus?.status === 'done'
  const batchCancelled = batchStatus?.status === 'cancelled'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Sidebar */}
      <aside className="w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-2">
          <button onClick={onBack}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-violet-600 transition-colors" title="Back to home">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-violet-700">Batch Processing</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Upload zone */}
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Upload Files</p>
            {!batchId ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors
                  ${dragOver ? 'border-violet-500 bg-violet-50' : 'border-gray-300 hover:border-violet-400 hover:bg-gray-50'}`}
              >
                <div className="text-3xl mb-2">📂</div>
                <p className="text-sm font-medium text-gray-600">Drop files here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">.xlsx and .csv supported</p>
                <input ref={fileInputRef} type="file" multiple accept=".xlsx,.csv"
                  className="hidden"
                  onChange={e => handleFiles(Array.from(e.target.files))} />
              </div>
            ) : (
              <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 flex items-center justify-between">
                <span className="font-medium text-gray-700">{files.length} file{files.length !== 1 ? 's' : ''} loaded</span>
                {!running && (
                  <button onClick={handleReset}
                    className="ml-2 text-gray-400 hover:text-red-500 transition-colors text-base leading-none" title="Reset">
                    ✕
                  </button>
                )}
              </div>
            )}

            {uploading && (
              <div className="mt-2">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all"
                    style={{ width: `${uploadProgress ?? 0}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1 text-center">Uploading… {uploadProgress}%</p>
              </div>
            )}
            {uploadError && (
              <p className="text-xs text-red-600 mt-1">{uploadError}</p>
            )}
          </section>

          {/* Column mapping */}
          {batchId && firstFile && (
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Column Mapping</p>
              <p className="text-xs text-gray-400 mb-2">Based on first file's columns. Apply same mapping to all files.</p>
              <ColumnMapper columns={firstFile.column_names} onMappingChange={setColumnMapping} />
              {columnMapping && (
                <p className="text-xs text-green-600 mt-1">✓ {Object.keys(columnMapping).length} columns mapped</p>
              )}
            </section>
          )}

          {/* Pipeline steps */}
          {batchId && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Steps</p>
                <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                  All
                  <div onClick={() => toggleAll(!allOn)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer
                      ${allOn ? 'bg-violet-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                      ${allOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1 mb-3">
                {Object.entries(stepLabels).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <div onClick={() => setToggles(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`relative w-8 h-4 rounded-full transition-colors shrink-0 cursor-pointer
                        ${toggles[key] ? 'bg-violet-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform
                        ${toggles[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-gray-600">{label}</span>
                  </label>
                ))}
              </div>

              <hr className="my-3 border-gray-200" />
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Name / Email fuzzy</span>
                    <span className="font-medium text-gray-700">{thresholds.name_email_fuzzy}</span>
                  </div>
                  <input type="range" min={0} max={100} value={thresholds.name_email_fuzzy}
                    onChange={e => setThresholds(p => ({ ...p, name_email_fuzzy: +e.target.value }))}
                    className="w-full accent-violet-600" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>LinkedIn fuzzy</span>
                    <span className="font-medium text-gray-700">{thresholds.linkedin_fuzzy.toFixed(2)}</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.05} value={thresholds.linkedin_fuzzy}
                    onChange={e => setThresholds(p => ({ ...p, linkedin_fuzzy: +e.target.value }))}
                    className="w-full accent-violet-600" />
                </div>
              </div>

              {running ? (
                <button onClick={handleCancel}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                  ✕ Cancel Batch
                </button>
              ) : (
                <button onClick={handleRun} disabled={!columnMapping || batchDone}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                    text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                  {batchDone ? '✓ Batch Complete' : '▶  Run Batch'}
                </button>
              )}
              {!columnMapping && (
                <p className="text-xs text-amber-500 mt-1 text-center">Apply column mapping first</p>
              )}
            </section>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </aside>

      {/* Main — file results */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 h-12 shrink-0">
          <span className="text-sm font-semibold text-gray-700">Batch Results</span>
          {files.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{files.length} files</span>
              {doneCount > 0    && <span className="text-green-600 font-medium">{doneCount} done</span>}
              {runningCount > 0 && <span className="text-violet-600 font-medium">{runningCount} running</span>}
              {errorCount > 0   && <span className="text-red-600 font-medium">{errorCount} failed</span>}
            </div>
          )}
          {batchCancelled && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Cancelled</span>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">📂</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No files uploaded yet</h2>
              <p className="text-gray-400 text-sm max-w-sm">
                Drop Excel or CSV files into the sidebar to get started. You can upload as many as you need.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl">
              {files.map((f, i) => {
                const pct = f.total_steps > 0
                  ? Math.round((f.step_index / f.total_steps) * 100)
                  : 0

                return (
                  <div key={f.session_id}
                    className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-5 text-right shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800 truncate">{f.file_name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[f.status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABELS[f.status] || f.status}
                          </span>
                          <span className="text-xs text-gray-400">{f.rows?.toLocaleString()} rows</span>
                          {f.elapsed && <span className="text-xs text-gray-400">{f.elapsed}s</span>}
                        </div>

                        {f.status === 'running' && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span className="truncate">{f.current_step || 'Processing…'}</span>
                              <span>{f.step_index}/{f.total_steps}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500 rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}

                        {f.status === 'error' && f.error && (
                          <p className="text-xs text-red-500 mt-1">{f.error}</p>
                        )}
                      </div>

                      {f.status === 'done' && f.download_ready && (
                        <a
                          href={`/api/batch/download/${f.session_id}`}
                          download
                          className="shrink-0 flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          ↓ Download
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}

              {batchDone && doneCount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-sm text-green-700 font-medium">
                  ✓ Batch complete — {doneCount} file{doneCount !== 1 ? 's' : ''} processed successfully.
                  {errorCount > 0 && ` ${errorCount} file${errorCount !== 1 ? 's' : ''} failed.`}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
