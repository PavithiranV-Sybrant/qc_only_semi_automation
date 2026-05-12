import { useState, useEffect } from 'react'
import { getSettings, saveSettings, testConnection } from '../api'

export default function SettingsPage({ onClose }) {
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    getSettings().then(s => {
      setKey(s.groq_api_key || '')
      setModel(s.model || '')
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      await saveSettings({ groq_api_key: key })
      setMsg({ type: 'ok', text: 'Settings saved.' })
    } catch {
      setMsg({ type: 'err', text: 'Failed to save.' })
    } finally { setSaving(false) }
  }

  async function handleTest() {
    setTesting(true)
    setMsg(null)
    try {
      await saveSettings({ groq_api_key: key })
      const r = await testConnection()
      setMsg(r.status === 'ok'
        ? { type: 'ok', text: `Connection OK — model: ${r.model}` }
        : { type: 'err', text: r.message })
    } catch {
      setMsg({ type: 'err', text: 'Test failed.' })
    } finally { setTesting(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Groq API Key
            </label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder="gsk_..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
              <button onClick={() => setShowKey(v => !v)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
                {showKey ? '🙈' : '👁'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Get your key at console.groq.com</p>
          </div>

          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500"><span className="font-semibold">Model:</span> {model || 'openai/gpt-oss-120b'}</p>
            <p className="text-xs text-gray-400 mt-0.5">Locked — 30 RPM / 6K TPM · columns read in batches of 6</p>
          </div>

          {msg && (
            <div className={`text-sm px-3 py-2 rounded-lg ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {msg.text}
            </div>
          )}
        </div>
        <div className="px-6 pb-5 flex gap-2">
          <button onClick={handleTest} disabled={!key || testing}
            className="flex-1 py-2 rounded-lg border border-violet-200 text-violet-700 text-sm font-semibold hover:bg-violet-50 disabled:opacity-40">
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
