import { NavLink, useLocation, useMatch } from 'react-router-dom'

type NavItem = { to: string; label: string; icon: string; end?: boolean }

const sectionItems: Record<string, NavItem[]> = {
  projects: [
    { to: '/', label: 'Overview', icon: '⬡', end: true },
  ],
  infrastructure: [
    { to: '/infrastructure', label: 'Dashboard', icon: '⬡', end: true },
    { to: '/infrastructure/targets', label: 'Deployment Targets', icon: '⬢' },
    { to: '/environments', label: 'Environments', icon: '⚡' },
  ],
  library: [
    { to: '/library', label: 'Packages', icon: '📦', end: true },
    { to: '/library/lifecycles', label: 'Deployment Lifecycles', icon: '⬢' },
  ],
  audit: [
    { to: '/configuration', label: 'Audit', icon: '⚙' },
  ],
}

function getSection(pathname: string): string {
  if (pathname.startsWith('/infrastructure') || pathname.startsWith('/environments')) return 'infrastructure'
  if (pathname.startsWith('/library')) return 'library'
  if (pathname.startsWith('/configuration')) return 'audit'
  return 'projects'
}

export function Sidebar() {
  const { pathname } = useLocation()
  const projectMatch = useMatch('/projects/:id/*')
  const projectId = projectMatch?.params.id

  const items: NavItem[] = projectId
    ? [
        { to: `/projects/${projectId}/dashboard`,  label: 'Dashboard',            icon: '⬡' },
        { to: `/projects/${projectId}/releases`,   label: 'Releases',             icon: '⬢' },
        { to: `/projects/${projectId}/process`,    label: 'Process Editor',       icon: '⬢' },
        { to: `/projects/${projectId}/lifecycle`,  label: 'Deployment Lifecycle', icon: '⬢' },
        { to: `/projects/${projectId}/variables`,  label: 'Project Variables',    icon: '⬢' },
      ]
    : sectionItems[getSection(pathname)]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">⬡ Thaddeus</div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
