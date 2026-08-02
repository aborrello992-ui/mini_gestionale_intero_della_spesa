function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?'
}

export default function UserAvatar({ name, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : ''
  return <span className={`avatar ${sizeClass}`} aria-hidden="true">{initials(name)}</span>
}
