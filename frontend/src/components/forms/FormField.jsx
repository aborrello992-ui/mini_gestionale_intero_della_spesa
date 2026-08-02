export default function FormField({ label, help, error, children, htmlFor }) {
  return (
    <div>
      {label && <label className="form-label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {help && <div className="field-help">{help}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}
