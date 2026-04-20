import axios from 'axios'

export async function uploadFile(file, onProgress) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await axios.post('/api/upload', form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
  return data
}

export async function getConfig() {
  const { data } = await axios.get('/api/config')
  return data
}

export async function startPipeline(sessionId, columnMapping, stepToggles, thresholds) {
  const { data } = await axios.post('/api/run-pipeline', {
    session_id:     sessionId,
    column_mapping: columnMapping,
    step_toggles:   stepToggles,
    thresholds,
  })
  return data  // { job_id, status }
}

export async function pollJobStatus(jobId) {
  const { data } = await axios.get(`/api/pipeline-status/${jobId}`)
  return data
}

export async function cancelPipeline(jobId) {
  const { data } = await axios.post(`/api/cancel-pipeline/${jobId}`)
  return data
}

export function downloadUrl(sessionId) {
  return `/api/download/${sessionId}`
}

// ── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates() {
  const { data } = await axios.get('/api/templates')
  return data
}

export async function saveTemplate(name, payload) {
  const { data } = await axios.post(`/api/templates/${name}`, payload)
  return data
}

export async function deleteTemplate(name) {
  const { data } = await axios.delete(`/api/templates/${name}`)
  return data
}

// ── Batch ──────────────────────────────────────────────────────────────────

export async function batchUpload(files, onProgress) {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  const { data } = await axios.post('/api/batch/upload', form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data
}

export async function runBatch(batchId, columnMapping, stepToggles, thresholds) {
  const { data } = await axios.post('/api/batch/run', {
    batch_id:       batchId,
    column_mapping: columnMapping,
    step_toggles:   stepToggles,
    thresholds,
  })
  return data
}

export async function pollBatchStatus(batchId) {
  const { data } = await axios.get(`/api/batch/status/${batchId}`)
  return data
}

export async function cancelBatch(batchId) {
  const { data } = await axios.post(`/api/batch/cancel/${batchId}`)
  return data
}

export async function cancelBatchFile(batchId, sessionId) {
  const { data } = await axios.post(`/api/batch/cancel-file/${batchId}/${sessionId}`)
  return data
}

// ── Settings & Storage ─────────────────────────────────────────────────────

export async function getSettings() {
  const { data } = await axios.get('/api/settings')
  return data
}

export async function saveSettings(payload) {
  const { data } = await axios.post('/api/settings', payload)
  return data
}

export async function listStoredFiles() {
  const { data } = await axios.get('/api/storage/files')
  return data
}

export async function deleteStoredFile(fileId) {
  const { data } = await axios.delete(`/api/storage/files/${fileId}`)
  return data
}

export async function deleteAllStoredFiles() {
  const { data } = await axios.delete('/api/storage/files')
  return data
}

export async function runCleanup() {
  const { data } = await axios.post('/api/storage/cleanup')
  return data
}

export function storedFileDownloadUrl(fileId) {
  return `/api/storage/download/${fileId}`
}

// ── Queue ──────────────────────────────────────────────────────────────────

export async function getQueue() {
  const { data } = await axios.get('/api/queue')
  return data
}

// ── Background Jobs ────────────────────────────────────────────────────────

export async function getBackgroundJobs() {
  const { data } = await axios.get('/api/background-jobs')
  return data
}

export async function dismissSingleJob(jobId) {
  const { data } = await axios.delete(`/api/background-jobs/single/${jobId}`)
  return data
}

export async function dismissBatchJob(batchId) {
  const { data } = await axios.delete(`/api/background-jobs/batch/${batchId}`)
  return data
}

export function batchDownloadAllUrl(batchId) {
  return `/api/batch/download-all/${batchId}`
}

// ── LLM Settings ──────────────────────────────────────────────────────────

export async function getLLMSettings() {
  const { data } = await axios.get('/api/llm-settings')
  return data
}

export async function saveLLMSettings(payload) {
  const { data } = await axios.post('/api/llm-settings', payload)
  return data
}

// ── Autonomous Agent ───────────────────────────────────────────────────────

export async function autonomousAnalyze(sessionId) {
  const { data } = await axios.post('/api/autonomous/analyze', { session_id: sessionId })
  return data
}

export async function testLLMConnection() {
  const { data } = await axios.post('/api/autonomous/test-connection')
  return data
}

export async function listLLMModels() {
  const { data } = await axios.get('/api/autonomous/models')
  return data
}

// ── Final Output Templates ─────────────────────────────────────────────────

export async function ftExtractHeaders(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await axios.post('/api/final-templates/extract-headers', form)
  return data  // { columns: [{name, argb}] }
}

export async function ftListTemplates() {
  const { data } = await axios.get('/api/final-templates')
  return data  // [{name, comment, column_count, created_at}]
}

export async function ftGetTemplate(name) {
  const { data } = await axios.get(`/api/final-templates/${name}`)
  return data  // {name, comment, created_at, columns: [{name, argb}]}
}

export async function ftSaveTemplate(name, payload) {
  // payload: { comment, columns: [{name, argb}] }
  const { data } = await axios.post(`/api/final-templates/${name}`, payload)
  return data
}

export async function ftDeleteTemplate(name) {
  const { data } = await axios.delete(`/api/final-templates/${name}`)
  return data
}

export async function ftCheckFile(file, templateName) {
  const form = new FormData()
  form.append('file', file)
  form.append('template_name', templateName)
  const { data } = await axios.post('/api/final-templates/check', form)
  return data  // { overall_status, mappings, file_extra_cols }
}

export async function ftNormalizeDownload(file, templateName, mappings) {
  const form = new FormData()
  form.append('file', file)
  form.append('template_name', templateName)
  form.append('mapping_json', JSON.stringify(mappings))
  const resp = await axios.post('/api/final-templates/normalize', form, {
    responseType: 'blob',
  })
  return resp  // caller uses resp.data as the Blob for download
}
