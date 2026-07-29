export default function Pagination({ page, onPage }) {
  if (!page || page.last_page <= 1) return null
  return (
    <div className="d-flex justify-content-between align-items-center mt-3">
      <button className="btn btn-outline-secondary" disabled={!page.prev_page_url} onClick={() => onPage(page.current_page - 1)}>Indietro</button>
      <span className="small text-secondary">Pagina {page.current_page} di {page.last_page}</span>
      <button className="btn btn-outline-secondary" disabled={!page.next_page_url} onClick={() => onPage(page.current_page + 1)}>Avanti</button>
    </div>
  )
}
