import api from '../api/client'

const apiRoot = (api.defaults.baseURL || 'http://localhost:8000/api').replace(/\/api\/?$/, '')

export function storageUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path

  const cleanPath = String(path).replace(/^\/?storage\//, '').replace(/^\//, '')
  return `${apiRoot.replace(/\/$/, '')}/storage/${cleanPath}`
}
