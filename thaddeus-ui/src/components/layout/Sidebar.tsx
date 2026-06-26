import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Projects', icon: '◈' },
  { to: '/summary', label: 'Summary', icon: '▦' },
  { to: '/projects', label: 'Dashboard', icon: '⬡' },
  { to: '/deployments', label: 'Deployments', icon: '⚡' },
  { to: '/infrastructure', label: 'Infrastructure', icon: '⬢' },
  { to: '/library', label: 'Library', icon: '📦' },
  { to: '/configuration', label: 'Configuration', icon: '⚙' },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">⬡ Thaddeus</div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
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
