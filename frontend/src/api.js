import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const uploadFile = (file, onProgress) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/upload', fd, {
    onUploadProgress: e => onProgress && onProgress(Math.round(e.loaded / e.total * 100))
  }).then(r => r.data)
}

export const startPipeline = (session_id) =>
  api.post('/pipeline/run', { session_id }).then(r => r.data)

export const pollStatus = (job_id) =>
  api.get(`/pipeline/status/${job_id}`).then(r => r.data)

export const getDownloadUrl = (session_id) => `/api/download/${session_id}`

export const getSettings = () => api.get('/settings').then(r => r.data)
export const saveSettings = (data) => api.post('/settings', data).then(r => r.data)
export const testConnection = () => api.post('/settings/test-connection').then(r => r.data)
