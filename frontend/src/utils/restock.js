export const EXPENSE_CATEGORIES = [
  ['pulizia', 'Pulizia'],
  ['stoviglie_posate', 'Stoviglie e posate'],
  ['sacchetti', 'Sacchetti'],
  ['altro', 'Altro'],
]

export const expenseCategoryLabel = (value) => EXPENSE_CATEGORIES.find(([key]) => key === value)?.[1] || value || 'Altro'
