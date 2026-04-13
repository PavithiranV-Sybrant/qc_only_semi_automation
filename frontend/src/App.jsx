import { useState, useEffect, useRef, useCallback } from 'react'
import { uploadFile, startPipeline, pollJobStatus, cancelPipeline } from './api'
import FileUpload       from './components/FileUpload'
import ColumnMapper     from './components/ColumnMapper'
import PipelineControls from './components/PipelineControls'
import DataPreview      from './components/DataPreview'
import PipelineResults  from './components/PipelineResults'
import PipelineAnalysis from './components/PipelineAnalysis'
import InfoPanel        from './components/InfoPanel'
import LandingScreen    from './components/LandingScreen'
import TemplateManager  from './components/TemplateManager'
import BatchProcessor   from './components/BatchProcessor'
import SettingsPage     from './components/SettingsPage'
import BackgroundJobs   from './components/BackgroundJobs'
import FinalOutputTemplateManager from './components/FinalOutputTemplateManager'
import './index.css'

const TABS = [
  { id: 'preview',  label: '📊 Data Preview' },
  { id: 'results',  label: '⚙️ Pipeline Results' },
  { id: 'analysis', label: '🔬 Pipeline Analysis' },
]

export default function App() {
  const [currentMode,    setCurrentMode]    = useState(null)   // null | 'single' | 'batch' | 'templates'

  const [sessionId,      setSessionId]      = useState(null)
  const [fileInfo,       setFileInfo]       = useState(null)
  const [previewRows,    setPreviewRows]    = useState([])
  const [dataQuality,    setDataQuality]    = useState([])
  const [columnMapping,  setColumnMapping]  = useState(null)
  const [pipelineData,   setPipelineData]   = useState(null)
  const [activeTab,      setActiveTab]      = useState('preview')
  const [uploading,      setUploading]      = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [largeFile,      setLargeFile]      = useState(false)
  const [error,          setError]          = useState(null)

  // Job / pipeline progress
  const [jobId,        setJobId]        = useState(null)
  const [jobProgress,  setJobProgress]  = useState(null)
  const [downloadReady, setDownloadReady] = useState(false)
  const [preparingDl,  setPreparingDl]  = useState(false)
  const pollRef    = useRef(null)

  // Resizable sidebar (desktop)
  const [sidebarWidth, setSidebarWidth] = useState(384)
  const isResizing = useRef(false)

  const onMouseDown = useCallback(() => { isResizing.current = true }, [])

  useEffect(() => {
    function onMouseMove(e) {
      if (!isResizing.current) return
      const newWidth = Math.min(Math.max(e.clientX, 200), 700)
      setSidebarWidth(newWidth)
    }
    function onMouseUp() { isResizing.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // Responsive: mobile sidebar drawer
  const [isMobile, setIsMobile]       = useState(() => window.innerWidth < 768)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Info panel
  const [infoOpen, setInfoOpen] = useState(false)

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Poll for pipeline status
  useEffect(() => {
    if (!jobId) return
    pollRef.current = setInterval(async () => {
      try {
        const job = await pollJobStatus(jobId)
        setJobProgress(job)

        if (job.status === 'preparing_download') {
          setPreparingDl(true)
        }

        if (job.status === 'done') {
          clearInterval(pollRef.current)
          setJobId(null)
          setPreparingDl(false)
          setDownloadReady(true)
          setPipelineData(job)
          setActiveTab('results')
        } else if (job.status === 'error') {
          clearInterval(pollRef.current)
          setJobId(null)
          setPreparingDl(false)
          setError(job.error || 'Pipeline failed.')
        }
      } catch {
        clearInterval(pollRef.current)
        setJobId(null)
        setError('Lost connection to server.')
      }
    }, 2000)
    return () => clearInterval(pollRef.current)
  }, [jobId])

  async function handleUpload(file) {
    setUploading(true)
    setUploadProgress(0)
    setError(null)
    try {
      const data = await uploadFile(file, setUploadProgress)
      setSessionId(data.session_id)
      setFileInfo({ file_name: data.file_name, rows: data.rows, columns: data.columns, column_names: data.column_names })
      setPreviewRows(data.preview_rows)
      setDataQuality(data.data_quality)
      setLargeFile(data.large_file || false)
      setColumnMapping(null)
      setPipelineData(null)
      setJobProgress(null)
      setDownloadReady(false)
      setActiveTab('preview')
    } catch (e) {
      setError(e.response?.data?.detail || 'Upload failed.')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  function handleReset() {
    if (pollRef.current) clearInterval(pollRef.current)
    setSessionId(null); setFileInfo(null); setPreviewRows([]); setDataQuality([])
    setColumnMapping(null); setPipelineData(null); setJobProgress(null)
    setJobId(null); setDownloadReady(false); setPreparingDl(false)
    setUploading(false); setUploadProgress(null); setLargeFile(false); setError(null)
    setActiveTab('preview')
  }

  async function handleCancelPipeline() {
    if (!jobId) return
    try {
      await cancelPipeline(jobId)
      clearInterval(pollRef.current)
      setJobId(null)
      setJobProgress(prev => ({ ...prev, status: 'cancelled', current_step: 'Cancelled by user.' }))
    } catch {
      setError('Failed to cancel pipeline.')
    }
  }

  async function handleRun(toggles, thresholds) {
    if (!columnMapping) return
    setError(null)
    setDownloadReady(false)
    setJobProgress({ status: 'pending', step_index: 0, total_steps: 0, current_step: 'Starting...' })
    try {
      const { job_id } = await startPipeline(sessionId, columnMapping, toggles, thresholds)
      setJobId(job_id)
    } catch (e) {
      setJobProgress(null)
      setError(e.response?.data?.detail || 'Failed to start pipeline.')
    }
  }

  const isRunning  = !!jobId || ['running', 'pending', 'preparing_download'].includes(jobProgress?.status)
  const progressPct = jobProgress?.total_steps > 0
    ? Math.round((jobProgress.step_index / jobProgress.total_steps) * 100)
    : 0

  // ── Mode routing ──────────────────────────────────────────────────────────
  if (currentMode === null)        return <LandingScreen onSelect={setCurrentMode} />
  if (currentMode === 'templates') return <TemplateManager onBack={() => setCurrentMode(null)} />
  if (currentMode === 'batch')     return <BatchProcessor  onBack={() => setCurrentMode(null)} />
  if (currentMode === 'settings')   return <SettingsPage    onBack={() => setCurrentMode(null)} />
  if (currentMode === 'background')   return <BackgroundJobs             onBack={() => setCurrentMode(null)} />
  if (currentMode === 'final-output') return <FinalOutputTemplateManager onBack={() => setCurrentMode(null)} />

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        style={isMobile ? { width: 300 } : { width: sidebarWidth }}
        className={`bg-white flex flex-col overflow-hidden ${isMobile
          ? `fixed inset-y-0 left-0 z-50 shadow-2xl transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : 'shrink-0'}`}
      >
        <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-2">
          <button
            onClick={() => { handleReset(); setCurrentMode(null) }}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors shrink-0"
            title="Back to home"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-violet-700">Single File</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Upload File</p>
            <FileUpload onUpload={handleUpload} loading={uploading} uploadProgress={uploadProgress} />
            {fileInfo && !uploading && (
              <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 flex items-center justify-between">
                <div className="truncate">
                  <span className="font-medium text-gray-700">{fileInfo.file_name}</span>
                  <span className="ml-1">— {fileInfo.rows?.toLocaleString()} rows × {fileInfo.columns} cols</span>
                </div>
                <button onClick={handleReset} title="Clear and start over"
                  className="ml-2 shrink-0 text-gray-400 hover:text-red-500 transition-colors text-base leading-none">
                  ✕
                </button>
              </div>
            )}
            {largeFile && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                ⚠️ Large file — pipeline may take several minutes. Progress shown live.
              </div>
            )}
          </section>

          {fileInfo && (
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Column Mapping</p>
              <ColumnMapper columns={fileInfo.column_names} onMappingChange={setColumnMapping} />
              {columnMapping && (
                <p className="text-xs text-green-600 mt-1">✓ {Object.keys(columnMapping).length} columns mapped</p>
              )}
            </section>
          )}

          {fileInfo && (
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pipeline</p>
              <PipelineControls onRun={handleRun} loading={isRunning} mappingApplied={!!columnMapping} />
            </section>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}
      </aside>

      {/* Resize handle (desktop only) */}
      {!isMobile && (
        <div onMouseDown={onMouseDown}
          className="w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-violet-400 transition-colors active:bg-violet-600" />
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="bg-white border-b border-gray-200 px-3 md:px-6 flex items-center gap-1 h-12 shrink-0 overflow-x-auto">
          {isMobile && (
            <button onClick={() => setSidebarOpen(o => !o)}
              className="mr-2 p-1.5 rounded hover:bg-gray-100 text-gray-600 shrink-0" title="Open sidebar">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          )}
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} disabled={!fileInfo}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-40 whitespace-nowrap
                ${activeTab === t.id ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t.label}
            </button>
          ))}
          <div className="ml-auto shrink-0 pl-2">
            <button onClick={() => setInfoOpen(true)} title="Pipeline documentation"
              className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-violet-300 text-violet-600 hover:bg-violet-50 hover:border-violet-500 transition-colors font-bold text-sm">
              i
            </button>
          </div>
        </div>

        {/* Pipeline progress bar */}
        {isRunning && jobProgress && (
          <div className="bg-violet-50 border-b border-violet-100 px-3 md:px-6 py-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium text-violet-700">
                {jobProgress.status === 'preparing_download' ? '📦 Preparing download file...' : `⏳ ${jobProgress.current_step}`}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-violet-500">{jobProgress.step_index} / {jobProgress.total_steps} steps</span>
                <button onClick={handleCancelPipeline}
                  className="text-xs bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded transition-colors font-medium">
                  ✕ Cancel
                </button>
              </div>
            </div>
            <div className="h-2 bg-violet-100 rounded-full overflow-hidden">
              <div className="h-full bg-violet-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* Cancelled notice */}
        {jobProgress?.status === 'cancelled' && (
          <div className="bg-red-50 border-b border-red-100 px-6 py-2 text-xs text-red-600 flex items-center gap-2">
            ✕ Pipeline cancelled. You can re-run with different settings or upload a new file.
          </div>
        )}

        {/* Pre-download loading bar (shown after pipeline, while Excel is being prepared) */}
        {preparingDl && !downloadReady && (
          <div className="bg-green-50 border-b border-green-100 px-6 py-2">
            <div className="flex items-center gap-2 text-xs text-green-700">
              <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <span>Preparing download file in the background — download will be instant when ready.</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-3 md:p-6">
          {!fileInfo ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">QC Automation Pipeline</h2>
              <p className="text-gray-400 text-sm max-w-sm">
                Upload an Excel or CSV file in the sidebar, map your columns, configure steps, then run the pipeline.
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'preview'  && <DataPreview fileInfo={fileInfo} previewRows={previewRows} dataQuality={dataQuality} />}
              {activeTab === 'results'  && <PipelineResults results={pipelineData?.results} elapsed={pipelineData?.elapsed_total} sessionId={sessionId} newColsSummary={pipelineData?.new_cols_summary} downloadReady={downloadReady} />}
              {activeTab === 'analysis' && <PipelineAnalysis pipelineData={pipelineData} />}
            </>
          )}
        </div>
      </main>

      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} />
    </div>
  )
}
