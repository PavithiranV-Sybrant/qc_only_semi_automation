export default function PipelineProgress({ job }) {
  if (!job) return null
  const { status, phase, message, pct, role_map, step_results } = job

  const phaseColors = {
    analyze: 'bg-blue-500',
    pipeline: 'bg-violet-500',
    done: 'bg-green-500',
    error: 'bg-red-500',
  }
  const barColor = status === 'error' ? 'bg-red-500' : phaseColors[phase] || 'bg-violet-500'

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-600 capitalize">{phase || 'pending'}</span>
          <span className="text-gray-400">{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500 truncate">{message}</p>
      </div>

      {/* Role map detected */}
      {role_map && Object.keys(role_map).length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Detected Roles</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {Object.entries(role_map).filter(([k, v]) => v && k !== 'phone_columns').map(([role, col]) => (
              <div key={role} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                <span className="text-gray-500">{role}</span>
                <span className="font-medium text-violet-700 truncate max-w-[120px]">{col}</span>
              </div>
            ))}
            {role_map.phone_columns?.length > 0 && (
              <div className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                <span className="text-gray-500">phone_columns</span>
                <span className="font-medium text-violet-700 truncate max-w-[120px]">{role_map.phone_columns.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step results */}
      {step_results?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Steps</p>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {step_results.map((s, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs rounded px-2 py-1
                ${s.status === 'error' ? 'bg-red-50' : 'bg-green-50'}`}>
                <span>{s.status === 'error' ? '❌' : '✅'}</span>
                <span className={s.status === 'error' ? 'text-red-700' : 'text-green-800'}>{s.step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
          ⚠ {job.error || 'Pipeline failed.'}
        </div>
      )}
    </div>
  )
}
