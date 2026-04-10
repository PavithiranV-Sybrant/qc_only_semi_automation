import { useState, useEffect, useCallback } from 'react'
import {
  getSettings, saveSettings,
  listStoredFiles, deleteStoredFile, deleteAllStoredFiles, runCleanup,
  storedFileDownloadUrl,
} from '../api'

function fmtSize(bytes) {
  if (bytes < 1024)           return `${bytes} B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso) {
  // iso is UTC (ends in +00:00 or Z); parse and show in local time
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function BackIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

export default function SettingsPage({ onBack }) {
  const [backupDays,     setBackupDays]     = useState(7)
  const [files,          setFiles]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [cleaning,       setCleaning]       = useState(false)
  const [deletingId,     setDeletingId]     = useState(null)
  const [confirmDelAll,  setConfirmDelAll]  = useState(false)
  const [deletingAll,    setDeletingAll]    = useState(false)
  const [msg,            setMsg]            = useState(null)  // { type:'ok'|'err', text }

  const showMsg = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  const loadData = useCallback(async () => {
    try {
      const [settings, stored] = await Promise.all([getSettings(), listStoredFiles()])
      setBackupDays(settings.backup_days)
      setFiles(stored)
    } catch {
      showMsg('err', 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleSave() {
    setSaving(true)
    try {
      await saveSettings({ backup_days: backupDays })
      showMsg('ok', 'Settings saved.')
    } catch {
      showMsg('err', 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCleanup() {
    setCleaning(true)
    try {
      const result = await runCleanup()
      await loadData()
      const n = result.deleted_count
      showMsg('ok', n > 0 ? `Removed ${n} file${n !== 1 ? 's' : ''} older than ${result.backup_days} day${result.backup_days !== 1 ? 's' : ''}.` : 'No files needed cleanup.')
    } catch {
      showMsg('err', 'Cleanup failed.')
    } finally {
      setCleaning(false)
    }
  }

  async function handleDeleteOne(id) {
    setDeletingId(id)
    try {
      await deleteStoredFile(id)
      setFiles(f => f.filter(x => x.id !== id))
    } catch {
      showMsg('err', 'Delete failed.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteAll() {
    setDeletingAll(true)
    try {
      const result = await deleteAllStoredFiles()
      setFiles([])
      setConfirmDelAll(false)
      showMsg('ok', `Deleted ${result.deleted_count} file${result.deleted_count !== 1 ? 's' : ''}.`)
    } catch {
      showMsg('err', 'Delete all failed.')
    } finally {
      setDeletingAll(false)
    }
  }

  const totalSize = files.reduce((s, f) => s + (f.size_bytes || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={onBack}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
            title="Back to home">
            <BackIcon />
          </button>
          <h1 className="text-lg font-bold text-violet-700">Settings</h1>
          {msg && (
            <span className={`ml-auto text-xs px-3 py-1 rounded-full font-medium
              ${msg.type === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {msg.text}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* ── Storage Settings ──────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Storage Settings
          </h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-semibold text-gray-700">
                  Backup Retention
                </label>
                <span className="text-sm font-bold text-violet-700">
                  {backupDays} day{backupDays !== 1 ? 's' : ''}
                </span>
              </div>
              <input
                type="range" min={1} max={90} value={backupDays}
                onChange={e => setBackupDays(+e.target.value)}
                className="w-full accent-violet-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1 day</span>
                <span>90 days</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Processed files older than <strong>{backupDays} day{backupDays !== 1 ? 's' : ''}</strong> are
                automatically deleted when the app starts and once every 24 hours.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button onClick={handleSave} disabled={saving}
                className="bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
              <button onClick={handleCleanup} disabled={cleaning}
                className="border border-gray-300 hover:border-violet-400 hover:text-violet-700 text-gray-600 text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
                {cleaning ? 'Cleaning…' : 'Clean Up Now'}
              </button>
            </div>
          </div>
        </section>

        {/* ── File History ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              File History
              {files.length > 0 && (
                <span className="ml-2 font-normal normal-case text-gray-400">
                  — {files.length} file{files.length !== 1 ? 's' : ''}, {fmtSize(totalSize)} total
                </span>
              )}
            </h2>

            {files.length > 0 && !confirmDelAll && (
              <button onClick={() => setConfirmDelAll(true)}
                className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                Delete All
              </button>
            )}
            {confirmDelAll && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Delete all {files.length} files?</span>
                <button onClick={handleDeleteAll} disabled={deletingAll}
                  className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-1 rounded transition-colors disabled:opacity-50">
                  {deletingAll ? 'Deleting…' : 'Confirm'}
                </button>
                <button onClick={() => setConfirmDelAll(false)}
                  className="text-xs text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
              Loading…
            </div>
          ) : files.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <div className="text-4xl mb-3">🗄️</div>
              <p className="text-sm text-gray-500 font-medium">No stored files yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Files appear here after you run the pipeline. They persist across app restarts.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="text-xl shrink-0">📄</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{f.file_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtDate(f.saved_at)}
                      <span className="mx-1.5">·</span>
                      {fmtSize(f.size_bytes)}
                      {f.original_name && f.original_name !== f.file_name && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="text-gray-300">from</span>{' '}
                          <span className="text-gray-400">{f.original_name}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <a
                    href={storedFileDownloadUrl(f.id)}
                    download={f.file_name}
                    className="shrink-0 flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ↓ Download
                  </a>
                  <button
                    onClick={() => handleDeleteOne(f.id)}
                    disabled={deletingId === f.id}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Delete"
                  >
                    {deletingId === f.id ? (
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
