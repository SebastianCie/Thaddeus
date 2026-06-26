import { useEffect, useRef, useState } from 'react'
import keycloak from '../../auth/keycloak'

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

export function UserMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fullName =
    keycloak.tokenParsed?.['name'] ||
    keycloak.tokenParsed?.['preferred_username'] ||
    'User'
  const email = keycloak.tokenParsed?.['email'] as string | undefined
  const initials = getInitials(fullName)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="user-avatar-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="User menu"
      >
        <span className="user-avatar">{initials}</span>
      </button>

      {open && (
        <div className="user-dropdown">
          <div className="user-dropdown-header">
            <span className="user-avatar user-avatar--lg">{initials}</span>
            <div className="user-dropdown-info">
              <div className="user-dropdown-name">{fullName}</div>
              {email && <div className="user-dropdown-email">{email}</div>}
            </div>
          </div>
          <div className="user-dropdown-divider" />
          <button
            className="user-dropdown-logout"
            onClick={() => keycloak.logout()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Abmelden
          </button>
        </div>
      )}
    </div>
  )
}
