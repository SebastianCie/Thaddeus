import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { UserMenu } from './components/layout/UserMenu'
import { Dashboard } from './pages/Dashboard'
import { Summary } from './pages/Summary'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { Deployments } from './pages/Deployments'
import { DeploymentDetail } from './pages/DeploymentDetail'
import { Infrastructure } from './pages/Infrastructure'
import { InfrastructureDashboard } from './pages/InfrastructureDashboard'
import { Environments } from './pages/Environments'
import { Library } from './pages/Library'
import { Configuration } from './pages/Configuration'
import { ProjectDashboard } from './pages/ProjectDashboard'
import { ProjectProcess } from './pages/ProjectProcess'
import { ProjectLifecycle } from './pages/ProjectLifecycle'
import { ProjectVariables } from './pages/ProjectVariables'
import { ProjectReleases } from './pages/ProjectReleases'
import { DeployPreview } from './pages/DeployPreview'
import { DeploymentLifecycles } from './pages/DeploymentLifecycles'
import { DeploymentLifecycleEditor } from './pages/DeploymentLifecycleEditor'

const topNavItems = [
  { label: 'Projects',         to: '/',               section: 'projects' },
  { label: 'Infrastructure',   to: '/infrastructure', section: 'infrastructure' },
  { label: 'Library',          to: '/library',        section: 'library' },
  { label: 'Audit',            to: '/configuration',  section: 'audit' },
]

function getSection(pathname: string): string {
  if (pathname.startsWith('/infrastructure') || pathname.startsWith('/environments')) return 'infrastructure'
  if (pathname.startsWith('/library')) return 'library'
  if (pathname.startsWith('/configuration')) return 'audit'
  return 'projects'
}

function TopNav() {
  const { pathname } = useLocation()
  const active = getSection(pathname)
  return (
    <nav className="top-nav">
      {topNavItems.map(item => (
        <Link
          key={item.section}
          to={item.to}
          className={`top-nav-item${active === item.section ? ' active' : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

export default function App() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <TopNav />
          <UserMenu />
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/dashboard" element={<ProjectDashboard />} />
          <Route path="/projects/:id/process"   element={<ProjectProcess />} />
          <Route path="/projects/:id/lifecycle"  element={<ProjectLifecycle />} />
          <Route path="/projects/:id/releases" element={<ProjectReleases />} />
          <Route path="/projects/:id/releases/:releaseId/deploy" element={<DeployPreview />} />
          <Route path="/projects/:id/variables" element={<ProjectVariables />} />
          <Route path="/deployments" element={<Deployments />} />
          <Route path="/deployments/:id" element={<DeploymentDetail />} />
          <Route path="/infrastructure" element={<InfrastructureDashboard />} />
          <Route path="/infrastructure/targets" element={<Infrastructure />} />
          <Route path="/environments" element={<Environments />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/lifecycles" element={<DeploymentLifecycles />} />
          <Route path="/library/lifecycles/new" element={<DeploymentLifecycleEditor />} />
          <Route path="/library/lifecycles/:id" element={<DeploymentLifecycleEditor />} />
          <Route path="/configuration" element={<Configuration />} />
        </Routes>
      </main>
    </div>
  )
}
