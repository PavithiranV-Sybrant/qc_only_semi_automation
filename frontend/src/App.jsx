import { useState, useEffect, useRef } from 'react'
import { uploadFile, startPipeline, pollStatus, getSettings } from './api'
import FileUpload from './components/FileUpload'
import PipelineProgress from './components/PipelineProgress'
import PipelineResults from './components/PipelineResults'
import SettingsPage from './components/SettingsPage'

const TABS = [
  { id: 'results', label: '📊 Results' },
  { id: 'progress', label: '⚙️ Progress' },
]

export default function App() {
  const [fileInfo, setFileInfo]       = useState(null)
  const [uploading, setUploading]     = useState(false)
  const [uploadPct, setUploadPct]     = useState(null)
  const [jobId, setJobId]             = useState(null)
  const [job, setJob]                 = useState(null)
  const [sessionId, setSessionId]     = useState(null)
  const [error, setError]             = useState(null)
  const [tab, setTab]                 = useState('results')
  const [showSettings, setShowSettings] = useState(false)
  const [hasKey, setHasKey]           = useState(true)
  const pollRef = useRef(null)

  // Check if API key is configured on load
  useEffect(() => {
    getSettings().then(s => {
      if (!s.has_key) {
        setHasKey(false)
        setShowSettings(true)
      }
    }).catch(() => {})
  }, [])

  // Poll job status
  useEffect(() => {
    if (!jobId) return
    pollRef.current = setInterval(async () => {
      try {
        const s = await pollStatus(jobId)
        setJob(s)
        if (s.status === 'done') {
          clearInterval(pollRef.current)
          setTab('results')
        } else if (s.status === 'error') {
          clearInterval(pollRef.current)
          setTab('progress')
        }
      } catch {
        clearInterval(pollRef.current)
        setError('Lost connection to server.')
      }
    }, 1500)
    return () => clearInterval(pollRef.current)
  }, [jobId])

  async function handleUpload(file) {
    setUploading(true)
    setUploadPct(0)
    setError(null)
    setJob(null)
    setJobId(null)
    try {
      const data = await uploadFile(file, setUploadPct)
      setFileInfo(data)
      setSessionId(data.session_id)
    } catch (e) {
      setError(e.response?.data?.detail || 'Upload failed.')
    } finally {
      setUploading(false)
      setUploadPct(null)
    }
  }

  async function handleRun() {
    if (!fileInfo) return
    setError(null)
    setJob({ status: 'pending', phase: '', message: 'Queued…', pct: 0 })
    setTab('progress')
    try {
      const { job_id } = await startPipeline(sessionId)
      setJobId(job_id)
    } catch (e) {
      const msg = e.response?.data?.detail || 'Failed to start pipeline.'
      setJob(null)
      setError(msg)
      if (msg.includes('API key')) setShowSettings(true)
    }
  }

  function handleClear() {
    clearInterval(pollRef.current)
    setFileInfo(null)
    setSessionId(null)
    setJobId(null)
    setJob(null)
    setError(null)
  }

  const isRunning = job?.status === 'running' || job?.status === 'pending'
  const isDone = job?.status === 'done'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-lg">🤖</div>
            <div>
              <h1 className="text-sm font-bold text-violet-700">QC Autonomous Agent</h1>
              <p className="text-xs text-gray-400">Powered by Groq · {' '}
                <span className="text-violet-400">openai/gpt-oss-120b</span>
              </p>
            </div>
          </div>
          <button onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            ⚙️
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* No API key warning */}
          {!hasKey && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700">
              ⚠ No API key configured.{' '}
              <button onClick={() => setShowSettings(true)} className="underline font-semibold">Open Settings</button>
            </div>
          )}

          {/* File upload */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Input File</p>
            <FileUpload
              onUpload={handleUpload}
              loading={uploading}
              uploadProgress={uploadPct}
              fileInfo={fileInfo}
              onClear={handleClear}
            />
          </section>

          {/* How it works */}
          {!fileInfo && (
            <section className="bg-violet-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-violet-700">How it works</p>
              {[
                ['1', 'Upload your Excel or CSV file'],
                ['2', 'AI detects column roles automatically'],
                ['3', 'All applicable QC checks run'],
                ['4', 'Download result with flag columns'],
              ].map(([n, t]) => (
                <div key={n} className="flex items-center gap-2 text-xs text-violet-600">
                  <span className="w-5 h-5 rounded-full bg-violet-200 flex items-center justify-center font-bold text-violet-700 shrink-0">{n}</span>
                  {t}
                </div>
              ))}
            </section>
          )}

          {/* Job status while running */}
          {isRunning && (
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pipeline Status</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-violet-600 font-medium">{job.message}</span>
                  <span className="text-gray-400">{job.pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${job.pct}%` }} />
                </div>
              </div>
            </section>
          )}

        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            ⚠ {error}
          </div>
        )}

        {/* Run button */}
        <div className="px-5 pb-5 pt-2">
          <button
            onClick={handleRun}
            disabled={!fileInfo || isRunning}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
              ${!fileInfo || isRunning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-200 active:scale-[0.98]'}`}
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Analyzing & Running QC…
              </>
            ) : (
              <>▶ Run Autonomous QC</>
            )}
          </button>
          {!fileInfo && (
            <p className="text-center text-xs text-gray-400 mt-2">Upload a file to get started</p>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Tab bar */}
        <div className="bg-white border-b border-gray-200 px-6 flex items-center gap-1 h-12 shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors
                ${tab === t.id ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {isDone && (
              <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">
                ✅ {job.quality_score?.toFixed(0)}% Quality · {job.columns_added?.length} columns added
              </span>
            )}
            {isRunning && (
              <span className="text-xs font-bold bg-violet-100 text-violet-700 px-3 py-1 rounded-full flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 border border-violet-600 border-t-transparent rounded-full animate-spin" />
                {job.pct}%
              </span>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto p-6">
          {tab === 'progress' ? (
            <div className="max-w-xl mx-auto">
              <PipelineProgress job={job} />
            </div>
          ) : (
            <PipelineResults job={job} sessionId={sessionId} />
          )}
        </div>
      </main>

      {showSettings && (
        <SettingsPage onClose={() => { setShowSettings(false); getSettings().then(s => setHasKey(s.has_key)) }} />
      )}
    </div>
  )
}
