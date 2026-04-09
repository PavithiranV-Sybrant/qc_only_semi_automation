import { useRef, useState } from 'react'

export default function FileUpload({ onUpload, loading }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  function handleFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'csv'].includes(ext)) {
      alert('Only .xlsx and .csv files are supported.')
      return
    }
    onUpload(file)
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
        ${dragging ? 'border-violet-500 bg-violet-50' : 'border-gray-300 hover:border-violet-400'}`}
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden"
        onChange={e => handleFile(e.target.files[0])} />
      <div className="text-4xl mb-2">📂</div>
      {loading
        ? <p className="text-violet-600 font-medium">Loading file...</p>
        : <>
            <p className="font-medium text-gray-700">Drop file here or click to browse</p>
            <p className="text-sm text-gray-400 mt-1">.xlsx or .csv</p>
          </>
      }
    </div>
  )
}
