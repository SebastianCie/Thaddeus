import { Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { UserMenu } from './components/layout/UserMenu'
import { Dashboard } from './pages/Dashboard'
import { Summary } from './pages/Summary'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { Deployments } from './pages/Deployments'
import { DeploymentDetail } from './pages/DeploymentDetail'
import { Infrastructure } from './pages/Infrastructure'
import { Library } from './pages/Library'
import { Configuration } from './pages/Configuration'
import { ProjectDashboard } from './pages/ProjectDashboard'

export default function App() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <UserMenu />
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/dashboard" element={<ProjectDashboard />} />
          <Route path="/deployments" element={<Deployments />} />
          <Route path="/deployments/:id" element={<DeploymentDetail />} />
          <Route path="/infrastructure" element={<Infrastructure />} />
          <Route path="/library" element={<Library />} />
          <Route path="/configuration" element={<Configuration />} />
        </Routes>
      </main>
    </div>
  )
}
