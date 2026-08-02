export default function Pagination({ page, onPage }) {
  if (!page || page.last_page <= 1) return null
  return (
    <div className="pagination-bar">
      <button className="btn btn-outline-secondary" disabled={!page.prev_page_url} onClick={() => onPage(page.current_page - 1)}>Indietro</button>
      <span className="small text-muted-app">Pagina {page.current_page} di {page.last_page}</span>
      <button className="btn btn-outline-secondary" disabled={!page.next_page_url} onClick={() => onPage(page.current_page + 1)}>Avanti</button>
    </div>
  )
}
