import { getDownloadUrl } from '../api'

export default function PipelineResults({ job, sessionId }) {
  if (!job || job.status !== 'done') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-6xl mb-4">🔬</div>
        <p className="text-gray-400 text-sm">Upload a file and run the pipeline to see results.</p>
      </div>
    )
  }

  const { total_rows, columns_added, step_results, quality_score, role_map } = job
  const passed = step_results?.filter(s => s.status !== 'error').length || 0
  const failed = step_results?.filter(s => s.status === 'error').length || 0

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Score card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Quality Score', value: `${quality_score?.toFixed(0)}%`, color: 'text-green-600' },
          { label: 'Rows Processed', value: total_rows?.toLocaleString(), color: 'text-violet-600' },
          { label: 'QC Columns Added', value: columns_added?.length, color: 'text-blue-600' },
          { label: 'Steps Passed', value: `${passed}/${(passed + failed)}`, color: 'text-teal-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-400 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Download button */}
      {sessionId && (
        <a
          href={getDownloadUrl(sessionId)}
          download
          className="flex items-center justify-center gap-2 w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-violet-200"
        >
          ⬇ Download QC Excel
        </a>
      )}

      {/* Columns added */}
      {columns_added?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3">QC Columns Added ({columns_added.length})</h3>
          <div className="flex flex-wrap gap-2">
            {columns_added.map(c => (
              <span key={c} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Role map */}
      {role_map && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Column Role Mapping</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(role_map).filter(([k, v]) => v && k !== 'phone_columns').map(([role, col]) => (
              <div key={role} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                <span className="text-gray-500 capitalize">{role.replace(/_/g, ' ')}</span>
                <span className="font-semibold text-violet-700 truncate max-w-[140px]" title={col}>{col}</span>
              </div>
            ))}
            {role_map.phone_columns?.length > 0 && (
              <div className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                <span className="text-gray-500">Phone Columns</span>
                <span className="font-semibold text-violet-700 truncate max-w-[140px]">{role_map.phone_columns.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step results */}
      {step_results?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Pipeline Steps</h3>
          <div className="space-y-1.5">
            {step_results.map((s, i) => (
              <div key={i} className={`flex items-center gap-3 text-xs rounded-lg px-3 py-2
                ${s.status === 'error' ? 'bg-red-50 border border-red-100' : 'bg-green-50'}`}>
                <span>{s.status === 'error' ? '❌' : '✅'}</span>
                <span className={`flex-1 font-medium ${s.status === 'error' ? 'text-red-700' : 'text-green-800'}`}>
                  {s.step}
                </span>
                {s.status === 'error' && s.detail?.error && (
                  <span className="text-red-500 truncate max-w-xs">{s.detail.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
