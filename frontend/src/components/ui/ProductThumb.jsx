import { useState } from 'react'

/** Immagine prodotto con ripiego sull'iniziale se il file manca o non si carica. */
export default function ProductThumb({ product, className = 'product-image', style }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const url = product.image_url
  const showImage = url && failedUrl !== url

  return (
    <div className={className} style={style}>
      {showImage
        ? <img src={url} alt={product.image_alt || product.name} loading="lazy" onError={() => setFailedUrl(url)} />
        : <span aria-hidden="true">{(product.name || '?').slice(0, 1)}</span>}
    </div>
  )
}
