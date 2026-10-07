const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const MB = 1024 * 1024

export class ImageTooLargeError extends Error {}

const formatMb = (bytes) => `${(bytes / MB).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Alcuni browser non accettano le opzioni: si riprova senza o con <img>.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')) }
    img.src = url
  })
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Riduce una foto nel browser (lato lungo massimo maxSide, JPEG) finché non sta sotto maxBytes.
 * Se il browser non riesce a leggerla (es. HEIC su Chrome/Android) usa il file originale,
 * ma solo se è già in un formato accettato e sotto il limite; altrimenti lancia un errore chiaro.
 */
export async function shrinkImage(file, { maxBytes, maxSide = 1600 }) {
  if (!file) return null

  let source
  try {
    source = await decode(file)
  } catch {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ImageTooLargeError('Questo formato foto (probabilmente HEIC) non è leggibile dal browser. Su iPhone: Impostazioni › Fotocamera › Formati › "Più compatibile", oppure invia uno screenshot della foto.')
    }
    if (file.size > maxBytes) {
      throw new ImageTooLargeError(`La foto pesa ${formatMb(file.size)} e non è stato possibile ridurla: il limite è ${formatMb(maxBytes)}.`)
    }
    return file
  }

  const width = source.width || source.naturalWidth
  const height = source.height || source.naturalHeight
  if (ALLOWED_TYPES.includes(file.type) && file.size <= maxBytes && Math.max(width, height) <= maxSide) {
    source.close?.()
    return file
  }

  let scale = Math.min(1, maxSide / Math.max(width, height))
  let quality = 0.82
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
    const blob = await canvasToBlob(canvas, quality)
    if (blob && blob.size <= maxBytes) {
      source.close?.()
      const name = `${(file.name || 'foto').replace(/\.[^.]+$/, '')}.jpg`
      return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
    }
    quality = Math.max(0.5, quality - 0.12)
    scale *= 0.8
  }

  source.close?.()
  throw new ImageTooLargeError(`Non è stato possibile ridurre la foto sotto ${formatMb(maxBytes)}. Prova con un'altra foto.`)
}
