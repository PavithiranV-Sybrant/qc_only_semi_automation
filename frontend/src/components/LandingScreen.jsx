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
    id:    'background',
    icon:  '⏳',
    title: 'Background Jobs',
    desc:  'Monitor live pipeline progress. Jobs keep running even after you close this page — reconnect any time.',
    badge: 'Live',
  },
  {
    id:    'templates',
    icon:  '🗂️',
    title: 'Template Manager',
    desc:  'View, create, and edit column mapping templates that define how roles map to your data source columns.',
    badge: null,
  },
  {
    id:    'final-output',
    icon:  '🎯',
    title: 'Output Normalizer',
    desc:  'Capture a golden output template with header colors, then check and normalize any file to match it exactly.',
    badge: 'Final QC',
  },
]

export default function LandingScreen({ onSelect }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🔍</span>
        <h1 className="text-xl font-bold text-violet-700">QC Automation</h1>
        <button
          onClick={() => onSelect('settings')}
          className="ml-auto p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
          title="Settings & File History"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 w-full max-w-5xl">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={`group border-2 rounded-2xl p-8 text-left transition-all duration-200 relative overflow-hidden
                ${m.highlight
                  ? 'bg-violet-600 border-violet-600 hover:bg-violet-700 hover:border-violet-700 hover:shadow-2xl'
                  : 'bg-white border-gray-200 hover:border-violet-500 hover:shadow-xl'}`}
            >
              {/* hover accent bar (non-highlight cards only) */}
              {!m.highlight && (
                <div className="absolute inset-x-0 top-0 h-1 bg-violet-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left rounded-t-2xl" />
              )}

              {m.badge && (
                <span className={`absolute top-4 right-4 text-xs font-semibold px-2 py-0.5 rounded-full
                  ${m.highlight ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'}`}>
                  {m.badge}
                </span>
              )}

              <div className="text-5xl mb-5">{m.icon}</div>
              <h3 className={`text-lg font-bold mb-2 transition-colors
                ${m.highlight ? 'text-white' : 'text-gray-800 group-hover:text-violet-700'}`}>
                {m.title}
              </h3>
              <p className={`text-sm leading-relaxed
                ${m.highlight ? 'text-violet-100' : 'text-gray-500'}`}>
                {m.desc}
              </p>

              <div className={`mt-6 flex items-center text-xs font-semibold transition-opacity
                ${m.highlight ? 'text-white opacity-80 group-hover:opacity-100' : 'text-violet-600 opacity-0 group-hover:opacity-100'}`}>
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
