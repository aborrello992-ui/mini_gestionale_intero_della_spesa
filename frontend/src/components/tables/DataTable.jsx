import EmptyState from '../feedback/EmptyState'

export default function DataTable({ columns, rows, getKey, renderMobile, emptyTitle = 'Nessun dato disponibile.', emptyMessage }) {
  if (!rows?.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />
  }

  return (
    <div className="data-table-shell">
      <table className="data-table">
        <thead>
          <tr>{columns.map((column) => <th className={column.align === 'right' ? 'td-number' : ''} key={column.key}>{column.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getKey(row)}>
              {columns.map((column) => (
                <td className={column.align === 'right' ? 'td-number' : ''} key={column.key}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mobile-data-list">
        {rows.map((row) => <div className="mobile-data-card" key={getKey(row)}>{renderMobile(row)}</div>)}
      </div>
    </div>
  )
}
