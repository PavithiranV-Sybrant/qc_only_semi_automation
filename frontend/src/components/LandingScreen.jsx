const MODES = [
  {
    id:    'single',
    icon:  '📄',
    title: 'Single File',
    desc:  'Upload one Excel or CSV file, map your columns, run the QC pipeline, and download the enriched output.',
    badge: null,
  },
  {
    id:    'batch',
    icon:  '📂',
    title: 'Batch Processing',
    desc:  'Upload multiple files at once and run the same pipeline configuration across all of them simultaneously.',
    badge: 'Multi-file',
  },
  {
    id:    'templates',
    icon:  '🗂️',
    title: 'Template Manager',
    desc:  'View, create, and edit column mapping templates that define how roles map to your data source columns.',
    badge: null,
  },
]

export default function LandingScreen({ onSelect }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🔍</span>
        <h1 className="text-xl font-bold text-violet-700">QC Automation</h1>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-3">
            What would you like to do?
          </h2>
          <p className="text-gray-500 text-base max-w-lg mx-auto">
            Validate and enrich business contact data. Choose a mode to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="group bg-white border-2 border-gray-200 hover:border-violet-500 hover:shadow-xl
                         rounded-2xl p-8 text-left transition-all duration-200 relative overflow-hidden"
            >
              {/* hover accent bar */}
              <div className="absolute inset-x-0 top-0 h-1 bg-violet-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left rounded-t-2xl" />

              {m.badge && (
                <span className="absolute top-4 right-4 text-xs font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                  {m.badge}
                </span>
              )}

              <div className="text-5xl mb-5">{m.icon}</div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-violet-700 mb-2 transition-colors">
                {m.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{m.desc}</p>

              <div className="mt-6 flex items-center text-xs font-semibold text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Get started
                <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <p className="mt-10 text-xs text-gray-400">
          All processing happens locally — no data leaves your machine.
        </p>
      </main>
    </div>
  )
}
