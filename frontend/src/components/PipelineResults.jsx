import { downloadUrl } from '../api'

const statusIcon = { ok: '✅', skipped: '⏭', error: '❌' }
const statusBg   = { ok: 'bg-green-50 border-green-200', skipped: 'bg-gray-50 border-gray-200', error: 'bg-red-50 border-red-200' }

function fmtDetail(detail) {
  if (!detail || typeof detail !== 'object') return String(detail ?? '')
  const keys = ['cells_updated','valid_emails','invalid_emails','matches','non_matches',
                 'matched','not_matched','invalid','mapped','columns_removed','categories','message']
  return keys.filter(k => k in detail).map(k => `${k}: ${detail[k]}`).join(' | ') || JSON.stringify(detail)
}

function fmtTime(s) {
  if (s >= 60) return `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`
  return `${s.toFixed(2)}s`
}

export default function PipelineResults({ results, elapsed, sessionId, newColsSummary }) {
  if (!results?.length) return (
    <div className="text-gray-400 text-sm text-center py-12">
      Run the pipeline to see results here.
    </div>
  )

  const ok   = results.filter(r => r.status === 'ok').length
  const skip = results.filter(r => r.status === 'skipped').length
  const fail = results.filter(r => r.status === 'error').length

  return (
    <div className="space-y-4">
      {/* Summary metrics */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Steps', value: results.length, color: 'text-gray-700' },
          { label: 'Completed',   value: ok,             color: 'text-green-600' },
          { label: 'Skipped',     value: skip,           color: 'text-gray-500'  },
          { label: 'Failed',      value: fail,           color: 'text-red-500'   },
        ].map(m => (
          <div key={m.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-gray-400">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Download + elapsed */}
      <div className="flex items-center gap-3">
        <a href={downloadUrl(sessionId)} download
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
          ⬇ Download QC Output
        </a>
        <span className="text-sm text-gray-400">Pipeline time: <strong className="text-gray-700">{fmtTime(elapsed)}</strong></span>
      </div>

      {/* Step results */}
      <div className="space-y-2">
        {results.map((r, i) => (
          <div key={i} className={`border rounded-lg px-4 py-2.5 text-sm ${statusBg[r.status] || 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">{statusIcon[r.status]} {r.label}</span>
              <span className="text-xs text-gray-400">{fmtTime(r.elapsed)}</span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{fmtDetail(r.detail)}</div>
          </div>
        ))}
      </div>

      {/* New columns summary */}
      {newColsSummary?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">New Columns Added</h3>
          <div className="overflow-auto rounded border border-gray-200">
            <table className="text-xs w-full border-collapse">
              <thead className="bg-violet-50 sticky top-0">
                <tr>
                  {['Column', 'Populated', 'Null', 'Unique', 'Top Value'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-violet-800 border-b border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {newColsSummary.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-1.5 border-b border-gray-100 font-medium text-violet-700">{row.column}</td>
                    <td className="px-3 py-1.5 border-b border-gray-100 text-green-600">{row.populated}</td>
                    <td className="px-3 py-1.5 border-b border-gray-100 text-gray-400">{row.null}</td>
                    <td className="px-3 py-1.5 border-b border-gray-100 text-gray-500">{row.unique}</td>
                    <td className="px-3 py-1.5 border-b border-gray-100 text-gray-500">{row.top_value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
